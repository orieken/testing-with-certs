package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"syscall"
	"time"

	"charm.land/bubbles/v2/list"
	tea "charm.land/bubbletea/v2"
	"charm.land/lipgloss/v2"
)

const maxOutput = 64 * 1024

var services = map[string]string{
	"gateway":       "keycloak, ui, catalog-api, customer-api, insights-api",
	"keycloak":      "postgres, pki, auth-secrets",
	"ui":            "pki",
	"postgres":      "pki, db-secrets",
	"catalog-api":   "postgres, pki",
	"customer-api":  "postgres, pki",
	"insights-api":  "postgres, pki",
	"runner-manual": "realm-bootstrap (manual profile)",
}

var secretPattern = regexp.MustCompile(`(?i)(bearer\s+|client.secret\s*[:=]\s*|password\s*[:=]\s*|access.token\s*[:=]\s*)([^\s"']+)`)
var pemPattern = regexp.MustCompile(`(?s)-----BEGIN [^-]+-----.*?-----END [^-]+-----`)

func redact(value string) string {
	value = pemPattern.ReplaceAllString(value, "[certificate material redacted]")
	return secretPattern.ReplaceAllString(value, "${1}[redacted]")
}

type operator struct {
	root, project string
	ctx           context.Context
	run           func(context.Context, string, []string, []string) (string, error)
}

func boundedRun(ctx context.Context, name string, args []string, env []string) (string, error) {
	cmd := exec.CommandContext(ctx, name, args...)
	cmd.Env = append(os.Environ(), env...)
	var b limitedBuffer
	cmd.Stdout, cmd.Stderr = &b, &b
	err := cmd.Run()
	if ctx.Err() != nil {
		return redact(b.String()), ctx.Err()
	}
	if b.truncated {
		return redact(b.String()), errors.New("command output exceeded 64 KiB")
	}
	return redact(b.String()), err
}

type limitedBuffer struct {
	data      []byte
	truncated bool
}

func (b *limitedBuffer) Write(p []byte) (int, error) {
	n := len(p)
	if len(b.data)+n > maxOutput {
		b.truncated = true
		p = p[:max(0, maxOutput-len(b.data))]
	}
	b.data = append(b.data, p...)
	return n, nil
}
func (b *limitedBuffer) String() string { return string(b.data) }

func (o operator) invoke(timeout time.Duration, name string, args []string, env []string) (string, error) {
	parent := o.ctx
	if parent == nil {
		parent = context.Background()
	}
	ctx, cancel := context.WithTimeout(parent, timeout)
	defer cancel()
	return o.run(ctx, name, args, append(env, "LAB_PROJECT="+o.project))
}
func (o operator) compose(timeout time.Duration, args ...string) (string, error) {
	return o.invoke(timeout, "docker", append([]string{"compose", "-f", filepath.Join(o.root, "infra/compose.yaml")}, args...), nil)
}
func (o operator) composeEnv(timeout time.Duration, env []string, args ...string) (string, error) {
	return o.invoke(timeout, "docker", append([]string{"compose", "-f", filepath.Join(o.root, "infra/compose.yaml")}, args...), env)
}
func (o operator) lab(timeout time.Duration, args ...string) (string, error) {
	return o.invoke(timeout, filepath.Join(o.root, "lab"), args, nil)
}

func summarizeTest(raw string) string {
	var lines []string
	for _, line := range strings.Split(raw, "\n") {
		trim := strings.TrimSpace(line)
		if strings.HasPrefix(trim, "✓") || strings.HasPrefix(trim, "✘") || strings.HasPrefix(trim, "-") && strings.Contains(trim, "teaching.spec.ts") ||
			strings.HasPrefix(trim, "Running ") && strings.Contains(trim, "tests") ||
			strings.HasPrefix(trim, "Local contract report: ") || strings.HasPrefix(trim, "Local teaching report: ") ||
			strings.HasPrefix(trim, "Revoked user CRL published at ") ||
			regexp.MustCompile(`^[0-9]+ (passed|failed|skipped|scenarios|steps)`).MatchString(trim) ||
			strings.HasPrefix(trim, "Safe artifact scan passed") || strings.HasPrefix(trim, "PASS: all 23") {
			lines = append(lines, trim)
		}
		if len(lines) >= 50 {
			break
		}
	}
	if len(lines) == 0 {
		return "Suite finished without a recognized summary; inspect the local report.\n"
	}
	return strings.Join(lines, "\n") + "\n"
}
func (o operator) suite(timeout time.Duration, args ...string) (string, error) {
	raw, err := o.lab(timeout, args...)
	return summarizeTest(raw), err
}

func (o operator) isolatedRevocation() (result string, retErr error) {
	const project = "magic-shop-matrix-user-crl-operator-13"
	check, err := o.invoke(15*time.Second, "docker", []string{"volume", "ls", "--filter", "label=com.docker.compose.project=" + project, "--format", "{{.Name}}"}, nil)
	if err != nil {
		return "", err
	}
	if strings.TrimSpace(check) != "" {
		return "", errors.New("isolated diagnostic project already has volumes; refusing to replace them")
	}
	iso := o
	iso.project = project
	// This run owns a previously empty project namespace. Cleanup is scoped to it.
	defer func() {
		cleanup := iso
		cleanup.ctx = context.Background()
		_, cleanupErr := cleanup.compose(2*time.Minute, "--profile", "test", "down", "--volumes")
		if cleanupErr != nil {
			retErr = errors.Join(retErr, fmt.Errorf("isolated cleanup failed: %w", cleanupErr))
		}
	}()
	step := func(label string, run func() (string, error)) error {
		_, e := run()
		if e != nil {
			return fmt.Errorf("%s failed: %w", label, e)
		}
		return nil
	}
	if err = step("isolated startup", func() (string, error) { return iso.lab(15*time.Minute, "up") }); err != nil {
		return "", err
	}
	if err = step("runner build", func() (string, error) {
		return iso.compose(10*time.Minute, "--profile", "test", "build", "runner-test")
	}); err != nil {
		return "", err
	}
	_, err = iso.composeEnv(2*time.Minute, []string{"LAB_USER=customer-waterdeep", "LAB_BROWSER=chrome"}, "--profile", "test", "run", "--rm", "--no-deps", "runner-test", "node", "/work/testing/container/ui-login.mjs")
	if err != nil {
		return "", fmt.Errorf("pre-revocation Chrome login failed: %w", err)
	}
	if err = step("user CRL publication", func() (string, error) { return iso.lab(2*time.Minute, "pki", "revoke", "customer-waterdeep") }); err != nil {
		return "", err
	}
	published := time.Now().UnixMilli()
	if err = step("gateway and Keycloak CRL reload", func() (string, error) { return iso.compose(3*time.Minute, "restart", "gateway", "keycloak") }); err != nil {
		return "", err
	}
	if err = step("gateway and Keycloak readiness", func() (string, error) {
		return iso.compose(3*time.Minute, "up", "-d", "--no-deps", "--wait", "--wait-timeout", "120", "gateway", "keycloak")
	}); err != nil {
		return "", err
	}
	probe, err := iso.composeEnv(3*time.Minute, []string{"LAB_USER=customer-waterdeep", "LAB_CRL_PUBLISHED_EPOCH_MS=" + fmt.Sprint(published)}, "--profile", "test", "run", "--rm", "--no-deps", "-e", "LAB_PROJECT", "-e", "LAB_CRL_PUBLISHED_EPOCH_MS", "runner-test", "node", "/work/testing/container/revoked-user-bound.mjs")
	if err != nil {
		return "", fmt.Errorf("fresh revoked-user probe failed: %w", err)
	}
	return "Isolated Chrome login passed before revocation. Fresh shop and auth connections rejected the revoked user certificate.\n" + summarizeTest(probe), nil
}

type container struct {
	Service string
	State   string
	Health  string
	Name    string
}

func parsePS(raw string) ([]container, error) {
	var entries []container
	trim := strings.TrimSpace(raw)
	if trim == "" {
		return entries, nil
	}
	if strings.HasPrefix(trim, "[") {
		if err := json.Unmarshal([]byte(trim), &entries); err != nil {
			return nil, err
		}
		return entries, nil
	}
	for _, line := range strings.Split(trim, "\n") {
		var c container
		if err := json.Unmarshal([]byte(line), &c); err != nil {
			return nil, err
		}
		entries = append(entries, c)
	}
	return entries, nil
}
func (o operator) status() (string, error) {
	cs, err := o.containers()
	if err != nil {
		return "", err
	}
	return formatStatus(cs), nil
}
func formatStatus(cs []container) string {
	by := map[string]container{}
	for _, c := range cs {
		by[c.Service] = c
	}
	names := make([]string, 0, len(services))
	for k := range services {
		names = append(names, k)
	}
	sort.Strings(names)
	var lines []string
	for _, name := range names {
		c, ok := by[name]
		state := "absent"
		health := "not ready"
		if ok {
			state = c.State
			health = c.Health
			if health == "" {
				health = "no healthcheck"
			}
		}
		lines = append(lines, fmt.Sprintf("%-17s %-9s %-14s depends: %s", name, state, health, services[name]))
	}
	lines = append(lines, "runner-test        ephemeral  readiness is test exit status")
	return strings.Join(lines, "\n") + "\n"
}
func (o operator) containers() ([]container, error) {
	raw, err := o.compose(20*time.Second, "--profile", "manual", "--profile", "test", "ps", "--all", "--format", "json")
	if err != nil {
		return nil, fmt.Errorf("compose ps: %s: %w", raw, err)
	}
	return parsePS(raw)
}
func (o operator) health() (string, error) {
	cs, err := o.containers()
	if err != nil {
		return "", err
	}
	s := formatStatus(cs)
	by := map[string]container{}
	for _, c := range cs {
		by[c.Service] = c
	}
	for name := range services {
		if name == "runner-manual" {
			continue
		}
		c := by[name]
		if c.State != "running" || c.Health != "healthy" {
			return s, fmt.Errorf("%s is not healthy", name)
		}
	}
	if manual, present := by["runner-manual"]; present && (manual.State != "running" || manual.Health != "healthy") {
		return s, errors.New("active manual viewer is not healthy")
	}
	return s + "Healthcheck passed: seven core services healthy; active manual viewer healthy if present.\n", nil
}

func (o operator) certs() (string, error) {
	// Only opens public certificate and CRL files. The issuer's private state is never printed.
	script := `for n in shop auth customer-waterdeep shop-admin gateway-client customer-client insights-client; do echo "$n"; openssl x509 -in "/out/$n/cert.pem" -noout -issuer -serial -enddate || exit; done; for n in user service server; do echo "$n CRL"; openssl crl -in "/public/$n.crl.pem" -noout -lastupdate -nextupdate || exit; done`
	out, err := o.compose(60*time.Second, "run", "--rm", "--no-deps", "--entrypoint", "bash", "pki", "-c", script)
	if err != nil {
		return out, err
	}
	var ages []string
	for _, line := range strings.Split(out, "\n") {
		if !strings.HasPrefix(line, "lastUpdate=") {
			continue
		}
		date := strings.TrimPrefix(line, "lastUpdate=")
		published, e := time.Parse("Jan  2 15:04:05 2006 MST", date)
		if e != nil {
			published, e = time.Parse("Jan 2 15:04:05 2006 MST", date)
		}
		if e == nil {
			ages = append(ages, fmt.Sprintf("CRL publication age: %s", time.Since(published).Round(time.Minute)))
		}
	}
	return out + strings.Join(ages, "\n") + "\n", nil
}
func (o operator) telemetry() (string, error) {
	s, err := o.status()
	if err != nil {
		return s, err
	}
	paths := []string{"contracts", "teaching", "playwright"}
	var out strings.Builder
	out.WriteString(s)
	for _, p := range paths {
		items, e := os.ReadDir(filepath.Join(o.root, "artifacts", p))
		if e != nil {
			continue
		}
		var names []string
		for _, it := range items {
			if it.IsDir() {
				names = append(names, it.Name())
			}
		}
		sort.Sort(sort.Reverse(sort.StringSlice(names)))
		if len(names) > 5 {
			names = names[:5]
		}
		out.WriteString(fmt.Sprintf("%s report IDs: %s\n", p, strings.Join(names, ", ")))
	}
	return out.String(), nil
}

func (o operator) execute(args []string) (string, error) {
	if len(args) == 0 {
		return "", errors.New("missing command")
	}
	switch args[0] {
	case "status", "health", "healthcheck", "telemetry", "certs", "diagnose":
		if len(args) != 1 {
			return "", errors.New("unexpected arguments")
		}
		switch args[0] {
		case "status":
			return o.status()
		case "health", "healthcheck":
			return o.health()
		case "telemetry":
			return o.telemetry()
		case "certs":
			return o.certs()
		default:
			// Reuse the live security and OpenAPI suites. Revoked-leaf tests remain
			// isolated because publishing a CRL changes project state.
			security, e := o.suite(25*time.Minute, "test", "--runner", "playwright", "--suite", "security")
			if e != nil {
				return security, e
			}
			contracts, e := o.suite(25*time.Minute, "test", "--runner", "playwright", "--suite", "contracts")
			return security + "\n" + contracts + "\nRevoked-leaf checks require an isolated project and explicit CRL publication.\n", e
		}
	case "logs":
		if len(args) != 2 || services[args[1]] == "" {
			return "", errors.New("choose a named service")
		}
		raw, err := o.compose(20*time.Second, "logs", "--no-color", "--tail", "30", "--since", "10m", args[1])
		if err != nil {
			return "log collection failed", err
		}
		lines := 0
		failures := 0
		warnings := 0
		for _, line := range strings.Split(strings.TrimSpace(raw), "\n") {
			if line == "" {
				continue
			}
			lines++
			lower := strings.ToLower(line)
			if strings.Contains(lower, "error") || strings.Contains(lower, "failed") {
				failures++
			}
			if strings.Contains(lower, "warn") {
				warnings++
			}
		}
		return fmt.Sprintf("%s: last 10 minutes, at most 30 lines; %d lines, %d error/failure, %d warnings. Message bodies withheld.\n", args[1], lines, failures, warnings), nil
	case "diagnose-revoked":
		if len(args) != 2 || args[1] != "--yes" {
			return "", errors.New("diagnose-revoked --yes requires confirmation")
		}
		return o.isolatedRevocation()
	case "test":
		if len(args) < 2 {
			return "", errors.New("test requires contracts, security, playwright or cucumber")
		}
		if args[1] == "contracts" || args[1] == "security" {
			if len(args) != 2 {
				return "", errors.New("unexpected test arguments")
			}
			return o.suite(30*time.Minute, "test", "--runner", "playwright", "--suite", args[1])
		}
		if len(args) != 4 || (args[1] != "playwright" && args[1] != "cucumber") || (args[2] != "chrome" && args[2] != "msedge") || (args[3] != "customer-waterdeep" && args[3] != "shop-admin" && args[3] != "shopkeeper") {
			return "", errors.New("test RUNNER chrome|msedge customer-waterdeep|shop-admin|shopkeeper")
		}
		if args[1] == "cucumber" && args[3] == "shopkeeper" {
			return "", errors.New("Cucumber has no shopkeeper example")
		}
		return o.suite(30*time.Minute, "test", "--runner", args[1], "--browser", args[2], "--user", args[3])
	case "manual":
		if len(args) == 2 && args[1] == "stop" {
			return o.lab(2*time.Minute, "manual", "stop")
		}
		if len(args) != 3 || (args[1] != "chrome" && args[1] != "msedge") || (args[2] != "customer-waterdeep" && args[2] != "shop-admin") {
			return "", errors.New("manual chrome|msedge customer-waterdeep|shop-admin, or manual stop")
		}
		return o.lab(10*time.Minute, "manual", "--browser", args[1], "--user", args[2])
	case "start":
		if len(args) != 2 || services[args[1]] == "" || args[1] == "runner-manual" {
			return "", errors.New("choose a long-running service; use lab manual for selected-user viewer")
		}
		return o.compose(5*time.Minute, "up", "-d", "--wait", "--wait-timeout", "120", args[1])
	case "stop":
		if len(args) != 3 || args[2] != "--yes" || services[args[1]] == "" {
			return "", errors.New("stop SERVICE --yes is required")
		}
		return o.compose(2*time.Minute, "stop", args[1])
	case "reset":
		if len(args) != 3 || args[2] != "--yes" || args[1] != o.project {
			return "", errors.New("reset PROJECT --yes requires the selected project name")
		}
		return o.lab(5*time.Minute, "reset", "--project", o.project)
	default:
		return "", errors.New("unknown command")
	}
}

type action struct{ title, command string }

func (a action) Title() string       { return a.title }
func (a action) Description() string { return a.command }
func (a action) FilterValue() string { return a.title }

type resultMsg struct {
	out string
	err error
}
type model struct {
	list     list.Model
	op       operator
	base     context.Context
	output   string
	pending  string
	busy     bool
	quitting bool
	cancel   context.CancelFunc
}

func initialModel(op operator) model {
	items := []list.Item{action{"Service status", "status"}, action{"Healthcheck", "healthcheck"}, action{"Local telemetry", "telemetry"}, action{"Certificate metadata", "certs"}, action{"Security diagnostics", "diagnose"}, action{"OpenAPI contracts", "test contracts"}}
	items = append(items, action{"Isolated user revocation probe", "diagnose-revoked --yes"})
	for _, runner := range []string{"playwright", "cucumber"} {
		for _, browser := range []string{"chrome", "msedge"} {
			for _, user := range []string{"customer-waterdeep", "shop-admin", "shopkeeper"} {
				if runner == "cucumber" && user == "shopkeeper" {
					continue
				}
				items = append(items, action{fmt.Sprintf("Test %s %s %s", runner, browser, user), fmt.Sprintf("test %s %s %s", runner, browser, user)})
			}
		}
	}
	names := make([]string, 0, len(services))
	for name := range services {
		if name != "runner-manual" {
			names = append(names, name)
		}
	}
	sort.Strings(names)
	for _, name := range names {
		items = append(items, action{"Start " + name, "start " + name}, action{"Stop " + name, "stop " + name + " --yes"})
	}
	for _, browser := range []string{"chrome", "msedge"} {
		for _, user := range []string{"customer-waterdeep", "shop-admin"} {
			items = append(items, action{"Manual " + browser + " " + user, "manual " + browser + " " + user})
		}
	}
	items = append(items, action{"Stop manual viewer", "manual stop"})
	l := list.New(items, list.NewDefaultDelegate(), 72, 9)
	l.Title = "Magic Shop operator"
	l.SetShowHelp(true)
	return model{list: l, op: op, base: op.ctx, output: "Select an action; q quits, r refreshes status."}
}
func (m model) Init() tea.Cmd { return nil }
func (m model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch v := msg.(type) {
	case tea.KeyPressMsg:
		switch v.String() {
		case "q", "ctrl+c":
			if m.cancel != nil {
				m.cancel()
			}
			if m.busy {
				m.quitting = true
				m.output = "Canceling action and cleaning up..."
				return m, nil
			}
			return m, tea.Quit
		case "r":
			if !m.busy {
				m.busy = true
				parent := m.base
				if parent == nil {
					parent = context.Background()
				}
				m.op.ctx, m.cancel = context.WithCancel(parent)
				return m, runAction(m.op, []string{"status"})
			}
		case "enter":
			if !m.busy {
				if a, ok := m.list.SelectedItem().(action); ok {
					if strings.HasPrefix(a.command, "stop ") || a.command == "manual stop" || strings.HasPrefix(a.command, "diagnose-revoked") {
						m.pending = a.command
						m.output = "Confirm " + a.title + "? Press y to continue or n to cancel."
						return m, nil
					}
					m.busy = true
					parent := m.base
					if parent == nil {
						parent = context.Background()
					}
					m.op.ctx, m.cancel = context.WithCancel(parent)
					return m, runAction(m.op, strings.Fields(a.command))
				}
			}
		case "y":
			if m.pending != "" && !m.busy {
				command := m.pending
				m.pending = ""
				m.busy = true
				parent := m.base
				if parent == nil {
					parent = context.Background()
				}
				m.op.ctx, m.cancel = context.WithCancel(parent)
				return m, runAction(m.op, strings.Fields(command))
			}
		case "n":
			m.pending = ""
			m.output = "Cancelled."
		}
	case resultMsg:
		if m.cancel != nil {
			m.cancel()
			m.cancel = nil
		}
		m.busy = false
		if m.quitting {
			return m, tea.Quit
		}
		m.output = v.out
		if v.err != nil {
			m.output += "\nError: " + v.err.Error()
		}
	}
	var cmd tea.Cmd
	m.list, cmd = m.list.Update(msg)
	return m, cmd
}
func runAction(op operator, args []string) tea.Cmd {
	return func() tea.Msg { out, err := op.execute(args); return resultMsg{out, err} }
}
func (m model) View() tea.View {
	style := lipgloss.NewStyle().Foreground(lipgloss.Color("6")).Width(72)
	state := ""
	if m.busy {
		state = "\nWorking (Ctrl+C cancels the TUI)..."
	}
	return tea.NewView(m.list.View() + "\n" + style.Render(m.output) + state + "\n")
}

func main() {
	args := os.Args[1:]
	if len(args) < 4 || args[0] != "--root" || args[2] != "--project" {
		fmt.Fprintln(os.Stderr, "operator requires --root PATH --project NAME")
		os.Exit(2)
	}
	project := args[3]
	if !regexp.MustCompile(`^[a-z0-9_-]+$`).MatchString(project) {
		fmt.Fprintln(os.Stderr, "invalid project")
		os.Exit(2)
	}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	op := operator{root: args[1], project: project, ctx: ctx, run: boundedRun}
	args = args[4:]
	if len(args) == 0 || args[0] == "tui" {
		tty, e := os.OpenFile("/dev/tty", os.O_RDWR, 0)
		if e != nil {
			out, err := op.status()
			fmt.Print(out)
			if err != nil {
				fmt.Fprintln(os.Stderr, err)
				os.Exit(1)
			}
			return
		}
		_ = tty.Close()
		if _, err := tea.NewProgram(initialModel(op)).Run(); err != nil {
			fmt.Fprintln(os.Stderr, err)
			os.Exit(1)
		}
		return
	}
	out, err := op.execute(args)
	_, _ = io.WriteString(os.Stdout, out)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

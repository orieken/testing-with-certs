package main

import (
	"context"
	"errors"
	"strings"
	"testing"

	tea "charm.land/bubbletea/v2"
)

func TestRedaction(t *testing.T) {
	in := "Authorization: Bearer abc.def password=secret access_token=jwt\n-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----"
	out := redact(in)
	for _, secret := range []string{"abc.def", "password=secret", "access_token=jwt", "PRIVATE KEY"} {
		if strings.Contains(out, secret) {
			t.Fatalf("secret visible: %s", secret)
		}
	}
}

func TestTestSummaryWithholdsUnexpectedRunnerOutput(t *testing.T) {
	out := summarizeTest("Authorization: Bearer secret.jwt\n  ✓  1 [security] › AUTH-03 no certificate\n3 passed (2s)\n")
	if strings.Contains(out, "secret.jwt") || !strings.Contains(out, "AUTH-03") || !strings.Contains(out, "3 passed") {
		t.Fatalf("unsafe or incomplete summary: %q", out)
	}
}

func TestCommandBoundary(t *testing.T) {
	called := false
	op := operator{root: "/repo", project: "safe", run: func(context.Context, string, []string, []string) (string, error) { called = true; return "", nil }}
	for _, args := range [][]string{
		{"stop", "gateway"}, {"stop", "gateway;rm", "--yes"}, {"reset", "another", "--yes"},
		{"test", "playwright", "chromium", "customer-waterdeep"}, {"test", "cucumber", "chrome", "shopkeeper"},
		{"logs", "pki"}, {"start", "runner-manual"},
		{"diagnose-revoked"},
	} {
		_, err := op.execute(args)
		if err == nil {
			t.Fatalf("accepted %v", args)
		}
	}
	if called {
		t.Fatal("invalid command reached executor")
	}
}

func TestIsolatedDiagnosticRefusesExistingVolumes(t *testing.T) {
	called := 0
	op := operator{root: "/repo", project: "safe", run: func(_ context.Context, _ string, _ []string, _ []string) (string, error) {
		called++
		return "magic-shop-matrix-user-crl-operator-13_ca-state\n", nil
	}}
	_, err := op.isolatedRevocation()
	if err == nil || called != 1 {
		t.Fatalf("existing project not protected: calls=%d err=%v", called, err)
	}
}

func TestHealthRequiresHealthyState(t *testing.T) {
	op := operator{root: "/repo", project: "safe", run: func(_ context.Context, _ string, args []string, _ []string) (string, error) {
		if strings.Contains(strings.Join(args, " "), "ps --all") {
			return `{"Service":"gateway","State":"running","Health":"starting"}`, nil
		}
		return "", errors.New("unexpected command")
	}}
	_, err := op.health()
	if err == nil {
		t.Fatal("running container was treated as ready")
	}
}

func TestHealthcheckIncludesActiveManualViewer(t *testing.T) {
	core := []string{"gateway", "keycloak", "ui", "postgres", "catalog-api", "customer-api", "insights-api"}
	var rows []string
	for _, name := range core {
		rows = append(rows, `{"Service":"`+name+`","State":"running","Health":"healthy"}`)
	}
	ps := strings.Join(rows, "\n")
	op := operator{root: "/repo", project: "safe", run: func(_ context.Context, _ string, args []string, _ []string) (string, error) {
		if !strings.Contains(strings.Join(args, " "), "ps --all") {
			return "", errors.New("unexpected command")
		}
		return ps, nil
	}}
	if out, err := op.execute([]string{"healthcheck"}); err != nil || !strings.Contains(out, "Healthcheck passed") {
		t.Fatalf("healthy core services rejected: %v %q", err, out)
	}
	ps += "\n" + `{"Service":"runner-manual","State":"running","Health":"unhealthy"}`
	if _, err := op.execute([]string{"healthcheck"}); err == nil || !strings.Contains(err.Error(), "manual viewer") {
		t.Fatalf("unhealthy manual viewer accepted: %v", err)
	}
	ps = strings.Replace(ps, `"Health":"unhealthy"`, `"Health":"healthy"`, 1)
	if _, err := op.execute([]string{"health"}); err != nil {
		t.Fatalf("healthy manual viewer rejected: %v", err)
	}
}

func TestOutputBound(t *testing.T) {
	var b limitedBuffer
	_, _ = b.Write([]byte(strings.Repeat("x", maxOutput+1)))
	if len(b.String()) != maxOutput || !b.truncated {
		t.Fatal("output bound failed")
	}
}

func TestTUIRefreshAndFailureDisplay(t *testing.T) {
	op := operator{root: "/repo", project: "safe", run: func(context.Context, string, []string, []string) (string, error) { return "", nil }}
	m := initialModel(op)
	updated, cmd := m.Update(tea.KeyPressMsg{Code: 'r'})
	refresh := updated.(model)
	if !refresh.busy || cmd == nil || refresh.cancel == nil {
		t.Fatal("refresh did not start bounded command")
	}
	updated, cmd = refresh.Update(tea.KeyPressMsg{Code: 'q'})
	refresh = updated.(model)
	if !refresh.quitting || cmd != nil {
		t.Fatal("quit did not wait for active command cleanup")
	}
	updated, _ = refresh.Update(resultMsg{out: "probe", err: errors.New("failure")})
	if !updated.(model).quitting {
		t.Fatal("quit did not finish")
	}
	updated, _ = initialModel(op).Update(resultMsg{out: "probe", err: errors.New("failure")})
	if !strings.Contains(updated.(model).output, "Error: failure") {
		t.Fatal("failure is not shown")
	}
}

func TestCancelledContextReachesExecutor(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	op := operator{root: "/repo", project: "safe", ctx: ctx, run: func(ctx context.Context, _ string, _ []string, _ []string) (string, error) { return "", ctx.Err() }}
	_, err := op.invoke(1, "docker", []string{"version"}, nil)
	if !errors.Is(err, context.Canceled) {
		t.Fatalf("cancelled command returned %v", err)
	}
}

package main

import (
	"context"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"time"
)

type matrixSelection struct{ OS, Browser, Runner, User, Suite string }
type matrixRow struct {
	OS              string        `json:"os"`
	Browser         string        `json:"browser"`
	Runner          string        `json:"runner"`
	User            string        `json:"user"`
	AuthType        string        `json:"auth_type,omitempty"`
	Suite           string        `json:"suite"`
	Image           string        `json:"image"`
	RunID           string        `json:"run_id"`
	Report          string        `json:"report"`
	Status          string        `json:"status"`
	Summary         string        `json:"summary,omitempty"`
	Results         string        `json:"results,omitempty"`
	DurationSeconds float64       `json:"duration_seconds"`
	Videos          []matrixVideo `json:"videos,omitempty"`
	VideoCount      int           `json:"video_count"`
}
type matrixManifest struct {
	ID     string      `json:"id"`
	Status string      `json:"status"`
	Passed int         `json:"passed"`
	Failed int         `json:"failed"`
	Rows   []matrixRow `json:"rows"`
}

func parseMatrix(args []string) (matrixSelection, bool, error) {
	s := matrixSelection{}
	f := flag.NewFlagSet("matrix", flag.ContinueOnError)
	f.SetOutput(io.Discard)
	f.StringVar(&s.OS, "os", "all", "debian|ubi9|all")
	f.StringVar(&s.Browser, "browser", "all", "chrome|msedge|all")
	f.StringVar(&s.Runner, "runner", "all", "playwright|cucumber|all")
	f.StringVar(&s.User, "user", "all", "customer-waterdeep|shop-admin|shopkeeper|all")
	f.StringVar(&s.Suite, "suite", "all", "teaching|recorded|all")
	plan := f.Bool("plan", false, "show selections without running")
	if err := f.Parse(args); err != nil {
		return s, false, err
	}
	if f.NArg() != 0 {
		return s, false, errors.New("unexpected matrix arguments")
	}
	for _, v := range []struct{ value, allowed string }{{s.OS, "all debian ubi9"}, {s.Browser, "all chrome msedge"}, {s.Runner, "all playwright cucumber"}, {s.User, "all customer-waterdeep shop-admin shopkeeper"}, {s.Suite, "all teaching recorded"}} {
		valid := false
		for _, allowed := range strings.Fields(v.allowed) {
			valid = valid || v.value == allowed
		}
		if !valid {
			return s, false, fmt.Errorf("invalid matrix selection %q (choose %s)", v.value, v.allowed)
		}
	}
	if s.Runner == "cucumber" && (s.User == "shopkeeper" || s.Suite == "recorded") {
		return s, false, errors.New("Cucumber supports teaching customer-waterdeep and shop-admin only")
	}
	return s, *plan, nil
}
func matrixImage(osName string) (string, string) {
	if osName == "ubi9" {
		return "magic-shop-runner-ubi9:01", "testing/container/Runner.ubi9.Containerfile"
	}
	return "magic-shop-runner:03", "testing/container/Runner.Containerfile"
}
func planMatrix(s matrixSelection) []matrixRow {
	var rows []matrixRow
	for _, osName := range []string{"debian", "ubi9"} {
		for _, browser := range []string{"chrome", "msedge"} {
			for _, example := range matrixExamples() {
				row := example
				row.OS = osName
				row.Browser = browser
				if matrixMatches(s, row) {
					row.Image, _ = matrixImage(osName)
					row.Status = "pending"
					row.AuthType = "certificate"
					rows = append(rows, row)
				}
			}
		}
	}
	return rows
}
func matrixExamples() []matrixRow {
	return []matrixRow{
		{Suite: "teaching", Runner: "playwright", User: "customer-waterdeep"},
		{Suite: "teaching", Runner: "playwright", User: "shop-admin"},
		{Suite: "teaching", Runner: "playwright", User: "shopkeeper"},
		{Suite: "teaching", Runner: "cucumber", User: "customer-waterdeep"},
		{Suite: "teaching", Runner: "cucumber", User: "shop-admin"},
		{Suite: "recorded", Runner: "playwright", User: "customer-waterdeep"},
		{Suite: "recorded", Runner: "playwright", User: "shop-admin"},
	}
}
func matrixMatches(s matrixSelection, row matrixRow) bool {
	match := func(selection, value string) bool { return selection == "all" || selection == value }
	return match(s.OS, row.OS) && match(s.Browser, row.Browser) && match(s.Suite, row.Suite) && match(s.Runner, row.Runner) && match(s.User, row.User)
}
func countMatrixVideos(path string) (int, error) {
	videos, err := discoverMatrixVideos(path)
	return len(videos), err
}
func saveMatrix(path string, m matrixManifest) error {
	saved := m
	saved.Rows = append([]matrixRow(nil), m.Rows...)
	for i := range saved.Rows {
		row := &saved.Rows[i]
		report := row.Report
		if !filepath.IsAbs(report) {
			report = filepath.Join(filepath.Dir(path), report)
		}
		videos, err := discoverMatrixVideos(report)
		if err != nil && !os.IsNotExist(err) {
			return err
		}
		row.AuthType = matrixAuthType(*row)
		availableCount := len(videos)
		found := map[string]bool{}
		for _, v := range videos {
			found[v.Path] = true
		}
		for _, v := range row.Videos {
			if !found[v.Path] {
				videos = append(videos, v)
				found[v.Path] = true
			}
		}
		row.Videos = videos
		row.VideoCount = availableCount
		relative, err := filepath.Rel(filepath.Dir(path), report)
		if err != nil {
			return err
		}
		row.Report = filepath.ToSlash(relative)
	}
	data, err := json.MarshalIndent(saved, "", "  ")
	if err != nil {
		return err
	}
	if err = os.WriteFile(path+".tmp", append(data, '\n'), 0644); err != nil {
		return err
	}
	if err = os.Rename(path+".tmp", path); err != nil {
		return err
	}
	if err := saveMatrixMarkdown(path, saved); err != nil {
		return err
	}
	return saveMatrixHTML(path, saved)
}
func (o operator) matrix(args []string) (string, error) {
	s, plan, err := parseMatrix(args)
	if err != nil {
		return "", err
	}
	rows := planMatrix(s)
	if len(rows) == 0 {
		return "", errors.New("matrix selection has no supported combinations")
	}
	if plan {
		data, e := json.MarshalIndent(rows, "", "  ")
		return string(data) + "\n", e
	}
	return o.executeMatrix(s, rows)
}
func (o operator) executeMatrix(s matrixSelection, rows []matrixRow) (string, error) {
	var err error
	id := fmt.Sprintf("%s-os-%s-browser-%s-runner-%s-user-%s-suite-%s", strings.ReplaceAll(time.Now().UTC().Format("20060102T150405.000000000Z"), ".", "-"), s.OS, s.Browser, s.Runner, s.User, s.Suite)
	dir := filepath.Join(o.root, "artifacts", "matrix", id)
	if err = os.MkdirAll(dir, 0755); err != nil {
		return "", err
	}
	m := matrixManifest{ID: id, Status: "running", Rows: rows}
	path := filepath.Join(dir, "matrix.json")
	o.prepareMatrixRows(&m)
	if err = saveMatrix(path, m); err != nil {
		return "", err
	}
	if err = o.executeMatrixRows(path, &m); err != nil {
		return "", err
	}
	return finishMatrix(path, m)
}
func finishMatrix(path string, m matrixManifest) (string, error) {
	if m.Status != "cancelled" {
		m.Status = "passed"
		if m.Failed > 0 {
			m.Status = "failed"
		}
	}
	if err := saveMatrix(path, m); err != nil {
		return "", err
	}
	out := fmt.Sprintf("Matrix %s: %d passed, %d failed, %d pending.\nManifest: %s\nVideos: %s\n", m.Status, m.Passed, m.Failed, len(m.Rows)-m.Passed-m.Failed, path, filepath.Join(filepath.Dir(path), "matrix.html"))
	if m.Status == "cancelled" {
		return out, context.Canceled
	}
	if m.Failed > 0 {
		return out, errors.New("matrix contains failed suites or missing recordings")
	}
	return out, nil
}

func (o operator) runMatrixRow(row *matrixRow) {
	command := []string{"test", "--runner", row.Runner, "--browser", row.Browser, "--user", row.User, "--suite", "teaching"}
	if row.Suite == "recorded" {
		command = []string{"record", row.Browser, row.User}
	}
	_, containerfile := matrixImage(row.OS)
	env := []string{"LAB_RUN_ID=" + row.RunID, "LAB_RUNNER_OS=" + row.OS, "LAB_RUNNER_IMAGE=" + row.Image, "LAB_RUNNER_CONTAINERFILE=" + containerfile}
	start := time.Now()
	raw, runErr := o.invoke(30*time.Minute, filepath.Join(o.root, "lab"), command, env)
	row.DurationSeconds = time.Since(start).Seconds()
	row.Results = strings.TrimSpace(summarizeTest(redact(raw)))
	videos, videoErr := countMatrixVideos(row.Report)
	row.VideoCount = videos
	if runErr != nil {
		row.Status = "failed"
		row.Summary = "suite command failed"
		if cleanupErr := o.cleanupMatrixRow(row); cleanupErr != nil {
			row.Summary += "; owned container cleanup failed"
		}
	} else if videoErr != nil || videos == 0 {
		row.Status = "failed"
		row.Summary = "saved recording missing or unreadable"
	} else {
		row.Status = "passed"
		row.Summary = "suite passed with saved recordings"
	}
}

func (o operator) prepareMatrixRows(m *matrixManifest) {
	for i := range m.Rows {
		row := &m.Rows[i]
		row.RunID = fmt.Sprintf("%s-os-%s-%s-%s-%s-%s-%02d", strings.ReplaceAll(time.Now().UTC().Format("20060102T150405.000000000Z"), ".", "-"), row.OS, row.Runner, row.Browser, row.User, row.Suite, i+1)
		category := "teaching"
		if row.Suite == "recorded" {
			category = "playwright"
		}
		row.Report = filepath.Join(o.root, "artifacts", category, row.RunID)
	}
}

func (o operator) executeMatrixRows(path string, m *matrixManifest) error {
	for i := range m.Rows {
		if o.ctx != nil && o.ctx.Err() != nil {
			m.Status = "cancelled"
			break
		}
		row := &m.Rows[i]
		row.Status = "running"
		if err := saveMatrix(path, *m); err != nil {
			return err
		}
		o.runMatrixRow(row)
		o.recordMatrixResult(m, row)
		if err := saveMatrix(path, *m); err != nil {
			return err
		}
		if m.Status == "cancelled" {
			break
		}
	}
	return nil
}

func (o operator) recordMatrixResult(m *matrixManifest, row *matrixRow) {
	if row.Status == "passed" {
		m.Passed++
	} else {
		m.Failed++
	}
	if o.ctx != nil && o.ctx.Err() != nil {
		row.Summary = strings.Replace(row.Summary, "suite command failed", "suite cancelled", 1)
		m.Status = "cancelled"
	}
}

// Cleanup is scoped to this row's generated container name, never the project.
func (o operator) cleanupMatrixRow(row *matrixRow) error {
	cleanup := o
	cleanup.ctx = context.Background()
	output, err := cleanup.invoke(30*time.Second, "docker", []string{"rm", "--force", "lab-browser-" + row.RunID}, nil)
	if err != nil && strings.Contains(strings.ToLower(output), "no such container") {
		return nil
	}
	return err
}

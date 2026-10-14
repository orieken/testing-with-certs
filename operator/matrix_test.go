package main

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"testing"
)

func TestMatrixPlans(t *testing.T) {
	for _, tt := range []struct {
		args  []string
		count int
	}{{nil, 28}, {[]string{"--suite", "teaching"}, 20}, {[]string{"--os", "ubi9"}, 14}, {[]string{"--browser", "chrome", "--runner", "cucumber"}, 4}, {[]string{"--suite", "recorded"}, 8}} {
		s, _, err := parseMatrix(tt.args)
		if err != nil {
			t.Fatal(err)
		}
		if got := len(planMatrix(s)); got != tt.count {
			t.Fatalf("%v got %d want %d", tt.args, got, tt.count)
		}
	}
	for _, args := range [][]string{{"--runner", "cucumber", "--user", "shopkeeper"}, {"--runner", "cucumber", "--suite", "recorded"}, {"--os", "fedora"}, {"extra"}} {
		if _, _, err := parseMatrix(args); err == nil {
			t.Fatalf("accepted %v", args)
		}
	}
}
func TestMatrixPlanHasNoSideEffects(t *testing.T) {
	root := t.TempDir()
	op := operator{root: root, run: func(context.Context, string, []string, []string) (string, error) {
		t.Fatal("plan invoked process")
		return "", nil
	}}
	out, err := op.matrix([]string{"--plan"})
	if err != nil {
		t.Fatal(err)
	}
	var rows []matrixRow
	if err = json.Unmarshal([]byte(out), &rows); err != nil || len(rows) != 28 {
		t.Fatalf("invalid plan: %v", err)
	}
	entries, _ := os.ReadDir(root)
	if len(entries) > 0 {
		t.Fatal("plan wrote files")
	}
}
func TestMatrixExecution(t *testing.T) {
	for _, mode := range []string{"failed", "missing", "passed", "cancelled"} {
		t.Run(mode, func(t *testing.T) {
			root := t.TempDir()
			ctx, cancel := context.WithCancel(context.Background())
			defer cancel()
			calls := 0
			cleanupCalls := 0
			lastRunID := ""
			op := operator{root: root, ctx: ctx, project: "test", run: func(runCtx context.Context, name string, args, env []string) (string, error) {
				if name == "docker" {
					cleanupCalls++
					if runCtx.Err() != nil {
						t.Fatal("cleanup inherited cancelled context")
					}
					if len(args) != 3 || args[0] != "rm" || args[1] != "--force" || args[2] != "lab-browser-"+lastRunID {
						t.Fatalf("unsafe cleanup %v", args)
					}
					if _, ok := runCtx.Deadline(); !ok {
						t.Fatal("cleanup has no timeout")
					}
					return "Error response from daemon: No such container", errors.New("exit status 1")
				}
				calls++
				vars := map[string]string{}
				for _, item := range env {
					k, v, _ := strings.Cut(item, "=")
					vars[k] = v
				}
				lastRunID = vars["LAB_RUN_ID"]
				if !regexp.MustCompile(`^[a-zA-Z0-9_-]+$`).MatchString(vars["LAB_RUN_ID"]) {
					t.Fatalf("invalid run ID %q", vars["LAB_RUN_ID"])
				}
				if vars["LAB_RUNNER_OS"] != "debian" || vars["LAB_RUNNER_IMAGE"] != "magic-shop-runner:03" || vars["LAB_RUNNER_CONTAINERFILE"] != "testing/container/Runner.Containerfile" || !strings.Contains(vars["LAB_RUN_ID"], "-os-debian-") {
					t.Fatalf("wrong env %v", env)
				}
				if name != filepath.Join(root, "lab") || args[0] != "record" {
					t.Fatalf("wrong invocation %s %v", name, args)
				}
				if mode == "failed" {
					return "secret output", errors.New("private failure")
				}
				if mode == "cancelled" {
					cancel()
					return "", context.Canceled
				}
				if mode == "passed" {
					dir := filepath.Join(root, "artifacts", "playwright", vars["LAB_RUN_ID"], "videos")
					if err := os.MkdirAll(dir, 0755); err != nil {
						t.Fatal(err)
					}
					if err := os.WriteFile(filepath.Join(dir, "video.webm"), []byte("recording"), 0644); err != nil {
						t.Fatal(err)
					}
				}
				return "", nil
			}}
			_, err := op.matrix([]string{"--os", "debian", "--browser", "chrome", "--suite", "recorded"})
			if mode == "passed" && err != nil || mode != "passed" && err == nil {
				t.Fatalf("mode %s error %v", mode, err)
			}
			expected := 2
			if mode == "cancelled" {
				expected = 1
			}
			if mode == "failed" || mode == "cancelled" {
				if cleanupCalls != expected {
					t.Fatalf("cleanup calls %d", cleanupCalls)
				}
			} else if cleanupCalls != 0 {
				t.Fatal("successful process triggered cleanup")
			}
			if calls != expected {
				t.Fatalf("calls %d want %d", calls, expected)
			}
			paths, _ := filepath.Glob(filepath.Join(root, "artifacts", "matrix", "*", "matrix.json"))
			if len(paths) != 1 {
				t.Fatal(paths)
			}
			markdown, markdownErr := os.ReadFile(filepath.Join(filepath.Dir(paths[0]), "matrix.md"))
			if markdownErr != nil || !strings.Contains(string(markdown), "| debian | chrome | playwright |") || strings.Contains(string(markdown), "secret") {
				t.Fatalf("missing or unsafe matrix Markdown: %v", markdownErr)
			}
			data, _ := os.ReadFile(paths[0])
			var m matrixManifest
			if err = json.Unmarshal(data, &m); err != nil {
				t.Fatal(err)
			}
			status := mode
			if mode == "missing" {
				status = "failed"
			}
			if m.Status != status || strings.Contains(string(data), "secret") || strings.Contains(string(data), "private") {
				t.Fatalf("wrong/unsafe manifest %s", data)
			}
			if mode == "passed" && (m.Passed != 2 || m.Rows[0].VideoCount != 1) {
				t.Fatalf("wrong successes %s", data)
			}
			if mode == "cancelled" && m.Rows[1].Status != "pending" {
				t.Fatalf("pending row lost %s", data)
			}
		})
	}
}

func TestMatrixCleanupFailureSummary(t *testing.T) {
	for _, runErr := range []error{context.Canceled, context.DeadlineExceeded} {
		op := operator{root: t.TempDir(), run: func(ctx context.Context, name string, args, env []string) (string, error) {
			if name == "docker" {
				return "private Docker daemon failure", errors.New("cleanup failed")
			}
			return "", runErr
		}}
		row := matrixRow{OS: "ubi9", Browser: "chrome", Runner: "playwright", User: "shop-admin", Suite: "recorded", RunID: "safe-owned-run"}
		op.runMatrixRow(&row)
		if row.Status != "failed" || row.Summary != "suite command failed; owned container cleanup failed" {
			t.Fatalf("wrong summary %q", row.Summary)
		}
	}
}

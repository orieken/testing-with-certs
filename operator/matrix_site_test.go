package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestPortableSiteWhitelistAndRelocation(t *testing.T) {
	root := t.TempDir()
	report := filepath.Join(root, "private-source")
	os.MkdirAll(report, 0755)
	os.WriteFile(filepath.Join(report, "one.webm"), []byte("video fixture"), 0644)
	os.WriteFile(filepath.Join(report, "credentials.key"), []byte("must never copy"), 0644)
	os.WriteFile(filepath.Join(report, "video-cases.json"), []byte(`{"evidence":"verified-authentication-video-cases","cases":[{"path":"one.webm","name":"login","spec":"login.spec.ts","status":"passed"}]}`), 0644)
	manifest := matrixManifest{ID: "verified-run", Status: "passed", Rows: []matrixRow{{Status: "passed", OS: "debian", Browser: "chrome", Runner: "playwright", Report: report, Results: "private diagnostic must not publish"}}}
	data, _ := json.Marshal(manifest)
	source := filepath.Join(root, "matrix.json")
	os.WriteFile(source, data, 0644)
	dest := filepath.Join(root, "site")
	op := operator{root: root}
	if _, err := op.matrixSite([]string{source, dest}); err != nil {
		t.Fatal(err)
	}
	for _, name := range []string{"matrix.json", "matrix.html", "index.html"} {
		b, _ := os.ReadFile(filepath.Join(dest, name))
		if strings.Contains(string(b), root) || strings.Contains(string(b), "private diagnostic") {
			t.Fatal("private source data leaked")
		}
	}
	relocated := filepath.Join(root, "moved")
	os.Rename(dest, relocated)
	if _, err := os.Stat(filepath.Join(relocated, "reports/verified-run/selection-001/video-0001.webm")); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(filepath.Join(relocated, "reports/verified-run/selection-001/credentials.key")); !os.IsNotExist(err) {
		t.Fatal("copied unapproved source file")
	}
	if _, err := op.matrixSite([]string{source, relocated}); err == nil {
		t.Fatal("overwrote destination")
	}
	manifest.Rows[0].Status = "failed"
	data, _ = json.Marshal(manifest)
	os.WriteFile(source, data, 0644)
	if _, err := op.matrixSite([]string{source, dest}); err == nil {
		t.Fatal("published failed selection")
	}
	if _, err := os.Stat(dest); !os.IsNotExist(err) {
		t.Fatal("failed build left publishable output")
	}
	manifest.Rows[0].Status = "passed"
	manifest.ID = "next-run"
	data, _ = json.Marshal(manifest)
	os.WriteFile(source, data, 0644)
	if _, err := op.matrixSite([]string{source, dest}); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(filepath.Join(dest, "reports/next-run/selection-001/video-0001.webm")); err != nil {
		t.Fatal("new release reused the previous media URL", err)
	}
	manifest.ID = "../escape"
	data, _ = json.Marshal(manifest)
	os.WriteFile(source, data, 0644)
	if _, err := op.matrixSite([]string{source, filepath.Join(root, "unsafe")}); err == nil {
		t.Fatal("accepted an escaping release identifier")
	}
}

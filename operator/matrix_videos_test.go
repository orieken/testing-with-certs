package main

import (
	"encoding/json"
	"html"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"testing"
)

func TestMatrixVideoGalleryAndRelocation(t *testing.T) {
	root := t.TempDir()
	report := filepath.Join(root, "artifacts", "teaching", "run-one")
	for _, name := range []string{"test-results/case-one/video.webm", "test-results/case-one/popup.MP4", "html/data/copy.webm", "videos/a # & name.webm", "videos/empty.webm"} {
		path := filepath.Join(report, filepath.FromSlash(name))
		if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
			t.Fatal(err)
		}
		contents := []byte("recording")
		if strings.Contains(name, "empty") {
			contents = nil
		}
		if err := os.WriteFile(path, contents, 0644); err != nil {
			t.Fatal(err)
		}
	}
	dir := filepath.Join(root, "artifacts", "matrix", "saved")
	os.MkdirAll(dir, 0755)
	path := filepath.Join(dir, "matrix.json")
	m := matrixManifest{Status: "passed", Passed: 1, Rows: []matrixRow{{OS: "debian", Browser: "chrome", Runner: "playwright", User: "<script>bad</script>", Suite: "teaching", RunID: "run-one", Report: report, Status: "passed"}, {Report: filepath.Join(root, "artifacts", "teaching", "missing"), Status: "pending"}}}
	if err := saveMatrix(path, m); err != nil {
		t.Fatal(err)
	}
	data, _ := os.ReadFile(path)
	var saved matrixManifest
	if err := json.Unmarshal(data, &saved); err != nil {
		t.Fatal(err)
	}
	if filepath.IsAbs(saved.Rows[0].Report) || len(saved.Rows[0].Videos) != 4 || saved.Rows[0].VideoCount != 4 {
		t.Fatalf("nonportable or incomplete manifest: %s", data)
	}
	page, _ := os.ReadFile(filepath.Join(dir, "matrix.html"))
	s := string(page)
	for _, want := range []string{"4 available videos", "popup.MP4", "a%20%23%20&amp;%20name.webm", "Report folder missing or expired", "preload=\"none\"", "download>Download", "&lt;script&gt;"} {
		if !strings.Contains(s, want) {
			t.Fatalf("missing %q in gallery", want)
		}
	}
	if strings.Contains(s, "<script>bad") || strings.Contains(s, "#ZgotmplZ") || strings.Contains(s, "empty.webm") {
		t.Fatal("unsafe or empty video in gallery")
	}
	// Every emitted source must resolve to a real recording, not just a count.
	for _, match := range regexp.MustCompile(`<source src="([^"]+)"`).FindAllStringSubmatch(s, -1) {
		link, err := url.Parse(html.UnescapeString(match[1]))
		if err != nil {
			t.Fatal(err)
		}
		info, err := os.Stat(filepath.Join(dir, filepath.FromSlash(link.Path)))
		if err != nil || info.Size() == 0 {
			t.Fatalf("broken recording link %s", match[1])
		}
	}
	// The full artifacts tree may be copied out of CI, without its original host path.
	moved := t.TempDir()
	os.Rename(filepath.Join(root, "artifacts"), filepath.Join(moved, "artifacts"))
	movedPath := filepath.Join(moved, "artifacts", "matrix", "saved", "matrix.json")
	if _, err := (operator{root: moved}).matrixReport([]string{movedPath}); err != nil {
		t.Fatal(err)
	}
	// Also rebase old absolute manifests, not just newly relative ones.
	saved.Rows[0].Report = filepath.Join("/old-checkout", "artifacts", "teaching", "run-one")
	b, _ := json.Marshal(saved)
	os.WriteFile(movedPath, b, 0644)
	if _, err := (operator{root: moved}).matrixReport([]string{movedPath}); err != nil {
		t.Fatal(err)
	}
}

func TestMatrixVideosRejectSymlinksAndEscapes(t *testing.T) {
	root := t.TempDir()
	report := filepath.Join(root, "artifacts", "videos")
	os.MkdirAll(report, 0755)
	os.Symlink("/etc/passwd", filepath.Join(report, "outside.webm"))
	if _, err := discoverMatrixVideos(report); err == nil {
		t.Fatal("accepted linked video")
	}
	path := filepath.Join(root, "matrix.json")
	b, _ := json.Marshal(matrixManifest{Rows: []matrixRow{{Report: "/etc"}}})
	os.WriteFile(path, b, 0644)
	if _, err := (operator{root: root}).matrixReport([]string{path}); err == nil {
		t.Fatal("accepted report outside artifacts")
	}
}

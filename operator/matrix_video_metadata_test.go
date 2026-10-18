package main

import (
	"archive/zip"
	"bytes"
	"encoding/base64"
	"os"
	"path/filepath"
	"testing"
)

func writeVideoMetadata(t *testing.T, root, payload string) {
	t.Helper()
	var compressed bytes.Buffer
	archive := zip.NewWriter(&compressed)
	entry, err := archive.Create("file-id.json")
	if err != nil {
		t.Fatal(err)
	}
	entry.Write([]byte(payload))
	archive.Close()
	os.MkdirAll(filepath.Join(root, "html"), 0755)
	os.WriteFile(filepath.Join(root, "html", "index.html"), []byte(`<template>data:application/zip;base64,`+base64.StdEncoding.EncodeToString(compressed.Bytes())+`</template>`), 0644)
}
func TestVideoCaseMetadataAndCopies(t *testing.T) {
	root := t.TempDir()
	os.MkdirAll(filepath.Join(root, "html", "data"), 0755)
	os.MkdirAll(filepath.Join(root, "videos"), 0755)
	for _, name := range []string{"html/data/login.webm", "videos/original.webm"} {
		os.WriteFile(filepath.Join(root, name), []byte("real login recording"), 0644)
	}
	writeVideoMetadata(t, root, `{"fileName":"login.spec.ts","tests":[{"title":"Correct certificate signs in","results":[{"status":"passed","attachments":[{"path":"data/login.webm","contentType":"video/webm"}]}]}]}`)
	videos, err := discoverMatrixVideos(root)
	if err != nil {
		t.Fatal(err)
	}
	cases, err := matrixVideoCases(root, videos)
	if err != nil {
		t.Fatal(err)
	}
	for _, v := range videos {
		if cases[v.Path] != (videoCase{"login.spec.ts", "Correct certificate signs in", "passed"}) {
			t.Fatalf("wrong metadata %v", cases)
		}
	}
	// Actual test results, including skips and timeouts, take precedence over suite success.
	writeVideoMetadata(t, root, `{"fileName":"login.spec.ts","tests":[{"title":"Expired certificate","results":[{"status":"timedOut","attachments":[{"path":"data/login.webm","contentType":"video/webm"}]}]}]}`)
	cases, err = matrixVideoCases(root, videos)
	if err != nil || cases["videos/original.webm"].Status != "failed" {
		t.Fatalf("lost timeout: %v %v", cases, err)
	}
}
func TestAmbiguousVideoCopiesStayUnlinked(t *testing.T) {
	root := t.TempDir()
	os.MkdirAll(filepath.Join(root, "html", "data"), 0755)
	os.MkdirAll(filepath.Join(root, "videos"), 0755)
	for _, name := range []string{"html/data/first.webm", "html/data/second.webm", "videos/unknown.webm"} {
		os.WriteFile(filepath.Join(root, name), []byte("same bytes"), 0644)
	}
	writeVideoMetadata(t, root, `{"fileName":"login.spec.ts","tests":[{"title":"First","results":[{"status":"passed","attachments":[{"path":"data/first.webm","contentType":"video/webm"}]}]},{"title":"Second","results":[{"status":"skipped","attachments":[{"path":"data/second.webm","contentType":"video/webm"}]}]}]}`)
	videos, _ := discoverMatrixVideos(root)
	cases, err := matrixVideoCases(root, videos)
	if err != nil {
		t.Fatal(err)
	}
	if _, ok := cases["videos/unknown.webm"]; ok {
		t.Fatal("guessed case for ambiguous copy")
	}
	if cases["html/data/second.webm"].Status != "skipped" {
		t.Fatal("lost explicit skipped result")
	}
}

func TestMissingIndexedRecordingRetainsCase(t *testing.T) {
	root := t.TempDir()
	os.WriteFile(filepath.Join(root, "video-cases.json"), []byte(`{"evidence":"verified-authentication-video-cases","cases":[{"path":"videos/expired.webm","name":"Exact scenario","spec":"login.feature","status":"passed"}]}`), 0600)
	cases, err := matrixVideoCases(root, nil)
	if err != nil || cases["videos/expired.webm"].Name != "Exact scenario" {
		t.Fatalf("lost missing case: %v %v", cases, err)
	}
	manifest := matrixManifest{Rows: []matrixRow{{Report: root, Runner: "cucumber", Status: "passed"}}}
	if err := saveMatrixHTML(filepath.Join(root, "matrix.json"), manifest); err != nil {
		t.Fatal(err)
	}
	html, _ := os.ReadFile(filepath.Join(root, "matrix.html"))
	if !bytes.Contains(html, []byte("Missing or expired recording")) || !bytes.Contains(html, []byte("Exact scenario")) || bytes.Contains(html, []byte("<source src=")) {
		t.Fatal("missing recording must retain identity without a broken player")
	}
	os.MkdirAll(filepath.Join(root, "videos"), 0700)
	os.WriteFile(filepath.Join(root, "videos", "expired.webm"), []byte("restored"), 0600)
	if err := saveMatrixHTML(filepath.Join(root, "matrix.json"), manifest); err != nil {
		t.Fatal(err)
	}
	html, _ = os.ReadFile(filepath.Join(root, "matrix.html"))
	if !bytes.Contains(html, []byte("<source src=")) || bytes.Contains(html, []byte("Missing or expired recording")) {
		t.Fatal("restored recording must become playable")
	}
}

func TestRecordingIndexRejectsEscapingPath(t *testing.T) {
	root := t.TempDir()
	os.WriteFile(filepath.Join(root, "video-cases.json"), []byte(`{"evidence":"verified-authentication-video-cases","cases":[{"path":"../outside.webm"}]}`), 0600)
	if _, err := matrixVideoCases(root, nil); err == nil {
		t.Fatal("accepted escaping path")
	}
}

func TestRebuildKeepsMissingManifestPaths(t *testing.T) {
	root := t.TempDir()
	report := filepath.Join(root, "gone")
	path := filepath.Join(root, "matrix.json")
	m := matrixManifest{Rows: []matrixRow{{Report: report, Videos: []matrixVideo{{Path: "videos/saved.webm"}}, Status: "passed"}}}
	if err := saveMatrix(path, m); err != nil {
		t.Fatal(err)
	}
	data, _ := os.ReadFile(path)
	if !bytes.Contains(data, []byte("videos/saved.webm")) || !bytes.Contains(data, []byte(`"video_count": 0`)) {
		t.Fatalf("lost missing path or incorrect available count: %s", data)
	}
}

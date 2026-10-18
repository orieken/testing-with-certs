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

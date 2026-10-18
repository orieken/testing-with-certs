package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

func TestMergeRecordingMatrices(t *testing.T) {
	root := t.TempDir()
	dir := filepath.Join(root, "artifacts", "matrix")
	os.MkdirAll(dir, 0755)
	target := filepath.Join(dir, "matrix.json")
	source := filepath.Join(dir, "recording-matrix.json")
	row := matrixRow{AuthType: "saml", Report: filepath.Join(root, "artifacts", "recordings"), Status: "passed"}
	for path, m := range map[string]matrixManifest{target: {ID: "existing", Rows: []matrixRow{}}, source: {Rows: []matrixRow{row}}} {
		b, _ := json.Marshal(m)
		os.WriteFile(path, b, 0644)
	}
	op := operator{root: root}
	for range 2 {
		if _, err := op.matrixMerge([]string{target, source}); err != nil {
			t.Fatal(err)
		}
	}
	b, _ := os.ReadFile(target)
	var m matrixManifest
	json.Unmarshal(b, &m)
	if len(m.Rows) != 1 || m.Passed != 1 || m.Rows[0].AuthType != "saml" {
		t.Fatalf("invalid merge %s", b)
	}
	row.Report = "/etc"
	b, _ = json.Marshal(matrixManifest{Rows: []matrixRow{row}})
	os.WriteFile(source, b, 0644)
	if _, err := op.matrixMerge([]string{target, source}); err == nil {
		t.Fatal("accepted escaped report")
	}
}
func TestRecordedVideoCaseIndex(t *testing.T) {
	root := t.TempDir()
	os.WriteFile(filepath.Join(root, "one.webm"), []byte("fixture"), 0644)
	os.WriteFile(filepath.Join(root, "video-cases.json"), []byte(`{"evidence":"verified-authentication-video-cases","cases":[{"path":"one.webm","name":"saml:refresh-preserves-role","spec":"teaching/saml.mjs","status":"passed"}]}`), 0644)
	cases, err := matrixVideoCases(root, []matrixVideo{{Path: "one.webm"}})
	if err != nil || cases["one.webm"].Name != "saml:refresh-preserves-role" {
		t.Fatalf("wrong case metadata %v %v", cases, err)
	}
	if cases, err := matrixVideoCases(root, nil); err != nil || cases["one.webm"].Name != "saml:refresh-preserves-role" {
		t.Fatal("missing video lost its saved case metadata")
	}
}

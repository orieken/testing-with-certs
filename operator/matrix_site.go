package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
)

// Export only video files and allowlisted case fields. Raw HTML reports may hold
// embedded archives, so copying an entire source report is deliberately avoided.
func (o operator) matrixSite(args []string) (string, error) {
	if len(args) != 2 {
		return "", errors.New("usage: matrix-site MATRIX.json NEW-SITE-DIRECTORY")
	}
	source, dest := args[0], args[1]
	if !filepath.IsAbs(source) {
		source = filepath.Join(o.root, source)
	}
	if !filepath.IsAbs(dest) {
		dest = filepath.Join(o.root, dest)
	}
	if _, err := os.Lstat(dest); !os.IsNotExist(err) {
		return "", errors.New("site destination must not exist")
	}
	data, err := os.ReadFile(source)
	if err != nil {
		return "", err
	}
	var original matrixManifest
	if json.Unmarshal(data, &original) != nil || original.Status != "passed" || len(original.Rows) == 0 {
		return "", errors.New("site requires a passing matrix")
	}
	if err = os.MkdirAll(dest, 0755); err != nil {
		return "", err
	}
	accepted := false
	defer func() {
		if !accepted {
			os.RemoveAll(dest)
		}
	}()
	site := matrixManifest{ID: original.ID, Status: "passed"}
	var bytes int64
	videos := 0
	for i, row := range original.Rows {
		if row.Status != "passed" {
			return "", errors.New("site cannot publish unfinished or failed selections")
		}
		exported, n, size, err := exportSiteRow(filepath.Dir(source), dest, i, row)
		if err != nil {
			return "", err
		}
		bytes += size
		videos += n
		if bytes > 900_000_000 {
			return "", errors.New("site exceeds conservative GitHub Pages size budget")
		}
		site.Rows = append(site.Rows, exported)
		site.Passed++
	}
	if err = saveMatrix(filepath.Join(dest, "matrix.json"), site); err != nil {
		return "", err
	}
	if err = os.WriteFile(filepath.Join(dest, "matrix.md"), []byte("# Verified test matrix\n\n[Watch recordings](index.html) · [Selection metadata](matrix.json)\n"), 0644); err != nil {
		return "", err
	}
	html, err := os.ReadFile(filepath.Join(dest, "matrix.html"))
	if err != nil {
		return "", err
	}
	for _, name := range []string{"index.html", ".nojekyll"} {
		body := html
		if name == ".nojekyll" {
			body = nil
		}
		if err = os.WriteFile(filepath.Join(dest, name), body, 0644); err != nil {
			return "", err
		}
	}
	accepted = true
	return fmt.Sprintf("Portable matrix site: %d selections, %d videos, %d video bytes\n", site.Passed, videos, bytes), nil
}

func exportSiteRow(base, dest string, index int, row matrixRow) (matrixRow, int, int64, error) {
	report := row.Report
	if !filepath.IsAbs(report) {
		report = filepath.Join(base, report)
	}
	info, err := os.Lstat(report)
	if err != nil || !info.IsDir() || info.Mode()&os.ModeSymlink != 0 {
		return matrixRow{}, 0, 0, errors.New("invalid site source report")
	}
	videos, err := discoverMatrixVideos(report)
	if err != nil {
		return matrixRow{}, 0, 0, err
	}
	if len(videos) == 0 {
		return matrixRow{}, 0, 0, errors.New("site selection has no videos")
	}
	cases, err := matrixVideoCases(report, videos)
	if err != nil {
		return matrixRow{}, 0, 0, err
	}
	target := filepath.Join(dest, "reports", fmt.Sprintf("selection-%03d", index+1))
	if err = os.MkdirAll(target, 0755); err != nil {
		return matrixRow{}, 0, 0, err
	}
	entries := []map[string]string{}
	var size int64
	for i, video := range videos {
		metadata, ok := cases[video.Path]
		if !ok || metadata.Name == "" || metadata.Spec == "" || (metadata.Status != "passed" && metadata.Status != "skipped") {
			return matrixRow{}, 0, 0, errors.New("unverified site video metadata")
		}
		name := fmt.Sprintf("video-%04d%s", i+1, filepath.Ext(video.Path))
		n, err := copySiteVideo(filepath.Join(report, video.Path), filepath.Join(target, name))
		if err != nil {
			return matrixRow{}, 0, 0, err
		}
		size += n
		entries = append(entries, map[string]string{"path": name, "name": metadata.Name, "spec": metadata.Spec, "status": metadata.Status})
	}
	data, err := json.MarshalIndent(map[string]any{"evidence": "verified-authentication-video-cases", "cases": entries}, "", "  ")
	if err != nil {
		return matrixRow{}, 0, 0, err
	}
	if err = os.WriteFile(filepath.Join(target, "video-cases.json"), data, 0644); err != nil {
		return matrixRow{}, 0, 0, err
	}
	return matrixRow{OS: row.OS, Browser: row.Browser, Runner: row.Runner, User: row.User, AuthType: matrixAuthType(row), Suite: row.Suite, RunID: row.RunID, Report: target, Status: "passed", Summary: "Verified passing selection; portable recordings", DurationSeconds: row.DurationSeconds}, len(videos), size, nil
}

func copySiteVideo(source, target string) (int64, error) {
	info, err := os.Lstat(source)
	if err != nil {
		return 0, err
	}
	if !info.Mode().IsRegular() || info.Size() == 0 || info.Size() > 95_000_000 {
		return 0, errors.New("invalid or oversized site video")
	}
	input, err := os.Open(source)
	if err != nil {
		return 0, err
	}
	defer input.Close()
	output, err := os.OpenFile(target, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0644)
	if err != nil {
		return 0, err
	}
	n, copyErr := io.Copy(output, input)
	closeErr := output.Close()
	if copyErr != nil {
		return n, copyErr
	}
	return n, closeErr
}

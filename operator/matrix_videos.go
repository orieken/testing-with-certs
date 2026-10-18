package main

import (
	_ "embed"
	"encoding/json"
	"errors"
	"fmt"
	"html/template"
	"io/fs"
	"net/url"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

type matrixVideo struct {
	Path string `json:"path"`
}

type matrixGalleryRow struct {
	Selection                        string
	Status                           string
	RunID                            string
	Report                           string
	Notice                           string
	OS, Browser, Runner, User, Suite string
	AuthType, AuthLabel              string
	Videos                           []matrixGalleryVideo
}
type matrixGalleryVideo struct{ Label, URL, Spec, Name, Status, Availability string }

func localReportURL(base, target string) (string, error) {
	relative, err := filepath.Rel(base, target)
	if err != nil {
		return "", err
	}
	return (&url.URL{Path: filepath.ToSlash(relative)}).String(), nil
}

// Paths are relative to the row's report directory, including HTML report copies.
func discoverMatrixVideos(root string) ([]matrixVideo, error) {
	videos := []matrixVideo{}
	err := filepath.WalkDir(root, func(path string, entry fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if entry.Type()&os.ModeSymlink != 0 {
			return errors.New("matrix recordings must not contain symlinks")
		}
		if entry.IsDir() {
			return nil
		}
		ext := strings.ToLower(filepath.Ext(path))
		if ext != ".webm" && ext != ".mp4" {
			return nil
		}
		info, err := entry.Info()
		if err != nil {
			return err
		}
		if !info.Mode().IsRegular() || info.Size() == 0 {
			return nil
		}
		relative, err := filepath.Rel(root, path)
		if err != nil {
			return err
		}
		videos = append(videos, matrixVideo{Path: filepath.ToSlash(relative)})
		return nil
	})
	return videos, err
}

func saveMatrixHTML(path string, m matrixManifest) error {
	rows := []matrixGalleryRow{}
	for _, row := range m.Rows {
		report := row.Report
		if !filepath.IsAbs(report) {
			report = filepath.Join(filepath.Dir(path), report)
		}
		gallery := matrixGalleryRow{Selection: strings.Join([]string{row.OS, row.Browser, row.Runner, row.User, row.Suite}, " / "), Status: row.Status, RunID: row.RunID, OS: row.OS, Browser: row.Browser, Runner: row.Runner, User: row.User, Suite: row.Suite, AuthType: matrixAuthType(row), AuthLabel: matrixAuthLabel(matrixAuthType(row))}
		videos, err := discoverMatrixVideos(report)
		switch {
		case os.IsNotExist(err):
			gallery.Notice = "Report folder missing or expired. Restore its artifacts and rebuild this report."
		case err != nil:
			return err
		case len(videos) == 0:
			gallery.Notice = "No saved recordings available. Recording may be disabled, pending, or removed."
		}
		reportFile := filepath.Join(report, "html", "index.html")
		if row.Runner == "cucumber" {
			reportFile = filepath.Join(report, "cucumber.json")
		}
		if info, err := os.Stat(reportFile); err == nil && info.Mode().IsRegular() {
			gallery.Report, err = localReportURL(filepath.Dir(path), reportFile)
			if err != nil {
				return err
			}
		}
		cases, err := matrixVideoCases(report, videos)
		if err != nil {
			return err
		}
		fallback := "Spec unavailable"
		if row.Runner == "cucumber" {
			fallback = cucumberSpec(report)
		}
		available := map[string]bool{}
		for _, v := range videos {
			available[v.Path] = true
		}
		for _, v := range row.Videos {
			if !available[v.Path] {
				clean := filepath.ToSlash(filepath.Clean(filepath.FromSlash(v.Path)))
				if clean != v.Path || filepath.IsAbs(v.Path) || clean == ".." || strings.HasPrefix(clean, "../") {
					return fmt.Errorf("invalid saved video path")
				}
				videos = append(videos, v)
				available[v.Path] = false
			}
		}
		for path := range cases {
			if _, exists := available[path]; !exists {
				videos = append(videos, matrixVideo{Path: path})
				available[path] = false
			}
		}
		sort.Slice(videos, func(i, j int) bool { return videos[i].Path < videos[j].Path })
		for _, video := range videos {
			link, err := localReportURL(filepath.Dir(path), filepath.Join(report, filepath.FromSlash(video.Path)))
			if err != nil {
				return err
			}
			metadata, ok := cases[video.Path]
			if !ok {
				metadata = videoCase{fallback, "Recording without scenario metadata", "unlinked"}
			}
			availability := "available"
			if !available[video.Path] {
				link = ""
				availability = "Missing or expired recording"
			}
			gallery.Videos = append(gallery.Videos, matrixGalleryVideo{Availability: availability, Label: video.Path, URL: link, Spec: metadata.Spec, Name: metadata.Name, Status: metadata.Status})
		}
		disabled, err := matrixDisabledRecordingCases(report)
		if err != nil {
			return err
		}
		for _, c := range disabled {
			gallery.Videos = append(gallery.Videos, matrixGalleryVideo{Label: "Recording disabled by producer", Spec: c.Spec, Name: c.Name, Status: c.Status, Availability: "Recording intentionally disabled"})
		}
		rows = append(rows, gallery)
	}
	t, err := template.New("matrix").Parse(matrixGalleryTemplate)
	if err != nil {
		return err
	}
	destination := filepath.Join(filepath.Dir(path), "matrix.html")
	file, err := os.Create(destination + ".tmp")
	if err != nil {
		return err
	}
	err = t.Execute(file, struct {
		Manifest  matrixManifest
		Rows      []matrixGalleryRow
		Total     int
		AuthTypes []matrixAuthOption
	}{m, rows, func() int {
		total := 0
		for _, r := range rows {
			for _, v := range r.Videos {
				if v.URL != "" {
					total++
				}
			}
		}
		return total
	}(), matrixAuthOptions(rows)})
	closeErr := file.Close()
	if err != nil {
		return err
	}
	if closeErr != nil {
		return closeErr
	}
	return os.Rename(destination+".tmp", destination)
}

// Rebuilds saved reports without running tests. Rebase historical absolute paths
// onto this checkout's artifacts tree when artifacts have been relocated.
func (o operator) matrixReport(args []string) (string, error) {
	if len(args) != 1 {
		return "", errors.New("usage: matrix-report PATH/TO/matrix.json")
	}
	path := args[0]
	if !filepath.IsAbs(path) {
		path = filepath.Join(o.root, path)
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return "", err
	}
	var m matrixManifest
	if err = json.Unmarshal(data, &m); err != nil {
		return "", err
	}
	if len(m.Rows) == 0 {
		return "", errors.New("matrix has no selections")
	}
	for i := range m.Rows {
		row := &m.Rows[i]
		report := row.Report
		if !filepath.IsAbs(report) {
			report = filepath.Join(filepath.Dir(path), report)
		}
		if _, err := os.Stat(report); os.IsNotExist(err) && filepath.IsAbs(row.Report) {
			marker := string(filepath.Separator) + "artifacts" + string(filepath.Separator)
			if _, suffix, ok := strings.Cut(row.Report, marker); ok {
				report = filepath.Join(o.root, "artifacts", suffix)
			}
		}
		artifactRoot := filepath.Join(o.root, "artifacts")
		relative, err := filepath.Rel(artifactRoot, report)
		if err != nil || relative == ".." || strings.HasPrefix(relative, ".."+string(filepath.Separator)) {
			return "", errors.New("matrix report must remain inside artifacts")
		}
		if resolved, err := filepath.EvalSymlinks(report); err == nil {
			rel, err := filepath.Rel(artifactRoot, resolved)
			if err != nil || rel == ".." || strings.HasPrefix(rel, ".."+string(filepath.Separator)) {
				return "", errors.New("matrix report symlink escapes artifacts")
			}
		}
		row.Report = report
	}
	if err = saveMatrix(path, m); err != nil {
		return "", err
	}
	return fmt.Sprintf("Video report: %s\n", filepath.Join(filepath.Dir(path), "matrix.html")), nil
}

//go:embed matrix_gallery.html
var matrixGalleryTemplate string

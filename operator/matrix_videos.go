package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"html/template"
	"io/fs"
	"net/url"
	"os"
	"path/filepath"
	"strings"
)

type matrixVideo struct {
	Path string `json:"path"`
}

type matrixGalleryRow struct {
	Selection string
	Status    string
	RunID     string
	Report    string
	Notice    string
	Videos    []matrixGalleryVideo
}
type matrixGalleryVideo struct{ Label, URL string }

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
		gallery := matrixGalleryRow{Selection: strings.Join([]string{row.OS, row.Browser, row.Runner, row.User, row.Suite}, " / "), Status: row.Status, RunID: row.RunID}
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
		for _, video := range videos {
			link, err := localReportURL(filepath.Dir(path), filepath.Join(report, filepath.FromSlash(video.Path)))
			if err != nil {
				return err
			}
			gallery.Videos = append(gallery.Videos, matrixGalleryVideo{Label: video.Path, URL: link})
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
		Manifest matrixManifest
		Rows     []matrixGalleryRow
	}{m, rows})
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

const matrixGalleryTemplate = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Browser matrix recordings</title><style>
body{font:16px system-ui,sans-serif;margin:0;background:#f5f6fa;color:#17233b}main{max-width:1200px;margin:auto;padding:32px}h1{margin-bottom:8px}p{line-height:1.5}a{color:#1858b5}section{background:white;border:1px solid #d9dfeb;border-radius:12px;margin:20px 0;padding:20px}h2{font-size:18px;overflow-wrap:anywhere}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr));gap:18px}figure{margin:0;min-width:0}video{width:100%;background:#111;border-radius:6px}figcaption{overflow-wrap:anywhere;font-size:14px;line-height:1.6}.notice{padding:12px;background:#fff4d5;border-radius:6px}.run{font-size:13px;overflow-wrap:anywhere;color:#526079}.status{font-weight:600}
</style></head><body><main><h1>Browser matrix recordings</h1>
<p class="status">{{.Manifest.Status}} · {{.Manifest.Passed}} passed · {{.Manifest.Failed}} failed</p>
<p>Every saved recording under each selection is listed, including HTML report copies and multiple pages. Counts represent files, not unique scenarios. File paths identify their source; recordings without case metadata are associated with their suite only.</p>
<p><a href="matrix.md">Matrix table</a> · <a href="matrix.json">Manifest</a></p>
<p>Separate authentication and certificate/password acceptance reports disable recording to protect credential material. They are not part of these certificate-shop matrix selections.</p>
{{range .Rows}}<section><h2>{{.Selection}}</h2><p class="status">{{.Status}} · {{len .Videos}} available videos</p><p class="run">Run: {{.RunID}}</p>{{if .Report}}<p><a href="{{.Report}}">Open suite report</a></p>{{end}}
{{if .Notice}}<p class="notice">{{.Notice}}</p>{{end}}
<div class="grid">{{range .Videos}}<figure><video controls preload="none" playsinline><source src="{{.URL}}">Your browser cannot play this recording. Use its download link.</video><figcaption>{{.Label}}<br><a href="{{.URL}}" download>Download recording</a></figcaption></figure>{{end}}</div></section>{{end}}
</main></body></html>`

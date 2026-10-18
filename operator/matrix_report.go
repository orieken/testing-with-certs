package main

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

func saveMatrixMarkdown(path string, m matrixManifest) error {
	var report strings.Builder
	fmt.Fprintf(&report, "# Browser container matrix\n\nStatus: **%s**. %d passed, %d failed, %d pending.\n\n", m.Status, m.Passed, m.Failed, len(m.Rows)-m.Passed-m.Failed)
	report.WriteString("[Watch all saved videos](matrix.html)\n\n")
	report.WriteString("| OS | Browser | Runner | User | Suite | Result | Video files | Report |\n| --- | --- | --- | --- | --- | --- | --- | --- |\n")
	for _, row := range m.Rows {
		reportPath := row.Report
		if !filepath.IsAbs(reportPath) {
			reportPath = filepath.Join(filepath.Dir(path), reportPath)
		}
		relative, err := filepath.Rel(filepath.Dir(path), reportPath)
		if err != nil {
			return err
		}
		destination := filepath.Join(relative, "html", "index.html")
		if row.Runner == "cucumber" {
			destination = filepath.Join(relative, "cucumber.json")
		}
		fmt.Fprintf(&report, "| %s | %s | %s | %s | %s | %s | %d | [Open](%s) |\n", row.OS, row.Browser, row.Runner, row.User, row.Suite, row.Status, row.VideoCount, filepath.ToSlash(destination))
	}
	report.WriteString("\nVideo-file counts include copies stored by HTML reports; they do not equal unique scenario counts. Full statuses, durations, summaries and report paths are in [matrix.json](matrix.json).\n")
	destination := filepath.Join(filepath.Dir(path), "matrix.md")
	if err := os.WriteFile(destination+".tmp", []byte(report.String()), 0644); err != nil {
		return err
	}
	return os.Rename(destination+".tmp", destination)
}

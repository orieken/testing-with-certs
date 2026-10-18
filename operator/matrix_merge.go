package main

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"strings"
)

func (o operator) matrixMerge(args []string) (string, error) {
	if len(args) < 2 {
		return "", errors.New("usage: matrix-merge MATRIX.json RECORDING-MATRIX.json [...]")
	}
	var merged matrixManifest
	seen := map[string]int{}
	target := args[0]
	if !filepath.IsAbs(target) {
		target = filepath.Join(o.root, target)
	}
	for i, arg := range args {
		path := arg
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
		if i == 0 {
			merged.ID = m.ID
		}
		for _, row := range m.Rows {
			if !filepath.IsAbs(row.Report) {
				row.Report = filepath.Join(filepath.Dir(path), row.Report)
			}
			rel, err := filepath.Rel(filepath.Join(o.root, "artifacts"), row.Report)
			if err != nil || rel == ".." || strings.HasPrefix(rel, ".."+string(filepath.Separator)) {
				return "", errors.New("report outside artifacts")
			}
			if resolved, err := filepath.EvalSymlinks(row.Report); err == nil {
				rel, err = filepath.Rel(filepath.Join(o.root, "artifacts"), resolved)
				if err != nil || rel == ".." || strings.HasPrefix(rel, ".."+string(filepath.Separator)) {
					return "", errors.New("report link escapes artifacts")
				}
			}
			if index, ok := seen[row.Report]; ok {
				merged.Rows[index] = row
			} else {
				seen[row.Report] = len(merged.Rows)
				merged.Rows = append(merged.Rows, row)
			}
		}
	}
	merged.Status = "passed"
	for _, row := range merged.Rows {
		if row.Status == "passed" {
			merged.Passed++
		} else if row.Status == "failed" {
			merged.Failed++
			merged.Status = "failed"
		} else if merged.Status != "failed" {
			merged.Status = "running"
		}
	}
	if err := saveMatrix(target, merged); err != nil {
		return "", err
	}
	return "Merged video report: " + filepath.Join(filepath.Dir(target), "matrix.html") + "\n", nil
}

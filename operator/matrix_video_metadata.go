package main

import (
	"archive/zip"
	"bytes"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

type videoCase struct{ Spec, Name, Status string }
type playwrightVideoFile struct {
	FileName string `json:"fileName"`
	Tests    []struct {
		Title    string `json:"title"`
		Location struct {
			File string `json:"file"`
		} `json:"location"`
		Results []struct {
			Status      string `json:"status"`
			Attachments []struct {
				Path        string `json:"path"`
				ContentType string `json:"contentType"`
			} `json:"attachments"`
		} `json:"results"`
	} `json:"tests"`
}

var playwrightZip = regexp.MustCompile(`data:application/zip;base64,([A-Za-z0-9+/=]+)`)

func videoResult(status string) string {
	switch strings.ToLower(status) {
	case "passed":
		return "passed"
	case "failed", "timedout", "interrupted", "ambiguous", "undefined":
		return "failed"
	case "skipped", "pending":
		return "skipped"
	default:
		return "unlinked"
	}
}
func videoDigest(path string) (string, error) {
	f, err := os.Open(path)
	if err != nil {
		return "", err
	}
	defer f.Close()
	h := sha256.New()
	if _, err = io.Copy(h, f); err != nil {
		return "", err
	}
	return fmt.Sprintf("%x", h.Sum(nil)), nil
}

// Read only known metadata fields, never render report errors, steps, or token material.
func matrixVideoCases(root string, videos []matrixVideo) (map[string]videoCase, error) {
	mapped := map[string]videoCase{}
	data, err := os.ReadFile(filepath.Join(root, "html", "index.html"))
	if os.IsNotExist(err) {
		return mapped, nil
	}
	if err != nil {
		return nil, err
	}
	if len(data) > 20_000_000 {
		return nil, fmt.Errorf("matrix source report exceeds size bound")
	}
	match := playwrightZip.FindSubmatch(data)
	if len(match) == 0 {
		return mapped, nil
	}
	decoded, err := base64.StdEncoding.DecodeString(string(match[1]))
	if err != nil {
		return nil, fmt.Errorf("invalid matrix source report archive")
	}
	archive, err := zip.NewReader(bytes.NewReader(decoded), int64(len(decoded)))
	if err != nil {
		return nil, fmt.Errorf("invalid matrix source report archive")
	}
	available := map[string]bool{}
	for _, v := range videos {
		available[v.Path] = true
	}
	for _, entry := range archive.File {
		if entry.Name == "report.json" || !strings.HasSuffix(entry.Name, ".json") {
			continue
		}
		if entry.UncompressedSize64 > 20_000_000 {
			return nil, fmt.Errorf("matrix source metadata exceeds size bound")
		}
		stream, err := entry.Open()
		if err != nil {
			return nil, err
		}
		var file playwrightVideoFile
		err = json.NewDecoder(io.LimitReader(stream, 20_000_001)).Decode(&file)
		stream.Close()
		if err != nil {
			return nil, fmt.Errorf("invalid matrix test metadata")
		}
		for _, test := range file.Tests {
			for _, result := range test.Results {
				for _, attachment := range result.Attachments {
					relative := filepath.ToSlash(filepath.Clean(filepath.Join("html", attachment.Path)))
					if !available[relative] || !strings.HasPrefix(attachment.ContentType, "video/") {
						continue
					}
					spec := test.Location.File
					if spec == "" {
						spec = file.FileName
					}
					mapped[relative] = videoCase{spec, test.Title, videoResult(result.Status)}
				}
			}
		}
	}
	// Associate byte-identical copies only when their metadata is unambiguous.
	hashes := map[string]videoCase{}
	ambiguous := map[string]bool{}
	for path, metadata := range mapped {
		digest, err := videoDigest(filepath.Join(root, filepath.FromSlash(path)))
		if err != nil {
			return nil, err
		}
		if prior, ok := hashes[digest]; ok && prior != metadata {
			ambiguous[digest] = true
		}
		hashes[digest] = metadata
	}
	for _, v := range videos {
		if _, ok := mapped[v.Path]; ok {
			continue
		}
		digest, err := videoDigest(filepath.Join(root, filepath.FromSlash(v.Path)))
		if err != nil {
			return nil, err
		}
		if metadata, ok := hashes[digest]; ok && !ambiguous[digest] {
			mapped[v.Path] = metadata
		}
	}
	return mapped, nil
}

func cucumberSpec(root string) string {
	data, err := os.ReadFile(filepath.Join(root, "cucumber.json"))
	if err != nil || len(data) > 20_000_000 {
		return "Spec unavailable"
	}
	var features []struct {
		URI string `json:"uri"`
	}
	if json.Unmarshal(data, &features) != nil {
		return "Spec unavailable"
	}
	spec := ""
	for _, feature := range features {
		if spec != "" && feature.URI != spec {
			return "Multiple feature files"
		}
		spec = feature.URI
	}
	if spec == "" {
		return "Spec unavailable"
	}
	return spec
}

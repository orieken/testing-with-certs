package main

import "testing"

func TestMatrixAuthTypes(t *testing.T) {
	for _, row := range planMatrix(matrixSelection{OS: "all", Browser: "all", Runner: "all", User: "all", Suite: "all"}) {
		if matrixAuthType(row) != "certificate" {
			t.Fatal("wrong planned auth type")
		}
		row.AuthType = ""
		if matrixAuthType(row) != "certificate" {
			t.Fatal("lost historical certificate selection")
		}
	}
	for _, kind := range matrixAuthKinds {
		row := matrixRow{AuthType: kind.ID, Suite: "teaching", Runner: "playwright", User: "shop-admin"}
		if matrixAuthType(row) != kind.ID {
			t.Fatal("explicit auth type overridden")
		}
	}
	for _, row := range []matrixRow{{AuthType: "made-up"}, {Suite: "saml", Runner: "playwright", User: "test-user"}, {}} {
		if matrixAuthType(row) != "unknown" {
			t.Fatal("guessed unsupported auth type")
		}
	}
	options := matrixAuthOptions([]matrixGalleryRow{{AuthType: "certificate", Videos: make([]matrixGalleryVideo, 3)}, {AuthType: "saml", Videos: make([]matrixGalleryVideo, 2)}})
	for _, kind := range options {
		expected := 0
		if kind.ID == "certificate" {
			expected = 3
		}
		if kind.ID == "saml" {
			expected = 2
		}
		if kind.Count != expected {
			t.Fatalf("wrong count for %s", kind.ID)
		}
	}
}

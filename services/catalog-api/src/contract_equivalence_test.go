package main

import (
	"encoding/json"
	"magic-shop/catalog-api/internal/domain"
	"os"
	"reflect"
	"sort"
	"testing"
)

func TestCatalogTransportMatchesCanonicalFieldsAndOperations(t *testing.T) {
	raw, err := os.ReadFile("../contract/catalog.json")
	if err != nil {
		t.Fatal(err)
	}
	var spec struct {
		Paths map[string]map[string]struct {
			OperationID string `json:"operationId"`
		} `json:"paths"`
		Components struct {
			Schemas map[string]struct {
				Properties map[string]any `json:"properties"`
			} `json:"schemas"`
		} `json:"components"`
	}
	if err = json.Unmarshal(raw, &spec); err != nil {
		t.Fatal(err)
	}
	operations := make([]string, 0)
	for _, methods := range spec.Paths {
		for _, op := range methods {
			operations = append(operations, op.OperationID)
		}
	}
	sort.Strings(operations)
	expected := []string{"archiveItem", "createItem", "getItem", "listItems", "quoteItems", "updateItem"}
	if !reflect.DeepEqual(operations, expected) {
		t.Fatalf("operation inventory drift: %v", operations)
	}
	tags := make([]string, 0)
	typ := reflect.TypeOf(domain.Item{})
	for i := 0; i < typ.NumField(); i++ {
		tag := typ.Field(i).Tag.Get("json")
		for j, c := range tag {
			if c == ',' {
				tag = tag[:j]
				break
			}
		}
		tags = append(tags, tag)
	}
	sort.Strings(tags)
	fields := make([]string, 0)
	for name := range spec.Components.Schemas["Item"].Properties {
		fields = append(fields, name)
	}
	sort.Strings(fields)
	if !reflect.DeepEqual(tags, fields) {
		t.Fatalf("item response fields drift: Go=%v OpenAPI=%v", tags, fields)
	}
}

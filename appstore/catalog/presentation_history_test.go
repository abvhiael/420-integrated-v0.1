package catalog

import (
	"errors"
	"os"
	"path/filepath"
	"testing"

	"github.com/420integrated/420-integrated/appstore/curation"
)

func TestPresentationHistoryIsAppendOnlyPerService(t *testing.T) {
	store, err := OpenPresentationHistory(filepath.Join(t.TempDir(), "presentation-history.json"))
	if err != nil {
		t.Fatal(err)
	}
	first, err := store.Append(curation.Metadata{
		ServiceID:   "420/SERVICE/DEMO/V1",
		Description: "first",
		Categories:  []string{"Tools"},
	})
	if err != nil {
		t.Fatal(err)
	}
	second, err := store.Append(curation.Metadata{
		ServiceID:   "420/service/demo/v1",
		Description: "second",
		Categories:  []string{"tools", "Social"},
	})
	if err != nil {
		t.Fatal(err)
	}
	if first.Revision != 1 || second.Revision != 2 {
		t.Fatalf("unexpected revisions: first=%d second=%d", first.Revision, second.Revision)
	}
	doc, err := store.Load()
	if err != nil {
		t.Fatal(err)
	}
	if len(doc.Revisions) != 2 || doc.Revisions[0].Metadata.Description != "first" || doc.Revisions[1].Metadata.Description != "second" {
		t.Fatalf("history was rewritten: %#v", doc.Revisions)
	}
}

func TestPresentationHistoryCannotOverrideCanonicalFacts(t *testing.T) {
	store, _ := OpenPresentationHistory(filepath.Join(t.TempDir(), "presentation-history.json"))
	_, err := store.Append(curation.Metadata{
		ServiceID:    "420/service/demo/v1",
		Presentation: map[string]string{"implementation": "0xdead"},
	})
	if !errors.Is(err, curation.ErrCanonicalOverride) {
		t.Fatalf("expected canonical override rejection, got %v", err)
	}
}

func TestPresentationHistoryRejectsPrivateLaunchHistory(t *testing.T) {
	store, _ := OpenPresentationHistory(filepath.Join(t.TempDir(), "presentation-history.json"))
	_, err := store.Append(curation.Metadata{
		ServiceID:    "420/service/demo/v1",
		Presentation: map[string]string{"launchHistory": "wallet-123"},
	})
	if err == nil {
		t.Fatal("expected private launch-history rejection")
	}
}

func TestPresentationHistoryCorruptionFailsClosed(t *testing.T) {
	path := filepath.Join(t.TempDir(), "presentation-history.json")
	if err := os.WriteFile(path, []byte(`{"schemaVersion":1,"revisions":[{"serviceId":"420/service/demo/v1","revision":2,"metadata":{"serviceId":"420/service/demo/v1"}}]}`), 0o600); err != nil {
		t.Fatal(err)
	}
	store, _ := OpenPresentationHistory(path)
	if _, err := store.Load(); !errors.Is(err, ErrPresentationHistoryCorrupt) {
		t.Fatalf("expected corruption rejection, got %v", err)
	}
}

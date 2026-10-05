package main

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"

	appstoreapi "github.com/420integrated/420-integrated/appstore/api"
	appstorecatalog "github.com/420integrated/420-integrated/appstore/catalog"
	appstoreregistry "github.com/420integrated/420-integrated/appstore/registry"
	appstoreruntime "github.com/420integrated/420-integrated/appstore/runtime"
)

type mainSnapshotSource struct {
	snapshot appstoreregistry.Snapshot
}

func (s mainSnapshotSource) Snapshot(context.Context) (appstoreregistry.Snapshot, error) {
	return s.snapshot, nil
}

func mainCanonicalSnapshot() appstoreregistry.Snapshot {
	return appstoreregistry.Snapshot{
		ChainID:         420,
		RegistryAddress: "0x0000000000000000000000000000000000000434",
		FinalizedBlock:  100,
		Versions: []appstoreregistry.VersionRecord{{
			ServiceID:      "420/service/demo/v1",
			Version:        1,
			Implementation: "0x1111111111111111111111111111111111111111",
			CodeHash:       "0x" + strings.Repeat("a", 64),
			MetadataHash:   "0x" + strings.Repeat("b", 64),
			Active:         true,
			BlockNumber:    10,
			BlockHash:      "0x" + strings.Repeat("c", 64),
		}},
	}
}

func TestRebuildApplicationViewsUsesQualifiedCatalogueState(t *testing.T) {
	dir := t.TempDir()
	store, err := appstorecatalog.Open(filepath.Join(dir, "catalog.json"))
	if err != nil {
		t.Fatal(err)
	}
	snapshot := mainCanonicalSnapshot()
	lifecycle, err := appstorecatalog.NewLifecycle(store, mainSnapshotSource{snapshot: snapshot}, snapshot.ChainID, snapshot.RegistryAddress)
	if err != nil {
		t.Fatal(err)
	}
	if err := lifecycle.Bootstrap(context.Background()); err != nil {
		t.Fatal(err)
	}

	inputPath := filepath.Join(dir, "view-inputs.json")
	if err := os.WriteFile(inputPath, []byte(`{
  "schemaVersion": 1,
  "applications": [{
    "serviceId": "420/service/demo/v1",
    "curation": {"description": "demo"},
    "wallet": {"appUrl": "https://demo.example/app"},
    "links": {"explorer": "https://explorer.example/demo"}
  }]
}`), 0o600); err != nil {
		t.Fatal(err)
	}

	cfg := appstoreruntime.Config{ChainID: 420, ViewInputs: inputPath}
	views := appstoreapi.NewViewSet()
	if err := rebuildApplicationViews(cfg, lifecycle, views); err != nil {
		t.Fatal(err)
	}
	got := views.Snapshot()
	if len(got) != 1 {
		t.Fatalf("views=%d", len(got))
	}
	if got[0].Listing.Canonical.Implementation != snapshot.Versions[0].Implementation {
		t.Fatalf("canonical implementation changed: %#v", got[0].Listing.Canonical)
	}
	if got[0].Listing.Curation.Description != "demo" || got[0].Links.Direct != "https://demo.example/app" {
		t.Fatalf("presentation inputs not composed: %#v", got[0])
	}
}

func TestRebuildApplicationViewsRejectsInvalidReplacementWithoutChangingViewSet(t *testing.T) {
	dir := t.TempDir()
	store, _ := appstorecatalog.Open(filepath.Join(dir, "catalog.json"))
	snapshot := mainCanonicalSnapshot()
	lifecycle, _ := appstorecatalog.NewLifecycle(store, mainSnapshotSource{snapshot: snapshot}, snapshot.ChainID, snapshot.RegistryAddress)
	if err := lifecycle.Bootstrap(context.Background()); err != nil {
		t.Fatal(err)
	}
	inputPath := filepath.Join(dir, "view-inputs.json")
	if err := os.WriteFile(inputPath, []byte(`{"schemaVersion":1}`), 0o600); err != nil {
		t.Fatal(err)
	}
	cfg := appstoreruntime.Config{ChainID: 420, ViewInputs: inputPath}
	views := appstoreapi.NewViewSet()
	if err := rebuildApplicationViews(cfg, lifecycle, views); err != nil {
		t.Fatal(err)
	}
	before := views.Snapshot()

	if err := os.WriteFile(inputPath, []byte(`{
  "schemaVersion":1,
  "applications":[{
    "serviceId":"420/service/demo/v1",
    "wallet":{"appUrl":"https://demo.example/app","signature":"0xdead"}
  }]
}`), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := rebuildApplicationViews(cfg, lifecycle, views); err == nil {
		t.Fatal("expected invalid replacement to fail")
	}
	after := views.Snapshot()
	if len(before) != len(after) || after[0].Listing.Canonical.ServiceID != before[0].Listing.Canonical.ServiceID {
		t.Fatalf("failed replacement changed retained views: before=%#v after=%#v", before, after)
	}
}

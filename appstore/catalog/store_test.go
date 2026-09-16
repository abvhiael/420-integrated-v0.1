package catalog

import (
	"errors"
	"os"
	"path/filepath"
	"testing"

	appregistry "github.com/420integrated/420-integrated/appstore/registry"
)

func sampleSnapshot() appregistry.Snapshot {
	return appregistry.Snapshot{
		ChainID: 420,
		RegistryAddress: "0x0000000000000000000000000000000000000420",
		FinalizedBlock: 99,
		Versions: []appregistry.VersionRecord{{
			ServiceID: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
			Version: 1,
			Implementation: "0x0000000000000000000000000000000000001234",
			CodeHash: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
			MetadataHash: "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
			Active: true,
			BlockNumber: 10,
			BlockHash: "0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
		}},
	}
}

func TestSaveLoadRestoreRoundTrip(t *testing.T) {
	dir := t.TempDir()
	store, err := Open(filepath.Join(dir, "catalog.json")); if err != nil { t.Fatal(err) }
	doc, err := RebuildFromSnapshot(sampleSnapshot()); if err != nil { t.Fatal(err) }
	if err := store.Save(doc); err != nil { t.Fatal(err) }
	loaded, err := store.Load(); if err != nil { t.Fatal(err) }
	projection, err := RestoreProjection(loaded); if err != nil { t.Fatal(err) }
	if projection.FinalizedBlock() != 99 { t.Fatalf("finalized block = %d", projection.FinalizedBlock()) }
	if _, ok := projection.Version(sampleSnapshot().Versions[0].ServiceID, 1); !ok { t.Fatal("version not restored") }
}

func TestRebuildCanonicalizesAndSortsRecordsBeforeReturn(t *testing.T) {
	snapshot := sampleSnapshot()
	alpha := snapshot.Versions[0]
	alpha.ServiceID = "  0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA  "
	alpha.Implementation = "0x000000000000000000000000000000000000ABCD"
	alpha.CodeHash = "0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB"
	alpha.MetadataHash = "0xCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC"
	alpha.BlockHash = "0xDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD"
	beta := alpha
	beta.ServiceID = "420/SERVICE/BETA/V1"
	beta.Version = 1
	beta.Implementation = "0x000000000000000000000000000000000000BCDE"
	beta.BlockNumber = 11
	beta.BlockHash = "0xEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE"
	alpha.ServiceID = "420/SERVICE/ALPHA/V1"
	alpha.BlockNumber = 10
	snapshot.Versions = []appregistry.VersionRecord{beta, alpha}
	snapshot.FinalizedBlock = 11

	doc, err := RebuildFromSnapshot(snapshot)
	if err != nil { t.Fatal(err) }
	if len(doc.Versions) != 2 { t.Fatalf("versions=%d", len(doc.Versions)) }
	if doc.Versions[0].ServiceID != "420/service/alpha/v1" || doc.Versions[1].ServiceID != "420/service/beta/v1" {
		t.Fatalf("records not canonically sorted: %#v", doc.Versions)
	}
	if doc.Versions[0].Implementation != "0x000000000000000000000000000000000000abcd" {
		t.Fatalf("implementation not canonicalized: %q", doc.Versions[0].Implementation)
	}
	if doc.Versions[0].CodeHash != "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" ||
		doc.Versions[0].MetadataHash != "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc" ||
		doc.Versions[0].BlockHash != "0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd" {
		t.Fatalf("hash fields not canonicalized: %#v", doc.Versions[0])
	}
}

func TestLoadMissing(t *testing.T) {
	store, err := Open(filepath.Join(t.TempDir(), "missing.json")); if err != nil { t.Fatal(err) }
	_, err = store.Load()
	if !errors.Is(err, os.ErrNotExist) { t.Fatalf("expected os.ErrNotExist, got %v", err) }
}

func TestLoadCorruptFailsClosed(t *testing.T) {
	path := filepath.Join(t.TempDir(), "catalog.json")
	if err := os.WriteFile(path, []byte("not-json"), 0o600); err != nil { t.Fatal(err) }
	store, _ := Open(path)
	_, err := store.Load()
	if !errors.Is(err, ErrStoreCorrupt) { t.Fatalf("expected ErrStoreCorrupt, got %v", err) }
}

func TestUnsupportedSchemaFailsClosed(t *testing.T) {
	path := filepath.Join(t.TempDir(), "catalog.json")
	if err := os.WriteFile(path, []byte(`{"schemaVersion":99,"chainId":420,"registryAddress":"0x0000000000000000000000000000000000000420","finalizedBlock":1,"versions":[]}`), 0o600); err != nil { t.Fatal(err) }
	store, _ := Open(path)
	_, err := store.Load()
	if !errors.Is(err, ErrUnsupportedSchema) { t.Fatalf("expected ErrUnsupportedSchema, got %v", err) }
}

func TestRestoreRejectsTamperedCanonicalRecord(t *testing.T) {
	doc, err := RebuildFromSnapshot(sampleSnapshot()); if err != nil { t.Fatal(err) }
	doc.Versions[0].BlockHash = "0x1234"
	if _, err := RestoreProjection(doc); !errors.Is(err, ErrStoreCorrupt) { t.Fatalf("expected ErrStoreCorrupt, got %v", err) }
}

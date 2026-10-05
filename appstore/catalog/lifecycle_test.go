package catalog

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"testing"

	appregistry "github.com/420integrated/420-integrated/appstore/registry"
)

type lifecycleSource func(context.Context) (appregistry.Snapshot, error)

func (f lifecycleSource) Snapshot(ctx context.Context) (appregistry.Snapshot, error) {
	return f(ctx)
}

func lifecycleSnapshot(finalized uint64, active bool) appregistry.Snapshot {
	s := sampleSnapshot()
	s.FinalizedBlock = finalized
	s.Versions[0].Active = active
	return s
}

func TestLifecycleBootstrapMissingStoreRebuildsAndPersists(t *testing.T) {
	path := filepath.Join(t.TempDir(), "catalog.json")
	store, _ := Open(path)
	source := lifecycleSource(func(context.Context) (appregistry.Snapshot, error) {
		return lifecycleSnapshot(99, true), nil
	})
	lifecycle, err := NewLifecycle(store, source, 420, sampleSnapshot().RegistryAddress)
	if err != nil {
		t.Fatal(err)
	}
	if err := lifecycle.Bootstrap(context.Background()); err != nil {
		t.Fatal(err)
	}
	doc, ok := lifecycle.Snapshot()
	if !ok || doc.FinalizedBlock != 99 {
		t.Fatalf("unexpected lifecycle snapshot: %#v ok=%v", doc, ok)
	}
	if _, err := os.Stat(path); err != nil {
		t.Fatalf("catalogue not persisted: %v", err)
	}
}

func TestLifecycleBootstrapRestoresThenAdvancesFromCanonicalSource(t *testing.T) {
	path := filepath.Join(t.TempDir(), "catalog.json")
	store, _ := Open(path)
	old, _ := RebuildFromSnapshot(lifecycleSnapshot(99, true))
	if err := store.Save(old); err != nil {
		t.Fatal(err)
	}
	fresh := lifecycleSnapshot(120, false)
	source := lifecycleSource(func(context.Context) (appregistry.Snapshot, error) {
		return fresh, nil
	})
	lifecycle, _ := NewLifecycle(store, source, 420, fresh.RegistryAddress)
	if err := lifecycle.Bootstrap(context.Background()); err != nil {
		t.Fatal(err)
	}
	doc, _ := lifecycle.Snapshot()
	if doc.FinalizedBlock != 120 || doc.Versions[0].Active {
		t.Fatalf("canonical refresh not applied: %#v", doc)
	}
	loaded, err := store.Load()
	if err != nil || loaded.FinalizedBlock != 120 || loaded.Versions[0].Active {
		t.Fatalf("persisted refresh mismatch: %#v err=%v", loaded, err)
	}
}

func TestLifecycleRejectsStaleCanonicalSourceAndPreservesDisk(t *testing.T) {
	path := filepath.Join(t.TempDir(), "catalog.json")
	store, _ := Open(path)
	old, _ := RebuildFromSnapshot(lifecycleSnapshot(120, false))
	if err := store.Save(old); err != nil {
		t.Fatal(err)
	}
	source := lifecycleSource(func(context.Context) (appregistry.Snapshot, error) {
		return lifecycleSnapshot(119, false), nil
	})
	lifecycle, _ := NewLifecycle(store, source, 420, old.RegistryAddress)
	if err := lifecycle.Bootstrap(context.Background()); !errors.Is(err, ErrStaleCanonicalSource) {
		t.Fatalf("expected stale source rejection, got %v", err)
	}
	loaded, err := store.Load()
	if err != nil || loaded.FinalizedBlock != 120 {
		t.Fatalf("stale source damaged persisted state: %#v err=%v", loaded, err)
	}
}

func TestLifecycleRejectsFinalizedHistoryRewrite(t *testing.T) {
	path := filepath.Join(t.TempDir(), "catalog.json")
	store, _ := Open(path)
	old, _ := RebuildFromSnapshot(lifecycleSnapshot(120, true))
	if err := store.Save(old); err != nil {
		t.Fatal(err)
	}
	conflict := lifecycleSnapshot(120, true)
	conflict.Versions[0].Implementation = "0x0000000000000000000000000000000000005678"
	source := lifecycleSource(func(context.Context) (appregistry.Snapshot, error) {
		return conflict, nil
	})
	lifecycle, _ := NewLifecycle(store, source, 420, old.RegistryAddress)
	if err := lifecycle.Bootstrap(context.Background()); !errors.Is(err, ErrFinalizedConflict) {
		t.Fatalf("expected finalized conflict, got %v", err)
	}
}

func TestLifecycleCorruptStoreFailsClosed(t *testing.T) {
	path := filepath.Join(t.TempDir(), "catalog.json")
	if err := os.WriteFile(path, []byte("broken"), 0o600); err != nil {
		t.Fatal(err)
	}
	store, _ := Open(path)
	sourceCalled := false
	source := lifecycleSource(func(context.Context) (appregistry.Snapshot, error) {
		sourceCalled = true
		return lifecycleSnapshot(99, true), nil
	})
	lifecycle, _ := NewLifecycle(store, source, 420, sampleSnapshot().RegistryAddress)
	if err := lifecycle.Bootstrap(context.Background()); err == nil {
		t.Fatal("expected corrupt-store failure")
	}
	if sourceCalled {
		t.Fatal("corrupt local state was silently bypassed")
	}
}

func TestLifecycleInterruptedTempFileDoesNotOverrideCanonicalRebuild(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "catalog.json")
	if err := os.WriteFile(filepath.Join(dir, ".catalog.json.tmp-interrupted"), []byte("partial"), 0o600); err != nil {
		t.Fatal(err)
	}
	store, _ := Open(path)
	source := lifecycleSource(func(context.Context) (appregistry.Snapshot, error) {
		return lifecycleSnapshot(99, true), nil
	})
	lifecycle, _ := NewLifecycle(store, source, 420, sampleSnapshot().RegistryAddress)
	if err := lifecycle.Bootstrap(context.Background()); err != nil {
		t.Fatal(err)
	}
	loaded, err := store.Load()
	if err != nil || loaded.FinalizedBlock != 99 {
		t.Fatalf("canonical rebuild did not recover: %#v err=%v", loaded, err)
	}
}

func TestLifecycleRefreshDoesNotSwapStateWhenPersistenceFails(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "catalog.json")
	store, _ := Open(path)
	current := lifecycleSnapshot(99, true)
	next := lifecycleSnapshot(120, false)
	calls := 0
	source := lifecycleSource(func(context.Context) (appregistry.Snapshot, error) {
		calls++
		if calls == 1 {
			return current, nil
		}
		return next, nil
	})
	lifecycle, _ := NewLifecycle(store, source, 420, current.RegistryAddress)
	if err := lifecycle.Bootstrap(context.Background()); err != nil {
		t.Fatal(err)
	}
	if err := os.Remove(path); err != nil {
		t.Fatal(err)
	}
	if err := os.Mkdir(path, 0o700); err != nil {
		t.Fatal(err)
	}
	if err := lifecycle.Refresh(context.Background()); err == nil {
		t.Fatal("expected persistence failure")
	}
	doc, _ := lifecycle.Snapshot()
	if doc.FinalizedBlock != 99 || !doc.Versions[0].Active {
		t.Fatalf("failed persistence swapped live state: %#v", doc)
	}
}

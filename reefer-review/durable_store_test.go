package reeferreview

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"testing"
)

func TestRR5DurableStoreFilePermissionsAndIdempotencyRestart(t *testing.T) {
	path := filepath.Join(t.TempDir(), "state.json")
	store, err := OpenDurableStore(path)
	if err != nil {
		t.Fatal(err)
	}
	if info, err := os.Stat(path); err != nil || info.Mode().Perm() != 0o600 {
		t.Fatalf("durable store permissions: info=%v err=%v", info, err)
	}
	id, err := store.BindIdempotency(context.Background(), "writer.420", "key", "fingerprint")
	if err != nil {
		t.Fatal(err)
	}
	reopened, err := OpenDurableStore(path)
	if err != nil {
		t.Fatal(err)
	}
	id2, err := reopened.BindIdempotency(context.Background(), "writer.420", "key", "fingerprint")
	if err != nil || id2 != id {
		t.Fatalf("idempotency did not survive restart: %q %q %v", id, id2, err)
	}
	if _, err := reopened.BindIdempotency(context.Background(), "writer.420", "key", "different"); !errors.Is(err, ErrConflict) {
		t.Fatalf("conflicting durable idempotency accepted: %v", err)
	}
}

func TestRR5DurableStoreRejectsCorruptionAndFutureSchema(t *testing.T) {
	dir := t.TempDir()
	corrupt := filepath.Join(dir, "corrupt.json")
	if err := os.WriteFile(corrupt, []byte("{not-json"), 0o600); err != nil {
		t.Fatal(err)
	}
	if _, err := OpenDurableStore(corrupt); !errors.Is(err, ErrDurableStoreCorrupt) {
		t.Fatalf("corrupt durable store accepted: %v", err)
	}

	future := filepath.Join(dir, "future.json")
	raw, err := json.Marshal(map[string]any{
		"schema_version": DurableStoreSchemaVersion + 1,
		"publications":   map[string]any{},
		"idempotency":    map[string]any{},
		"revisions":      map[string]any{},
		"moderation":     map[string]any{},
	})
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(future, raw, 0o600); err != nil {
		t.Fatal(err)
	}
	if _, err := OpenDurableStore(future); !errors.Is(err, ErrDurableStoreSchemaNew) {
		t.Fatalf("future schema accepted: %v", err)
	}
}

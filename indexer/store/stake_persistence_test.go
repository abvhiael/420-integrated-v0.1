package store

import (
	"github.com/420integrated/420-integrated/indexer/model"
	"os"
	"path/filepath"
	"testing"
)

func TestCheckpointWriteFailureDoesNotAdvanceMemory(t *testing.T) {
	path := filepath.Join(t.TempDir(), "index.json")
	s, err := NewFileStore(path)
	if err != nil {
		t.Fatal(err)
	}
	if err := s.PutBlock(model.BlockRecord{ChainID: 420, Number: 1, Hash: "a1"}); err != nil {
		t.Fatal(err)
	}
	old := model.ChainCheckpoint{ChainID: 420, IndexedHeight: 1, IndexedHash: "a1"}
	if err := s.SaveCheckpoint(old); err != nil {
		t.Fatal(err)
	}
	// A directory at the temp-file path deterministically rejects the write.
	if err := os.Mkdir(path+".tmp", 0700); err != nil {
		t.Fatal(err)
	}
	next := old
	next.IndexedHeight = 2
	next.IndexedHash = "a2"
	if err := s.SaveCheckpoint(next); err == nil {
		t.Fatal("expected write failure")
	}
	got, _, _ := s.Checkpoint()
	if got != old {
		t.Fatal("failed checkpoint remained in memory")
	}
	reopened, err := NewFileStore(path)
	if err != nil {
		t.Fatal(err)
	}
	got, _, _ = reopened.Checkpoint()
	if got != old {
		t.Fatal("failed checkpoint reached disk")
	}
}

func TestRollbackCheckpointSurvivesRestartBeforeReplay(t *testing.T) {
	path := filepath.Join(t.TempDir(), "index.json")
	s, _ := NewFileStore(path)
	for n := uint64(0); n <= 3; n++ {
		if err := s.PutBlock(model.BlockRecord{ChainID: 420, Number: n, Hash: string(rune('a' + n))}); err != nil {
			t.Fatal(err)
		}
	}
	if err := s.SaveCheckpoint(model.ChainCheckpoint{ChainID: 420, IndexedHeight: 3, IndexedHash: "d", SafeHeight: 2, FinalizedHeight: 1}); err != nil {
		t.Fatal(err)
	}
	if err := s.DeleteBlocksAbove(1); err != nil {
		t.Fatal(err)
	}
	reopened, err := NewFileStore(path)
	if err != nil {
		t.Fatal(err)
	}
	cp, _, _ := reopened.Checkpoint()
	if cp.IndexedHeight != 1 || cp.IndexedHash != "b" || cp.SafeHeight != 1 {
		t.Fatalf("torn rollback checkpoint: %+v", cp)
	}
}

func TestMalformedSnapshotCannotSilentlyResetCheckpoint(t *testing.T) {
	for _, raw := range []string{`null`, `{}`, `{"version":2}`, `{"version":1,"checkpoint":{"chainId":420,"indexedHeight":1,"indexedHash":"a1"}}`} {
		path := filepath.Join(t.TempDir(), "index.json")
		if err := os.WriteFile(path, []byte(raw), 0600); err != nil {
			t.Fatal(err)
		}
		if _, err := NewFileStore(path); err == nil {
			t.Fatalf("accepted malformed snapshot: %s", raw)
		}
	}
}

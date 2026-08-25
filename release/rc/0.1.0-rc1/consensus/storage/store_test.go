package storage

import (
	ctypes "github.com/420integrated/420-integrated/consensus/types"
	"path/filepath"
	"testing"
)

func TestFileStoreRoundTrip(t *testing.T) {
	p := filepath.Join(t.TempDir(), "state.json")
	s := NewFileStore(p)
	var r ctypes.Root
	r[31] = 4
	want := Status{
		Head:      ctypes.Checkpoint{Slot: 9, Root: r},
		Safe:      ctypes.Checkpoint{Slot: 8, Root: r},
		Finalized: ctypes.Checkpoint{Slot: 7, Root: r},
		NextSlot:  10,
	}
	if err := s.Save(want); err != nil {
		t.Fatal(err)
	}
	got, ok, err := s.Load()
	if err != nil || !ok {
		t.Fatalf("ok=%v err=%v", ok, err)
	}
	if got.NextSlot != 10 || got.Finalized.Slot != 7 {
		t.Fatalf("%+v", got)
	}
}

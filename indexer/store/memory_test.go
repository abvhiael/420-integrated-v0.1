package store

import (
	"testing"

	"github.com/420integrated/420-integrated/indexer/model"
)

func TestMemoryStoreCheckpointAndRollback(t *testing.T) {
	s := NewMemory()
	if _, ok, err := s.Checkpoint(); err != nil || ok { t.Fatal("unexpected initial checkpoint") }
	cp := model.ChainCheckpoint{ChainID: 420, IndexedHeight: 2, IndexedHash: "0x02", SchemaVersion: "v1"}
	if err := s.SaveCheckpoint(cp); err != nil { t.Fatal(err) }
	if err := s.PutBlock(model.BlockRecord{ChainID: 420, Number: 1, Hash: "0x01"}); err != nil { t.Fatal(err) }
	if err := s.PutBlock(model.BlockRecord{ChainID: 420, Number: 2, Hash: "0x02"}); err != nil { t.Fatal(err) }
	if err := s.DeleteBlocksAbove(1); err != nil { t.Fatal(err) }
	if _, ok, _ := s.Block(2); ok { t.Fatal("expected block 2 rollback") }
	got, ok, err := s.Checkpoint()
	if err != nil || !ok || got.IndexedHeight != 2 { t.Fatal("checkpoint not preserved") }
}

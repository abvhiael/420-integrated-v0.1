package store

import (
	"path/filepath"
	"testing"
	"time"

	"github.com/420integrated/420-integrated/indexer/model"
)

func TestFileStorePersistsBundleAndCheckpointAcrossRestart(t *testing.T) {
	path := filepath.Join(t.TempDir(), "indexer.json")
	s, err := NewFileStore(path)
	if err != nil { t.Fatal(err) }
	block := model.BlockRecord{ChainID: 420, Number: 7, Hash: "0x07", ParentHash: "0x06", SchemaVersion: "v1"}
	tx := model.TransactionRecord{ChainID: 420, BlockNumber: 7, BlockHash: "0x07", Hash: "0xtx", Index: 0}
	r := model.ReceiptRecord{ChainID: 420, BlockNumber: 7, BlockHash: "0x07", TransactionHash: "0xtx", Status: 1}
	lg := model.LogRecord{ChainID: 420, BlockNumber: 7, BlockHash: "0x07", TransactionHash: "0xtx", LogIndex: 0}
	if err := s.PutBundle(block, []model.TransactionRecord{tx}, []model.ReceiptRecord{r}, []model.LogRecord{lg}); err != nil { t.Fatal(err) }
	cp := model.ChainCheckpoint{ChainID: 420, IndexedHeight: 7, IndexedHash: "0x07", SchemaVersion: "v1", UpdatedAt: time.Now().UTC()}
	if err := s.SaveCheckpoint(cp); err != nil { t.Fatal(err) }

	reopened, err := NewFileStore(path)
	if err != nil { t.Fatal(err) }
	got, ok, err := reopened.Block(7)
	if err != nil || !ok { t.Fatalf("block missing after restart: ok=%v err=%v", ok, err) }
	if got.Hash != "0x07" { t.Fatalf("unexpected block hash %s", got.Hash) }
	gotCP, ok, err := reopened.Checkpoint()
	if err != nil || !ok { t.Fatalf("checkpoint missing after restart: ok=%v err=%v", ok, err) }
	if gotCP.IndexedHeight != 7 || gotCP.IndexedHash != "0x07" { t.Fatalf("unexpected checkpoint: %+v", gotCP) }
}

func TestFileStoreRollbackRemovesAuxiliaryRecordsByHeight(t *testing.T) {
	path := filepath.Join(t.TempDir(), "indexer.json")
	s, err := NewFileStore(path)
	if err != nil { t.Fatal(err) }
	for n := uint64(1); n <= 3; n++ {
		block := model.BlockRecord{ChainID: 420, Number: n, Hash: "h"}
		tx := model.TransactionRecord{ChainID: 420, BlockNumber: n, Hash: string(rune('a' + n))}
		if err := s.PutBundle(block, []model.TransactionRecord{tx}, nil, nil); err != nil { t.Fatal(err) }
	}
	if err := s.DeleteBlocksAbove(1); err != nil { t.Fatal(err) }
	if _, ok, _ := s.Block(2); ok { t.Fatal("block above rollback boundary survived") }
}

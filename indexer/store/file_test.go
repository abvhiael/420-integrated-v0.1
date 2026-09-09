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
	tx := model.TransactionRecord{ChainID: 420, BlockNumber: 7, BlockHash: "0x07", Hash: "0xTx", Index: 0}
	r := model.ReceiptRecord{ChainID: 420, BlockNumber: 7, BlockHash: "0x07", TransactionHash: "0xTx", Status: 1}
	lg := model.LogRecord{ChainID: 420, BlockNumber: 7, BlockHash: "0x07", TransactionHash: "0xTx", LogIndex: 0}
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
	if gotTx, ok, err := reopened.Transaction("0xtx"); err != nil || !ok || gotTx.Hash != "0xTx" { t.Fatalf("transaction lookup failed: %+v ok=%v err=%v", gotTx, ok, err) }
	if gotReceipt, ok, err := reopened.Receipt("0XTX"); err != nil || !ok || gotReceipt.TransactionHash != "0xTx" { t.Fatalf("receipt lookup failed: %+v ok=%v err=%v", gotReceipt, ok, err) }
}

func TestFileStoreLogsByBlockAreDeterministic(t *testing.T) {
	path := filepath.Join(t.TempDir(), "indexer.json")
	s, err := NewFileStore(path)
	if err != nil { t.Fatal(err) }
	block := model.BlockRecord{ChainID: 420, Number: 9, Hash: "0x09"}
	logs := []model.LogRecord{
		{ChainID: 420, BlockNumber: 9, BlockHash: "0x09", TransactionHash: "0xb", TransactionIndex: 1, LogIndex: 3},
		{ChainID: 420, BlockNumber: 9, BlockHash: "0x09", TransactionHash: "0xa", TransactionIndex: 0, LogIndex: 2},
		{ChainID: 420, BlockNumber: 9, BlockHash: "0x09", TransactionHash: "0xa", TransactionIndex: 0, LogIndex: 1},
	}
	if err := s.PutBundle(block, nil, nil, logs); err != nil { t.Fatal(err) }
	got, err := s.LogsByBlock(9)
	if err != nil { t.Fatal(err) }
	if len(got) != 3 || got[0].LogIndex != 1 || got[1].LogIndex != 2 || got[2].TransactionIndex != 1 { t.Fatalf("unexpected log order: %+v", got) }
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

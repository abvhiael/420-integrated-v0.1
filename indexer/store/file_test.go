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

func TestFileStoreResetClearsAllRebuildableStateAndSurvivesRestart(t *testing.T) {
	path := filepath.Join(t.TempDir(), "indexer.json")
	s, err := NewFileStore(path)
	if err != nil { t.Fatal(err) }
	block := model.BlockRecord{ChainID: 420, Number: 9, Hash: "0x09"}
	tx := model.TransactionRecord{ChainID: 420, BlockNumber: 9, Hash: "0xABC"}
	r := model.ReceiptRecord{ChainID: 420, BlockNumber: 9, TransactionHash: "0xABC"}
	lg := model.LogRecord{ChainID: 420, BlockNumber: 9, TransactionHash: "0xABC", LogIndex: 1}
	if err := s.PutBundle(block, []model.TransactionRecord{tx}, []model.ReceiptRecord{r}, []model.LogRecord{lg}); err != nil { t.Fatal(err) }
	if err := s.SaveCheckpoint(model.ChainCheckpoint{ChainID: 420, IndexedHeight: 9, IndexedHash: "0x09"}); err != nil { t.Fatal(err) }
	if err := s.Reset(); err != nil { t.Fatal(err) }

	reopened, err := NewFileStore(path)
	if err != nil { t.Fatal(err) }
	if _, ok, _ := reopened.Checkpoint(); ok { t.Fatal("checkpoint survived reset") }
	if _, ok, _ := reopened.Block(9); ok { t.Fatal("block survived reset") }
	if _, ok, _ := reopened.Transaction("0xabc"); ok { t.Fatal("transaction survived reset") }
	if _, ok, _ := reopened.Receipt("0xabc"); ok { t.Fatal("receipt survived reset") }
	logs, err := reopened.LogsByBlock(9)
	if err != nil { t.Fatal(err) }
	if len(logs) != 0 { t.Fatalf("logs survived reset: %d", len(logs)) }
}


func TestCanonicalBlockKeyUsesChainAndHash(t *testing.T) {
	key, err := CanonicalBlockKey(420, "0xABC")
	if err != nil { t.Fatal(err) }
	if key != "420:0xabc" { t.Fatalf("unexpected canonical key %q", key) }
	if _, err := CanonicalBlockKey(0, "0xabc"); err == nil { t.Fatal("expected zero-chain rejection") }
	if _, err := CanonicalBlockKey(420, ""); err == nil { t.Fatal("expected empty-hash rejection") }
}

func TestFileStoreRejectsFinalizedOverwrite(t *testing.T) {
	path := filepath.Join(t.TempDir(), "indexer.json")
	s, err := NewFileStore(path)
	if err != nil { t.Fatal(err) }
	finalized := model.BlockRecord{ChainID:420, Number:2, Hash:"0xfinal", Finality:model.FinalityFinalized}
	if err := s.PutBlock(finalized); err != nil { t.Fatal(err) }
	if err := s.PutBlock(model.BlockRecord{ChainID:420, Number:2, Hash:"0xother", Finality:model.FinalityHead}); err == nil {
		t.Fatal("expected finalized overwrite rejection")
	}
	got, ok, err := s.Block(2)
	if err != nil || !ok || got.Hash != "0xfinal" { t.Fatalf("finalized block mutated: %+v ok=%v err=%v", got, ok, err) }
}

func TestFileStoreRejectsRollbackBelowFinalizedCheckpoint(t *testing.T) {
	path := filepath.Join(t.TempDir(), "indexer.json")
	s, err := NewFileStore(path)
	if err != nil { t.Fatal(err) }
	for n := uint64(0); n <= 3; n++ {
		finality := model.FinalityHead
		if n <= 2 { finality = model.FinalityFinalized }
		if err := s.PutBlock(model.BlockRecord{ChainID:420, Number:n, Hash:"0x"+string(rune('a'+n)), Finality:finality}); err != nil { t.Fatal(err) }
	}
	if err := s.SaveCheckpoint(model.ChainCheckpoint{ChainID:420, IndexedHeight:3, IndexedHash:"0xd", SafeHeight:3, SafeHash:"0xd", FinalizedHeight:2, FinalizedHash:"0xc"}); err != nil { t.Fatal(err) }
	if err := s.DeleteBlocksAbove(1); err == nil { t.Fatal("expected rollback below finality rejection") }
	if _, ok, _ := s.Block(3); !ok { t.Fatal("store changed despite rejected rollback") }
}

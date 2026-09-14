package store

import (
	"path/filepath"
	"testing"

	"github.com/420integrated/420-integrated/indexer/model"
)

func TestAssetTransfersPersistFilterAndRollback(t *testing.T) {
	s, err := NewFileStore(filepath.Join(t.TempDir(), "index.json"))
	if err != nil { t.Fatal(err) }
	from := "0x1111111111111111111111111111111111111111"
	to := "0x2222222222222222222222222222222222222222"
	block := model.BlockRecord{ChainID:420, Number:7, Hash:"0x7"}
	tx := model.TransactionRecord{ChainID:420, BlockNumber:7, BlockHash:"0x7", Hash:"0xtx", Index:0, From:from, To:to, ValueWei:"420"}
	if err := s.PutBundle(block, []model.TransactionRecord{tx}, nil, nil); err != nil { t.Fatal(err) }
	rows, err := s.AssetTransfers("native:420", to)
	if err != nil { t.Fatal(err) }
	if len(rows) != 1 || rows[0].Amount != "420" || rows[0].AssetKind != "native" { t.Fatalf("unexpected transfers: %+v", rows) }
	if err := s.DeleteBlocksAbove(6); err != nil { t.Fatal(err) }
	rows, err = s.AssetTransfers("native:420", to)
	if err != nil { t.Fatal(err) }
	if len(rows) != 0 { t.Fatalf("asset transfer survived rollback: %+v", rows) }
}

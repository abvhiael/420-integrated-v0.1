package store

import (
	"path/filepath"
	"testing"

	"github.com/420integrated/420-integrated/indexer/model"
)

func TestTransactionsByAddressMatchesSenderAndRecipient(t *testing.T) {
	s, err := NewFileStore(filepath.Join(t.TempDir(), "index.json"))
	if err != nil { t.Fatal(err) }
	block := model.BlockRecord{ChainID: 420, Number: 1, Hash: "0xblock"}
	txs := []model.TransactionRecord{
		{ChainID: 420, BlockNumber: 1, BlockHash: "0xblock", Hash: "0x1", From: "0xABC", To: "0xdef"},
		{ChainID: 420, BlockNumber: 1, BlockHash: "0xblock", Hash: "0x2", From: "0x123", To: "0xAbC"},
		{ChainID: 420, BlockNumber: 1, BlockHash: "0xblock", Hash: "0x3", From: "0x123", To: "0x456"},
	}
	if err := s.PutBundle(block, txs, nil, nil); err != nil { t.Fatal(err) }
	got, err := s.TransactionsByAddress("0xabc")
	if err != nil { t.Fatal(err) }
	if len(got) != 2 { t.Fatalf("expected 2 matching txs, got %d", len(got)) }
}

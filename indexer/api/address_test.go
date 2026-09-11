package api

import (
	"testing"
	"time"

	"github.com/420integrated/420-integrated/indexer/model"
)

type addressStore struct {
	memoryReadStore
	txs []model.TransactionRecord
}

func (a addressStore) TransactionsByAddress(string) ([]model.TransactionRecord, error) { return a.txs, nil }

func TestAddressTransactionsPinsCheckpointAndOrdersLatestFirst(t *testing.T) {
	store := addressStore{
		memoryReadStore: memoryReadStore{cp: model.ChainCheckpoint{ChainID: 420, IndexedHeight: 10, IndexedHash: "0x10", SafeHeight: 9, FinalizedHeight: 8, SchemaVersion: "v1", UpdatedAt: time.Now()}, blocks: map[uint64]model.BlockRecord{}},
		txs: []model.TransactionRecord{
			{ChainID: 420, BlockNumber: 9, Index: 0, Hash: "0x1"},
			{ChainID: 420, BlockNumber: 10, Index: 1, Hash: "0x2"},
			{ChainID: 420, BlockNumber: 11, Index: 0, Hash: "0x3"},
		},
	}
	page, err := NewStoreBackend(store, nil).AddressTransactions("0xabc", 10)
	if err != nil { t.Fatal(err) }
	if page.Meta.SnapshotHeight != 10 || page.Meta.SnapshotHash != "0x10" { t.Fatalf("unexpected snapshot: %+v", page.Meta) }
	if len(page.Transactions) != 2 || page.Transactions[0].Hash != "0x2" || page.Transactions[1].Hash != "0x1" { t.Fatalf("unexpected transactions: %+v", page.Transactions) }
	if page.CanonicalAuthority { t.Fatal("address query must never claim canonical authority") }
}

type addressHTTPBackend struct{ fakeBackend }
func (addressHTTPBackend) AddressTransactions(address string, limit uint32) (AddressTransactionPage, error) {
	return AddressTransactionPage{Address: address, Meta: PageMeta{ChainID: 420, SnapshotHeight: 12}, Transactions: []model.TransactionRecord{{ChainID: 420, BlockNumber: 12, Hash: "0xtx", From: address}}, CanonicalAuthority: false}, nil
}

func TestAddressTransactionHTTPRoute(t *testing.T) {
	r := httptest.NewRequest("GET", "/v1/transactions?address=0xabc&limit=25", nil)
	w := httptest.NewRecorder()
	NewServer(addressHTTPBackend{}).Handler().ServeHTTP(w, r)
	if w.Code != 200 { t.Fatalf("unexpected status %d: %s", w.Code, w.Body.String()) }
	if !contains(w.Body.String(), `"canonicalAuthority":false`) { t.Fatalf("missing authority marker: %s", w.Body.String()) }
}

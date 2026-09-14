package api

import (
	"testing"
	"time"

	"github.com/420integrated/420-integrated/indexer/decoder"
	"github.com/420integrated/420-integrated/indexer/model"
)

type memoryReadStore struct {
	cp       model.ChainCheckpoint
	blocks   map[uint64]model.BlockRecord
	tx       model.TransactionRecord
	receipt  model.ReceiptRecord
	logs     []model.LogRecord
}

func (m memoryReadStore) Checkpoint() (model.ChainCheckpoint, bool, error) { return m.cp, true, nil }
func (m memoryReadStore) Block(n uint64) (model.BlockRecord, bool, error) { b, ok := m.blocks[n]; return b, ok, nil }
func (m memoryReadStore) Transaction(hash string) (model.TransactionRecord, bool, error) { return m.tx, m.tx.Hash == hash, nil }
func (m memoryReadStore) Receipt(hash string) (model.ReceiptRecord, bool, error) { return m.receipt, m.receipt.TransactionHash == hash, nil }
func (m memoryReadStore) LogsByBlock(n uint64) ([]model.LogRecord, error) {
	out := make([]model.LogRecord, 0)
	for _, lg := range m.logs { if lg.BlockNumber == n { out = append(out, lg) } }
	return out, nil
}

func TestStoreBackendPinsSnapshotAcrossPages(t *testing.T) {
	blocks := map[uint64]model.BlockRecord{}
	for i := uint64(0); i <= 4; i++ { blocks[i] = model.BlockRecord{ChainID: 420, Number: i, Hash: "h" + string(rune('0'+i))} }
	store := memoryReadStore{cp: model.ChainCheckpoint{ChainID: 420, IndexedHeight: 4, IndexedHash: "h4", SafeHeight: 3, FinalizedHeight: 2, SchemaVersion: "v1", UpdatedAt: time.Now()}, blocks: blocks}
	b := NewStoreBackend(store, nil)
	page, err := b.Blocks(nil, 2)
	if err != nil { t.Fatal(err) }
	if len(page.Blocks) != 2 || page.Blocks[0].Number != 4 || page.Blocks[1].Number != 3 { t.Fatalf("unexpected first page: %+v", page.Blocks) }
	if page.Meta.NextCursor == "" { t.Fatal("expected next cursor") }
	cur, err := DecodeCursor(page.Meta.NextCursor); if err != nil { t.Fatal(err) }
	page2, err := b.Blocks(&cur, 2); if err != nil { t.Fatal(err) }
	if page2.Meta.SnapshotHeight != 4 || page2.Meta.SnapshotHash != "h4" { t.Fatalf("snapshot drifted: %+v", page2.Meta) }
	if len(page2.Blocks) != 2 || page2.Blocks[0].Number != 2 || page2.Blocks[1].Number != 1 { t.Fatalf("unexpected second page: %+v", page2.Blocks) }
}

func TestStoreBackendExposesRegistryVersion(t *testing.T) {
	catalog := decoder.NewCatalog()
	if err := catalog.ApplyVersion(decoder.VersionPublished{ServiceID: "swap", Version: 1, Implementation: "0x420", BlockNumber: 7, BlockHash: "0x07", Active: true}); err != nil { t.Fatal(err) }
	store := memoryReadStore{cp: model.ChainCheckpoint{ChainID: 420, IndexedHeight: 7, IndexedHash: "0x07"}, blocks: map[uint64]model.BlockRecord{7: {ChainID: 420, Number: 7, Hash: "0x07"}}}
	b := NewStoreBackend(store, catalog)
	record, err := b.ServiceVersion("swap", 1)
	if err != nil { t.Fatal(err) }
	if record.Implementation != "0x420" || record.Version != 1 { t.Fatalf("unexpected service version: %+v", record) }
}

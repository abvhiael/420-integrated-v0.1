package api

import (
	"errors"
	"time"

	"github.com/420integrated/420-integrated/indexer/decoder"
	"github.com/420integrated/420-integrated/indexer/model"
)

// ReadStore is the durable indexed-state surface required by the production API.
type ReadStore interface {
	Checkpoint() (model.ChainCheckpoint, bool, error)
	Block(number uint64) (model.BlockRecord, bool, error)
	Transaction(hash string) (model.TransactionRecord, bool, error)
	Receipt(txHash string) (model.ReceiptRecord, bool, error)
	LogsByBlock(number uint64) ([]model.LogRecord, error)
}

// StoreBackend joins durable canonical-source records with the rebuildable
// ProtocolRegistry catalogue. Neither side has canonical chain authority.
type StoreBackend struct {
	store   ReadStore
	catalog *decoder.Catalog
}

func NewStoreBackend(store ReadStore, catalog *decoder.Catalog) *StoreBackend {
	if catalog == nil { catalog = decoder.NewCatalog() }
	return &StoreBackend{store: store, catalog: catalog}
}

func (b *StoreBackend) Health() (model.Health, error) {
	cp, ok, err := b.store.Checkpoint()
	if err != nil { return model.Health{}, err }
	if !ok { return model.Health{State: "EMPTY"}, nil }
	return model.Health{
		ChainID: cp.ChainID, IndexedHeight: cp.IndexedHeight, SafeHeight: cp.SafeHeight,
		FinalizedHeight: cp.FinalizedHeight, SchemaVersion: cp.SchemaVersion,
		State: "HEALTHY", LastIngestAt: cp.UpdatedAt,
	}, nil
}

func (b *StoreBackend) Block(number uint64) (model.BlockRecord, bool, error) {
	return b.store.Block(number)
}

func (b *StoreBackend) Transaction(hash string) (model.TransactionRecord, bool, error) {
	return b.store.Transaction(hash)
}

func (b *StoreBackend) Receipt(hash string) (model.ReceiptRecord, bool, error) {
	return b.store.Receipt(hash)
}

func (b *StoreBackend) LogsByBlock(number uint64) ([]model.LogRecord, error) {
	return b.store.LogsByBlock(number)
}

func (b *StoreBackend) ServiceVersion(serviceID string, version uint32) (decoder.ServiceVersion, error) {
	return b.catalog.Version(serviceID, version)
}

func (b *StoreBackend) Blocks(cur *Cursor, limit uint32) (BlockPage, error) {
	cp, ok, err := b.store.Checkpoint()
	if err != nil { return BlockPage{}, err }
	if !ok { return BlockPage{}, ErrSnapshotUnavailable }

	snapshotHeight := cp.IndexedHeight
	snapshotHash := cp.IndexedHash
	before := snapshotHeight + 1
	if cur != nil {
		snapshotHeight, snapshotHash, before = cur.SnapshotHeight, cur.SnapshotHash, cur.BeforeHeight
		block, ok, err := b.store.Block(snapshotHeight)
		if err != nil { return BlockPage{}, err }
		if !ok || block.Hash != snapshotHash { return BlockPage{}, ErrSnapshotUnavailable }
	}
	if limit == 0 { return BlockPage{}, ErrInvalidCursor }

	blocks := make([]model.BlockRecord, 0, limit)
	if before > snapshotHeight+1 { before = snapshotHeight + 1 }
	for n := before; n > 0 && uint32(len(blocks)) < limit; {
		n--
		block, ok, err := b.store.Block(n)
		if err != nil { return BlockPage{}, err }
		if ok { blocks = append(blocks, block) }
	}

	meta := PageMeta{
		ChainID: cp.ChainID, SnapshotHeight: snapshotHeight, SnapshotHash: snapshotHash,
		SafeHeight: cp.SafeHeight, FinalizedHeight: cp.FinalizedHeight, SchemaVersion: cp.SchemaVersion,
	}
	if len(blocks) > 0 {
		last := blocks[len(blocks)-1].Number
		if last > 0 {
			next, err := EncodeCursor(Cursor{SnapshotHeight: snapshotHeight, SnapshotHash: snapshotHash, BeforeHeight: last, Limit: limit})
			if err != nil { return BlockPage{}, err }
			meta.NextCursor = next
		}
	}
	return BlockPage{Meta: meta, Blocks: blocks}, nil
}

var _ = errors.Is
var _ = time.Time{}

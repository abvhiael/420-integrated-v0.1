package api

import (
	"errors"
	"reflect"
	"strings"
	"sync"
	"time"

	"github.com/420integrated/420-integrated/indexer/decoder"
	"github.com/420integrated/420-integrated/indexer/model"
)

type ReadStore interface {
	Checkpoint() (model.ChainCheckpoint, bool, error)
	Block(number uint64) (model.BlockRecord, bool, error)
	Transaction(hash string) (model.TransactionRecord, bool, error)
	Receipt(txHash string) (model.ReceiptRecord, bool, error)
	LogsByBlock(number uint64) ([]model.LogRecord, error)
}

type assetReadStore interface { AssetTransfers(assetKey, address string) ([]model.AssetTransferRecord, error) }
type ConsensusProvider interface { Consensus() (model.ConsensusStatus, error) }

var (
	ErrAssetQueryUnavailable = errors.New("asset transfer query unavailable")
	ErrConsensusQueryUnavailable = errors.New("consensus query unavailable")
)

type RuntimeHealth struct {
	mu sync.RWMutex
	issue string
	issueAt time.Time
}

func NewRuntimeHealth() *RuntimeHealth { return &RuntimeHealth{} }
func (h *RuntimeHealth) MarkHealthy() { if h==nil{return}; h.mu.Lock(); h.issue=""; h.issueAt=time.Time{}; h.mu.Unlock() }
func (h *RuntimeHealth) MarkFailure(issue string) { if h==nil{return}; h.mu.Lock(); h.issue=strings.TrimSpace(issue); if h.issue=="" { h.issueAt=time.Time{} } else { h.issueAt=time.Now().UTC() }; h.mu.Unlock() }
func (h *RuntimeHealth) snapshot() (string, time.Time) { if h==nil{return "",time.Time{}}; h.mu.RLock(); defer h.mu.RUnlock(); return h.issue,h.issueAt }

var ErrRegistryProjectionMismatch = errors.New("registry projection disagrees with canonical Registry state")

type CanonicalRegistryReader interface {
	ServiceVersion(serviceID string, version uint32) (decoder.ServiceVersion, error)
	Service(serviceID string) (decoder.ServiceSummary, error)
}

type StoreBackend struct {
	store ReadStore
	catalogMu sync.RWMutex
	catalog *decoder.Catalog
	canonicalRegistry CanonicalRegistryReader
	consensus ConsensusProvider
	runtimeHealth *RuntimeHealth
}
func NewStoreBackend(store ReadStore, catalog *decoder.Catalog) *StoreBackend { if catalog == nil { catalog = decoder.NewCatalog() }; return &StoreBackend{store: store, catalog: catalog} }
func (b *StoreBackend) ReplaceRegistryCatalog(catalog *decoder.Catalog) {
	if catalog == nil { catalog = decoder.NewCatalog() }
	b.catalogMu.Lock(); b.catalog = catalog; b.catalogMu.Unlock()
}
func (b *StoreBackend) WithCanonicalRegistryReader(reader CanonicalRegistryReader) *StoreBackend { b.canonicalRegistry = reader; return b }
func (b *StoreBackend) registryCatalog() *decoder.Catalog { b.catalogMu.RLock(); defer b.catalogMu.RUnlock(); return b.catalog }
func (b *StoreBackend) WithConsensusProvider(provider ConsensusProvider) *StoreBackend { b.consensus = provider; return b }
func (b *StoreBackend) WithRuntimeHealth(runtimeHealth *RuntimeHealth) *StoreBackend { b.runtimeHealth = runtimeHealth; return b }
func (b *StoreBackend) Consensus() (model.ConsensusStatus, error) { if b.consensus == nil { return model.ConsensusStatus{}, ErrConsensusQueryUnavailable }; return b.consensus.Consensus() }
func (b *StoreBackend) Health() (model.Health, error) {
	cp, ok, err := b.store.Checkpoint()
	if err != nil { return model.Health{}, err }
	if !ok {
		issue, at := b.runtimeHealth.snapshot()
		h := model.Health{State:"EMPTY", RuntimeIssue:issue}
		if !at.IsZero() { t:=at; h.RuntimeIssueAt=&t; h.State="DEGRADED" }
		return h,nil
	}
	h := model.Health{ChainID:cp.ChainID, IndexedHeight:cp.IndexedHeight, SafeHeight:cp.SafeHeight, FinalizedHeight:cp.FinalizedHeight, SchemaVersion:cp.SchemaVersion, State:"HEALTHY", LastIngestAt:cp.UpdatedAt}
	if issue, at := b.runtimeHealth.snapshot(); issue != "" {
		h.State="DEGRADED"
		h.RuntimeIssue=issue
		if !at.IsZero() { t:=at; h.RuntimeIssueAt=&t }
	}
	return h,nil
}
func (b *StoreBackend) Block(number uint64) (model.BlockRecord, bool, error) { return b.store.Block(number) }
func (b *StoreBackend) Transaction(hash string) (model.TransactionRecord, bool, error) { return b.store.Transaction(hash) }
func (b *StoreBackend) Receipt(hash string) (model.ReceiptRecord, bool, error) { return b.store.Receipt(hash) }
func (b *StoreBackend) LogsByBlock(number uint64) ([]model.LogRecord, error) { return b.store.LogsByBlock(number) }
func (b *StoreBackend) ServiceVersion(serviceID string, version uint32) (decoder.ServiceVersion, error) {
	projected, err := b.registryCatalog().Version(serviceID, version)
	if err != nil { return decoder.ServiceVersion{}, err }
	if b.canonicalRegistry != nil {
		canonical, err := b.canonicalRegistry.ServiceVersion(serviceID, version)
		if err != nil { return decoder.ServiceVersion{}, err }
		if !reflect.DeepEqual(projected, canonical) { return decoder.ServiceVersion{}, ErrRegistryProjectionMismatch }
	}
	return projected, nil
}
func (b *StoreBackend) Service(serviceID string) (decoder.ServiceSummary, error) {
	projected, err := b.registryCatalog().Service(serviceID)
	if err != nil { return decoder.ServiceSummary{}, err }
	if b.canonicalRegistry != nil {
		canonical, err := b.canonicalRegistry.Service(serviceID)
		if err != nil { return decoder.ServiceSummary{}, err }
		if !reflect.DeepEqual(projected, canonical) { return decoder.ServiceSummary{}, ErrRegistryProjectionMismatch }
	}
	return projected, nil
}
func (b *StoreBackend) Services() []decoder.ServiceSummary { return b.registryCatalog().Services() }

func (b *StoreBackend) AssetTransfers(assetKey, address string, limit uint32) (AssetTransferPage, error) {
	if limit == 0 || limit > 250 { return AssetTransferPage{}, ErrInvalidCursor }
	cp, ok, err := b.store.Checkpoint(); if err != nil { return AssetTransferPage{}, err }; if !ok { return AssetTransferPage{}, ErrSnapshotUnavailable }
	reader, ok := b.store.(assetReadStore); if !ok { return AssetTransferPage{}, ErrAssetQueryUnavailable }
	assetKey = strings.ToLower(strings.TrimSpace(assetKey)); address = strings.ToLower(strings.TrimSpace(address))
	rows, err := reader.AssetTransfers(assetKey, address); if err != nil { return AssetTransferPage{}, err }
	filtered := make([]model.AssetTransferRecord, 0, min(int(limit), len(rows)))
	for _, transfer := range rows { if transfer.ChainID != cp.ChainID || transfer.BlockNumber > cp.IndexedHeight { continue }; filtered = append(filtered, transfer); if uint32(len(filtered)) == limit { break } }
	return AssetTransferPage{Meta: PageMeta{ChainID:cp.ChainID, SnapshotHeight:cp.IndexedHeight, SnapshotHash:cp.IndexedHash, SafeHeight:cp.SafeHeight, FinalizedHeight:cp.FinalizedHeight, SchemaVersion:cp.SchemaVersion}, AssetKey:assetKey, Address:address, Transfers:filtered, CanonicalAuthority:false}, nil
}

func (b *StoreBackend) Blocks(cur *Cursor, limit uint32) (BlockPage, error) {
	cp, ok, err := b.store.Checkpoint(); if err != nil { return BlockPage{}, err }; if !ok { return BlockPage{}, ErrSnapshotUnavailable }
	snapshotHeight, snapshotHash, before := cp.IndexedHeight, cp.IndexedHash, cp.IndexedHeight+1
	if cur != nil { snapshotHeight, snapshotHash, before = cur.SnapshotHeight, cur.SnapshotHash, cur.BeforeHeight; block, ok, err := b.store.Block(snapshotHeight); if err != nil { return BlockPage{}, err }; if !ok || block.Hash != snapshotHash { return BlockPage{}, ErrSnapshotUnavailable } }
	if limit == 0 { return BlockPage{}, ErrInvalidCursor }
	blocks := make([]model.BlockRecord,0,limit); if before > snapshotHeight+1 { before = snapshotHeight+1 }
	for n:=before; n>0 && uint32(len(blocks))<limit; { n--; block,ok,err:=b.store.Block(n); if err!=nil{return BlockPage{},err}; if ok {blocks=append(blocks,block)} }
	meta:=PageMeta{ChainID:cp.ChainID,SnapshotHeight:snapshotHeight,SnapshotHash:snapshotHash,SafeHeight:cp.SafeHeight,FinalizedHeight:cp.FinalizedHeight,SchemaVersion:cp.SchemaVersion}
	if len(blocks)>0 { last:=blocks[len(blocks)-1].Number; if last>0 { next,err:=EncodeCursor(Cursor{SnapshotHeight:snapshotHeight,SnapshotHash:snapshotHash,BeforeHeight:last,Limit:limit}); if err!=nil{return BlockPage{},err}; meta.NextCursor=next } }
	return BlockPage{Meta:meta,Blocks:blocks},nil
}

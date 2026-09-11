package service

import (
	"context"
	"errors"
	"testing"
	"time"

	indexerapi "github.com/420integrated/420-integrated/indexer/api"
	"github.com/420integrated/420-integrated/indexer/decoder"
	"github.com/420integrated/420-integrated/indexer/model"
)

type fakeIndexer struct {
	health  indexerapi.HealthResponse
	blocks  indexerapi.BlockPage
	block   model.BlockRecord
	tx      model.TransactionRecord
	receipt model.ReceiptRecord
	logs    []model.LogRecord
}

func (f *fakeIndexer) Health(context.Context) (indexerapi.HealthResponse, error) { return f.health, nil }
func (f *fakeIndexer) Blocks(context.Context, uint32, string) (indexerapi.BlockPage, error) { return f.blocks, nil }
func (f *fakeIndexer) Block(context.Context, uint64) (model.BlockRecord, error) { return f.block, nil }
func (f *fakeIndexer) Transaction(context.Context, string) (model.TransactionRecord, error) { return f.tx, nil }
func (f *fakeIndexer) Receipt(context.Context, string) (model.ReceiptRecord, error) { return f.receipt, nil }
func (f *fakeIndexer) BlockLogs(context.Context, uint64) ([]model.LogRecord, error) { return f.logs, nil }
func (f *fakeIndexer) ServiceVersion(context.Context, string, uint32) (decoder.ServiceVersion, error) {
	return decoder.ServiceVersion{}, nil
}

func TestNetworkStatusHealthy(t *testing.T) {
	now := time.Date(2026, 9, 10, 20, 0, 0, 0, time.UTC)
	idx := &fakeIndexer{health: indexerapi.HealthResponse{Health: model.Health{
		ChainID: 420, IndexedHeight: 100, SafeHeight: 98, FinalizedHeight: 95,
		State: "READY", LastIngestAt: now.Add(-10 * time.Second),
	}}}
	svc, err := New(idx, 420, time.Minute)
	if err != nil { t.Fatal(err) }
	svc.now = func() time.Time { return now }
	status, err := svc.NetworkStatus(context.Background())
	if err != nil { t.Fatal(err) }
	if status.WrongChain || status.Stale || status.Degraded || !status.Consistent || !status.Ready { t.Fatalf("unexpected unhealthy status: %+v", status) }
	if status.HeadHeight != 100 || status.IndexedHeight != 100 || status.SafeHeight != 98 || status.FinalizedHeight != 95 { t.Fatalf("unexpected heights: %+v", status) }
	if status.SafeLag != 2 || status.FinalizedLag != 5 { t.Fatalf("unexpected finality lags: %+v", status) }
	if status.IngestAgeSeconds != 10 { t.Fatalf("unexpected ingest age: %+v", status) }
}

func TestNetworkStatusFailsClosedOnWrongChain(t *testing.T) {
	now := time.Now()
	idx := &fakeIndexer{health: indexerapi.HealthResponse{Health: model.Health{ChainID: 1, State: "READY", LastIngestAt: now}}}
	svc, _ := New(idx, 420, time.Minute)
	svc.now = func() time.Time { return now }
	status, err := svc.NetworkStatus(context.Background())
	if !errors.Is(err, ErrWrongChain) { t.Fatalf("expected wrong-chain error, got %v", err) }
	if !status.WrongChain || status.Ready { t.Fatal("expected wrongChain presentation flag and not-ready status") }
}

func TestNetworkStatusSurfacesStaleAndDegraded(t *testing.T) {
	now := time.Now()
	idx := &fakeIndexer{health: indexerapi.HealthResponse{Health: model.Health{ChainID: 420, State: "DEGRADED", LastIngestAt: now.Add(-10 * time.Minute)}}}
	svc, _ := New(idx, 420, time.Minute)
	svc.now = func() time.Time { return now }
	status, err := svc.NetworkStatus(context.Background())
	if !errors.Is(err, ErrIndexerDegraded) { t.Fatalf("expected degraded error, got %v", err) }
	if !status.Degraded || !status.Stale || status.Ready { t.Fatalf("expected degraded and stale flags: %+v", status) }
}

func TestNetworkStatusRejectsImpossibleFinalityOrdering(t *testing.T) {
	now := time.Now()
	idx := &fakeIndexer{health: indexerapi.HealthResponse{Health: model.Health{
		ChainID: 420, IndexedHeight: 100, SafeHeight: 101, FinalizedHeight: 99,
		State: "READY", LastIngestAt: now,
	}}}
	svc, _ := New(idx, 420, time.Minute)
	svc.now = func() time.Time { return now }
	status, err := svc.NetworkStatus(context.Background())
	if !errors.Is(err, ErrIndexerInconsistent) { t.Fatalf("expected inconsistent finality error, got %v", err) }
	if status.Consistent || status.Ready { t.Fatalf("expected inconsistent not-ready status: %+v", status) }
	if status.SafeLag != 0 || status.FinalizedLag != 0 { t.Fatalf("lags must not underflow on inconsistent heights: %+v", status) }
}

func TestNetworkStatusDoesNotUnderflowFutureIngestTimestamp(t *testing.T) {
	now := time.Now()
	idx := &fakeIndexer{health: indexerapi.HealthResponse{Health: model.Health{
		ChainID: 420, IndexedHeight: 10, SafeHeight: 9, FinalizedHeight: 8,
		State: "READY", LastIngestAt: now.Add(5 * time.Second),
	}}}
	svc, _ := New(idx, 420, time.Minute)
	svc.now = func() time.Time { return now }
	status, err := svc.NetworkStatus(context.Background())
	if err != nil { t.Fatal(err) }
	if status.IngestAgeSeconds != 0 || !status.Ready { t.Fatalf("unexpected future-timestamp handling: %+v", status) }
}

func TestBlockViewPreservesCanonicalProvenance(t *testing.T) {
	idx := &fakeIndexer{
		block: model.BlockRecord{ChainID: 420, Number: 12, Hash: "0xblock"},
		logs: []model.LogRecord{{ChainID: 420, BlockNumber: 12, BlockHash: "0xblock", TransactionHash: "0xtx"}},
	}
	svc, _ := New(idx, 420, time.Minute)
	view, err := svc.Block(context.Background(), 12)
	if err != nil { t.Fatal(err) }
	if view.Block.Hash != "0xblock" || len(view.Logs) != 1 { t.Fatalf("unexpected block view: %+v", view) }

	idx.logs[0].BlockHash = "0xother"
	if _, err := svc.Block(context.Background(), 12); err == nil { t.Fatal("expected inconsistent log provenance to fail closed") }
}

func TestTransactionViewRequiresReceiptProvenanceMatch(t *testing.T) {
	idx := &fakeIndexer{
		tx: model.TransactionRecord{ChainID: 420, BlockNumber: 7, BlockHash: "0xblock", Hash: "0xAbC"},
		receipt: model.ReceiptRecord{ChainID: 420, BlockNumber: 7, BlockHash: "0xblock", TransactionHash: "0xabc"},
	}
	svc, _ := New(idx, 420, time.Minute)
	if _, err := svc.Transaction(context.Background(), "0xabc"); err != nil { t.Fatal(err) }

	idx.receipt.BlockNumber = 8
	if _, err := svc.Transaction(context.Background(), "0xabc"); err == nil { t.Fatal("expected inconsistent receipt provenance to fail closed") }
}

func TestBlocksRejectsWrongChainRecords(t *testing.T) {
	idx := &fakeIndexer{blocks: indexerapi.BlockPage{
		Meta: indexerapi.PageMeta{ChainID: 420},
		Blocks: []model.BlockRecord{{ChainID: 1, Number: 1, Hash: "0x1"}},
	}}
	svc, _ := New(idx, 420, time.Minute)
	if _, err := svc.Blocks(context.Background(), 10, ""); !errors.Is(err, ErrWrongChain) {
		t.Fatalf("expected wrong-chain error, got %v", err)
	}
}

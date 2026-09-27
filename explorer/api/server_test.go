package api

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	indexerapi "github.com/420integrated/420-integrated/indexer/api"
	"github.com/420integrated/420-integrated/indexer/decoder"
	"github.com/420integrated/420-integrated/indexer/model"
	explorerservice "github.com/420integrated/420-integrated/explorer/service"
)

type fakeIndexer struct {
	health  indexerapi.HealthResponse
	blocks  indexerapi.BlockPage
	block   model.BlockRecord
	logs    []model.LogRecord
	tx      model.TransactionRecord
	receipt model.ReceiptRecord
	service decoder.ServiceVersion
}

func (f *fakeIndexer) Health(context.Context) (indexerapi.HealthResponse, error) { return f.health, nil }
func (f *fakeIndexer) Blocks(context.Context, uint32, string) (indexerapi.BlockPage, error) { return f.blocks, nil }
func (f *fakeIndexer) Block(context.Context, uint64) (model.BlockRecord, error) { return f.block, nil }
func (f *fakeIndexer) Transaction(context.Context, string) (model.TransactionRecord, error) { return f.tx, nil }
func (f *fakeIndexer) Receipt(context.Context, string) (model.ReceiptRecord, error) { return f.receipt, nil }
func (f *fakeIndexer) BlockLogs(context.Context, uint64) ([]model.LogRecord, error) { return f.logs, nil }
func (f *fakeIndexer) ServiceVersion(context.Context, string, uint32) (decoder.ServiceVersion, error) { return f.service, nil }

func newTestServer(t *testing.T, f *fakeIndexer) *Server {
	t.Helper()
	svc, err := explorerservice.New(f, 420, time.Hour)
	if err != nil { t.Fatal(err) }
	s, err := NewServer(svc)
	if err != nil { t.Fatal(err) }
	return s
}

func TestStatusRoute(t *testing.T) {
	now := time.Now().UTC()
	f := &fakeIndexer{health: indexerapi.HealthResponse{Health: model.Health{
		ChainID: 420, IndexedHeight: 100, SafeHeight: 99, FinalizedHeight: 98,
		SchemaVersion: "v1", DecoderSet: "genesis", State: "READY", LastIngestAt: now,
	}}}
	s := newTestServer(t, f)
	rr := httptest.NewRecorder()
	s.Handler().ServeHTTP(rr, httptest.NewRequest(http.MethodGet, "/v1/status", nil))
	if rr.Code != http.StatusOK { t.Fatalf("status=%d body=%s", rr.Code, rr.Body.String()) }
	var got explorerservice.NetworkStatus
	if err := json.Unmarshal(rr.Body.Bytes(), &got); err != nil { t.Fatal(err) }
	if got.ChainID != 420 || got.IndexedHeight != 100 || got.SafeHeight != 99 || got.FinalizedHeight != 98 { t.Fatalf("unexpected status: %+v", got) }
}

func TestStatusRouteFailsClosedOnWrongChain(t *testing.T) {
	f := &fakeIndexer{health: indexerapi.HealthResponse{Health: model.Health{ChainID: 1, State: "READY", LastIngestAt: time.Now().UTC()}}}
	s := newTestServer(t, f)
	rr := httptest.NewRecorder()
	s.Handler().ServeHTTP(rr, httptest.NewRequest(http.MethodGet, "/v1/status", nil))
	if rr.Code != http.StatusServiceUnavailable { t.Fatalf("status=%d body=%s", rr.Code, rr.Body.String()) }
}

func TestBlockDetailRoute(t *testing.T) {
	f := &fakeIndexer{
		health: indexerapi.HealthResponse{Health: model.Health{ChainID: 420, IndexedHeight: 8}},
		block: model.BlockRecord{ChainID: 420, Number: 7, Hash: "0xblock", ParentHash: "0xparent", Finality: model.FinalitySafe, SchemaVersion:"v1", Producer:&model.BlockProducer{ConsensusSlot:70,ProducerSeat:5,ProposerRank:1,ConsensusBlockRoot:"0xcblock",Certified:true}},
		logs: []model.LogRecord{{ChainID: 420, BlockNumber: 7, BlockHash: "0xblock", TransactionHash: "0xtx"}},
	}
	s := newTestServer(t, f)
	rr := httptest.NewRecorder()
	s.Handler().ServeHTTP(rr, httptest.NewRequest(http.MethodGet, "/v1/blocks/7", nil))
	if rr.Code != http.StatusOK { t.Fatalf("status=%d body=%s", rr.Code, rr.Body.String()) }
	var got explorerservice.BlockDetailView
	if err := json.Unmarshal(rr.Body.Bytes(), &got); err != nil { t.Fatal(err) }
	if got.Block.Number != 7 || got.Block.Finality != model.FinalitySafe || got.LogCount != 1 { t.Fatalf("unexpected block detail: %+v", got) }
	if got.Trace == nil || got.Trace.ExecutionBlockHash != "0xblock" || got.Trace.ConsensusBlockRoot != "0xcblock" || got.Trace.ProducerSeat != 5 { t.Fatalf("unexpected cross-layer trace: %+v", got.Trace) }
	if got.Navigation.Previous == nil || *got.Navigation.Previous != 6 || got.Navigation.Next == nil || *got.Navigation.Next != 8 { t.Fatalf("unexpected navigation: %+v", got.Navigation) }
}

func TestBlocksRouteReturnsPresentationPage(t *testing.T) {
	f := &fakeIndexer{blocks: indexerapi.BlockPage{
		Meta: indexerapi.PageMeta{ChainID: 420, SnapshotHeight: 9, SnapshotHash: "0x9", NextCursor: "cursor"},
		Blocks: []model.BlockRecord{{ChainID: 420, Number: 9, Hash: "0x9", ParentHash: "0x8", Finality: model.FinalityHead}},
	}}
	s := newTestServer(t, f)
	rr := httptest.NewRecorder()
	s.Handler().ServeHTTP(rr, httptest.NewRequest(http.MethodGet, "/v1/blocks?limit=10", nil))
	if rr.Code != http.StatusOK { t.Fatalf("status=%d body=%s", rr.Code, rr.Body.String()) }
	var got explorerservice.BlockPageView
	if err := json.Unmarshal(rr.Body.Bytes(), &got); err != nil { t.Fatal(err) }
	if got.Meta.SnapshotHeight != 9 || got.Meta.NextCursor != "cursor" || len(got.Blocks) != 1 || got.Blocks[0].Finality != model.FinalityHead { t.Fatalf("unexpected block page: %+v", got) }
}

func transactionFixture() *fakeIndexer {
	return &fakeIndexer{
		tx: model.TransactionRecord{ChainID: 420, BlockNumber: 7, BlockHash: "0xblock", Hash: "0xtx", Index: 1, From: "0xfrom", To: "0xto"},
		receipt: model.ReceiptRecord{ChainID: 420, BlockNumber: 7, BlockHash: "0xblock", TransactionHash: "0xtx", TransactionIndex: 1, Status: 1, GasUsed: 21000},
		block: model.BlockRecord{ChainID: 420, Number: 7, Hash: "0xblock", Finality: model.FinalityFinalized},
		logs: []model.LogRecord{{ChainID: 420, BlockNumber: 7, BlockHash: "0xblock", TransactionHash: "0xtx", TransactionIndex: 1, LogIndex: 0, Address: "0xcontract"}},
	}
}

func TestTransactionRoute(t *testing.T) {
	s := newTestServer(t, transactionFixture())
	rr := httptest.NewRecorder()
	s.Handler().ServeHTTP(rr, httptest.NewRequest(http.MethodGet, "/v1/transactions/0xtx", nil))
	if rr.Code != http.StatusOK { t.Fatalf("status=%d body=%s", rr.Code, rr.Body.String()) }
	var got explorerservice.TransactionDetailView
	if err := json.Unmarshal(rr.Body.Bytes(), &got); err != nil { t.Fatal(err) }
	if got.Transaction.Hash != "0xtx" || got.Receipt.StatusLabel != "SUCCESS" || got.LogCount != 1 || got.Finality != model.FinalityFinalized { t.Fatalf("unexpected tx detail: %+v", got) }
}

func TestReceiptRoute(t *testing.T) {
	s := newTestServer(t, transactionFixture())
	rr := httptest.NewRecorder()
	s.Handler().ServeHTTP(rr, httptest.NewRequest(http.MethodGet, "/v1/receipts/0xtx", nil))
	if rr.Code != http.StatusOK { t.Fatalf("status=%d body=%s", rr.Code, rr.Body.String()) }
	var got explorerservice.ReceiptDetailView
	if err := json.Unmarshal(rr.Body.Bytes(), &got); err != nil { t.Fatal(err) }
	if got.Receipt.TransactionHash != "0xtx" || got.Transaction.Hash != "0xtx" || got.LogCount != 1 { t.Fatalf("unexpected receipt detail: %+v", got) }
}

func TestServiceVersionRoute(t *testing.T) {
	f := &fakeIndexer{service: decoder.ServiceVersion{ServiceID: "420/service/explorer/v1", Version: 2}}
	s := newTestServer(t, f)
	rr := httptest.NewRecorder()
	s.Handler().ServeHTTP(rr, httptest.NewRequest(http.MethodGet, "/v1/services/420%2Fservice%2Fexplorer%2Fv1/versions/2", nil))
	if rr.Code != http.StatusOK { t.Fatalf("status=%d body=%s", rr.Code, rr.Body.String()) }
	var got decoder.ServiceVersion
	if err := json.Unmarshal(rr.Body.Bytes(), &got); err != nil { t.Fatal(err) }
	if got.ServiceID != "420/service/explorer/v1" || got.Version != 2 { t.Fatalf("unexpected service version: %+v", got) }
}

func TestBlocksRejectInvalidLimit(t *testing.T) {
	s := newTestServer(t, &fakeIndexer{})
	rr := httptest.NewRecorder()
	s.Handler().ServeHTTP(rr, httptest.NewRequest(http.MethodGet, "/v1/blocks?limit=wat", nil))
	if rr.Code != http.StatusBadRequest { t.Fatalf("status=%d body=%s", rr.Code, rr.Body.String()) }
}

func TestBlockRejectInvalidNumber(t *testing.T) {
	s := newTestServer(t, &fakeIndexer{})
	rr := httptest.NewRecorder()
	s.Handler().ServeHTTP(rr, httptest.NewRequest(http.MethodGet, "/v1/blocks/not-a-number", nil))
	if rr.Code != http.StatusBadRequest { t.Fatalf("status=%d body=%s", rr.Code, rr.Body.String()) }
}


func TestBlockTraceRoute(t *testing.T) {
	f := &fakeIndexer{
		block:model.BlockRecord{ChainID:420,Number:7,Hash:"0xblock",Finality:model.FinalitySafe,SchemaVersion:"v1",
			Producer:&model.BlockProducer{ConsensusSlot:70,ProducerSeat:5,ProposerRank:1,ConsensusBlockRoot:"0xcblock",Certified:true}},
	}
	s:=newTestServer(t,f)
	rr:=httptest.NewRecorder()
	s.Handler().ServeHTTP(rr,httptest.NewRequest(http.MethodGet,"/v1/blocks/7/trace",nil))
	if rr.Code!=http.StatusOK { t.Fatalf("status=%d body=%s",rr.Code,rr.Body.String()) }
	var got explorerservice.BlockTraceView
	if err:=json.Unmarshal(rr.Body.Bytes(),&got);err!=nil{t.Fatal(err)}
	if got.ExecutionBlockHash!="0xblock" || got.ConsensusBlockRoot!="0xcblock" || got.ConsensusSlot!=70 || got.ProducerSeat!=5 || got.ProposerRank!=1 || !got.Certified {
		t.Fatalf("unexpected trace: %+v",got)
	}
	if got.CanonicalAuthority { t.Fatal("trace overpromoted canonical authority") }
}

func TestBlockTraceRouteFailsClosedWithoutProducer(t *testing.T) {
	f:=&fakeIndexer{block:model.BlockRecord{ChainID:420,Number:7,Hash:"0xblock"}}
	s:=newTestServer(t,f)
	rr:=httptest.NewRecorder()
	s.Handler().ServeHTTP(rr,httptest.NewRequest(http.MethodGet,"/v1/blocks/7/trace",nil))
	if rr.Code==http.StatusOK { t.Fatalf("expected failure, body=%s",rr.Body.String()) }
}


func TestStatusRouteFailsClosedOnStaleIndexer(t *testing.T) {
	f:=&fakeIndexer{health:indexerapi.HealthResponse{Health:model.Health{
		ChainID:420, IndexedHeight:10, SafeHeight:9, FinalizedHeight:8,
		State:"HEALTHY", LastIngestAt:time.Now().Add(-10*time.Minute),
	}}}
	s:=newTestServer(t,f)
	rr:=httptest.NewRecorder()
	s.Handler().ServeHTTP(rr,httptest.NewRequest(http.MethodGet,"/v1/status",nil))
	if rr.Code!=http.StatusServiceUnavailable { t.Fatalf("status=%d body=%s",rr.Code,rr.Body.String()) }
	if !contains(rr.Body.String(),"INDEXER_STALE") { t.Fatalf("stale issue code missing: %s",rr.Body.String()) }
}

func TestStatusRouteFailsClosedOnRuntimeDegradation(t *testing.T) {
	now:=time.Now()
	f:=&fakeIndexer{health:indexerapi.HealthResponse{Health:model.Health{
		ChainID:420, IndexedHeight:10, SafeHeight:9, FinalizedHeight:8,
		State:"DEGRADED", LastIngestAt:now, RuntimeIssue:"INGEST_CATCHUP_FAILED",
	}}}
	s:=newTestServer(t,f)
	rr:=httptest.NewRecorder()
	s.Handler().ServeHTTP(rr,httptest.NewRequest(http.MethodGet,"/v1/status",nil))
	if rr.Code!=http.StatusServiceUnavailable { t.Fatalf("status=%d body=%s",rr.Code,rr.Body.String()) }
	if !contains(rr.Body.String(),"INDEXER_DEGRADED") { t.Fatalf("degraded issue code missing: %s",rr.Body.String()) }
}

func TestReadyRouteFailsClosedOnInconsistentFinality(t *testing.T) {
	now:=time.Now()
	f:=&fakeIndexer{health:indexerapi.HealthResponse{Health:model.Health{
		ChainID:420, IndexedHeight:10, SafeHeight:11, FinalizedHeight:8,
		State:"HEALTHY", LastIngestAt:now,
	}}}
	s:=newTestServer(t,f)
	rr:=httptest.NewRecorder()
	s.Handler().ServeHTTP(rr,httptest.NewRequest(http.MethodGet,"/v1/ready",nil))
	if rr.Code!=http.StatusServiceUnavailable { t.Fatalf("status=%d body=%s",rr.Code,rr.Body.String()) }
	if !contains(rr.Body.String(),"INCONSISTENT_FINALITY") { t.Fatalf("inconsistent-finality issue missing: %s",rr.Body.String()) }
}

func TestConsensusRouteFailsClosedWhenProviderUnavailable(t *testing.T) {
	s:=newTestServer(t,&fakeIndexer{})
	rr:=httptest.NewRecorder()
	s.Handler().ServeHTTP(rr,httptest.NewRequest(http.MethodGet,"/v1/consensus",nil))
	if rr.Code==http.StatusOK { t.Fatalf("consensus route unexpectedly succeeded: %s",rr.Body.String()) }
}

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
	req := httptest.NewRequest(http.MethodGet, "/v1/status", nil)
	rr := httptest.NewRecorder()
	s.Handler().ServeHTTP(rr, req)
	if rr.Code != http.StatusOK { t.Fatalf("status=%d body=%s", rr.Code, rr.Body.String()) }
	var got explorerservice.NetworkStatus
	if err := json.Unmarshal(rr.Body.Bytes(), &got); err != nil { t.Fatal(err) }
	if got.ChainID != 420 || got.IndexedHeight != 100 || got.SafeHeight != 99 || got.FinalizedHeight != 98 {
		t.Fatalf("unexpected status: %+v", got)
	}
}

func TestStatusRouteFailsClosedOnWrongChain(t *testing.T) {
	f := &fakeIndexer{health: indexerapi.HealthResponse{Health: model.Health{
		ChainID: 1, State: "READY", LastIngestAt: time.Now().UTC(),
	}}}
	s := newTestServer(t, f)
	rr := httptest.NewRecorder()
	s.Handler().ServeHTTP(rr, httptest.NewRequest(http.MethodGet, "/v1/status", nil))
	if rr.Code != http.StatusServiceUnavailable { t.Fatalf("status=%d body=%s", rr.Code, rr.Body.String()) }
}

func TestBlockDetailRoute(t *testing.T) {
	f := &fakeIndexer{
		block: model.BlockRecord{ChainID: 420, Number: 7, Hash: "0xblock"},
		logs: []model.LogRecord{{ChainID: 420, BlockNumber: 7, BlockHash: "0xblock", TransactionHash: "0xtx"}},
	}
	s := newTestServer(t, f)
	rr := httptest.NewRecorder()
	s.Handler().ServeHTTP(rr, httptest.NewRequest(http.MethodGet, "/v1/blocks/7", nil))
	if rr.Code != http.StatusOK { t.Fatalf("status=%d body=%s", rr.Code, rr.Body.String()) }
	var got explorerservice.BlockView
	if err := json.Unmarshal(rr.Body.Bytes(), &got); err != nil { t.Fatal(err) }
	if got.Block.Number != 7 || len(got.Logs) != 1 { t.Fatalf("unexpected block view: %+v", got) }
}

func TestTransactionRoute(t *testing.T) {
	f := &fakeIndexer{
		tx: model.TransactionRecord{ChainID: 420, BlockNumber: 7, BlockHash: "0xblock", Hash: "0xtx"},
		receipt: model.ReceiptRecord{ChainID: 420, BlockNumber: 7, BlockHash: "0xblock", TransactionHash: "0xtx", Status: 1},
	}
	s := newTestServer(t, f)
	rr := httptest.NewRecorder()
	s.Handler().ServeHTTP(rr, httptest.NewRequest(http.MethodGet, "/v1/transactions/0xtx", nil))
	if rr.Code != http.StatusOK { t.Fatalf("status=%d body=%s", rr.Code, rr.Body.String()) }
	var got explorerservice.TransactionView
	if err := json.Unmarshal(rr.Body.Bytes(), &got); err != nil { t.Fatal(err) }
	if got.Transaction.Hash != "0xtx" || got.Receipt.Status != 1 { t.Fatalf("unexpected tx view: %+v", got) }
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

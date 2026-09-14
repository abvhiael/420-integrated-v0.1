package indexerclient

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	indexerapi "github.com/420integrated/420-integrated/indexer/api"
	"github.com/420integrated/420-integrated/indexer/model"
)

func TestExplorerConsumesIndexerAPIOnly(t *testing.T) {
	seen := map[string]int{}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		seen[r.URL.Path]++
		w.Header().Set("content-type", "application/json")
		switch r.URL.Path {
		case "/v1/health":
			json.NewEncoder(w).Encode(indexerapi.HealthResponse{Health: model.Health{ChainID: 420, IndexedHeight: 12, SafeHeight: 11, FinalizedHeight: 10, State: "HEALTHY"}, CanonicalAuthority: false})
		case "/v1/blocks/12":
			json.NewEncoder(w).Encode(model.BlockRecord{ChainID: 420, Number: 12, Hash: "0xb12", Finality: model.FinalityHead})
		case "/v1/transactions/0xtx":
			json.NewEncoder(w).Encode(indexerapi.ReadResponse[model.TransactionRecord]{Data: model.TransactionRecord{ChainID: 420, BlockNumber: 12, BlockHash: "0xb12", Hash: "0xtx"}, CanonicalAuthority: false})
		case "/v1/receipts/0xtx":
			json.NewEncoder(w).Encode(indexerapi.ReadResponse[model.ReceiptRecord]{Data: model.ReceiptRecord{ChainID: 420, BlockNumber: 12, BlockHash: "0xb12", TransactionHash: "0xtx", Status: 1}, CanonicalAuthority: false})
		case "/v1/blocks/12/logs":
			json.NewEncoder(w).Encode(indexerapi.ReadResponse[[]model.LogRecord]{Data: []model.LogRecord{{ChainID: 420, BlockNumber: 12, BlockHash: "0xb12", TransactionHash: "0xtx"}}, CanonicalAuthority: false})
		default:
			http.NotFound(w, r)
		}
	}))
	defer srv.Close()

	client, err := New(srv.URL, time.Second)
	if err != nil { t.Fatal(err) }
	ctx := context.Background()
	if _, err := client.Health(ctx); err != nil { t.Fatal(err) }
	if _, err := client.Block(ctx, 12); err != nil { t.Fatal(err) }
	if _, err := client.Transaction(ctx, "0xtx"); err != nil { t.Fatal(err) }
	if _, err := client.Receipt(ctx, "0xtx"); err != nil { t.Fatal(err) }
	if _, err := client.BlockLogs(ctx, 12); err != nil { t.Fatal(err) }

	for _, path := range []string{"/v1/health", "/v1/blocks/12", "/v1/transactions/0xtx", "/v1/receipts/0xtx", "/v1/blocks/12/logs"} {
		if seen[path] != 1 { t.Fatalf("expected one 420Indexer request to %s, got %d", path, seen[path]) }
	}
}

func TestExplorerRejectsIndexerCanonicalAuthorityClaim(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(indexerapi.HealthResponse{Health: model.Health{ChainID: 420}, CanonicalAuthority: true})
	}))
	defer srv.Close()
	client, err := New(srv.URL, time.Second)
	if err != nil { t.Fatal(err) }
	if _, err := client.Health(context.Background()); err != ErrIndexerAuthorityViolation {
		t.Fatalf("expected authority violation, got %v", err)
	}
}

func TestExplorerIndexerClientRequiresHTTPServiceURL(t *testing.T) {
	if _, err := New("", time.Second); err == nil { t.Fatal("expected empty indexer URL to fail") }
	if _, err := New("not-a-url", time.Second); err == nil { t.Fatal("expected malformed indexer URL to fail") }
}

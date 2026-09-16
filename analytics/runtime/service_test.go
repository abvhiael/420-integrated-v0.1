package runtime

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/420integrated/420-integrated/analytics/indexerclient"
)

func TestRefreshQualifiesIndexerAndMarksReady(t *testing.T) {
	now := time.Now().UTC().Truncate(time.Second)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		switch r.URL.Path {
		case "/health":
			_ = json.NewEncoder(w).Encode(map[string]any{"status":"ok","apiVersion":"v1"})
		case "/ready":
			_ = json.NewEncoder(w).Encode(map[string]any{"apiVersion":"v1","data":map[string]any{"ready":true,"databaseReady":true,"chainId":"420","indexedHead":"100"}})
		case "/v1/status":
			_ = json.NewEncoder(w).Encode(map[string]any{"apiVersion":"v1","data":map[string]any{"chainId":"420","indexedHead":"100","indexedHeadHash":"0xabc","indexedHeadTimestamp":now.Unix(),"lag":"0","authoritative":false,"finality":map[string]any{"mode":"safe","confirmations":"5","safeHead":"95"}}})
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()

	client, err := indexerclient.New(server.URL, 420, time.Second, time.Minute)
	if err != nil { t.Fatal(err) }
	catalog := NewCatalog()
	service, err := New(client, catalog, time.Minute)
	if err != nil { t.Fatal(err) }
	if err := service.Refresh(context.Background()); err != nil { t.Fatal(err) }
	if !catalog.Ready() { t.Fatal("catalog should be ready") }
	status := catalog.Status()
	if status.ChainID != 420 || status.IndexedHeight != 100 || status.SafeHeight != 95 || status.Canonical || status.Stale {
		t.Fatalf("unexpected status: %#v", status)
	}
}

func TestRefreshFailsClosed(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { http.Error(w, "no", http.StatusServiceUnavailable) }))
	defer server.Close()
	client, _ := indexerclient.New(server.URL, 420, time.Second, time.Minute)
	catalog := NewCatalog()
	service, _ := New(client, catalog, time.Minute)
	if err := service.Refresh(context.Background()); err == nil { t.Fatal("expected refresh error") }
	if catalog.Ready() { t.Fatal("failed qualification must fail readiness closed") }
	if !catalog.Status().Stale { t.Fatal("failed qualification should expose stale status") }
}

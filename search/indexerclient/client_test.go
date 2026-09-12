package indexerclient

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func writeData(t *testing.T, w http.ResponseWriter, data any) {
	t.Helper()
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{"apiVersion":"v1", "data":data})
}

func TestQualifiedBoundaryPassesHealthyIndexer(t *testing.T) {
	now := time.Unix(2_000_000_000, 0)
	s := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/health":
			_ = json.NewEncoder(w).Encode(map[string]any{"status":"ok", "apiVersion":"v1"})
		case "/ready":
			writeData(t, w, map[string]any{"ready":true,"databaseReady":true,"chainId":"420","indexedHead":"100"})
		case "/v1/status":
			writeData(t, w, map[string]any{"chainId":"420","indexedHead":"100","indexedHeadHash":"0xabc","indexedHeadTimestamp":"1999999990","authoritative":false,"finality":map[string]any{"mode":"head","confirmations":nil,"safeHead":"100"},"lag":nil})
		default:
			http.NotFound(w, r)
		}
	}))
	defer s.Close()
	c, err := NewWithHTTPClient(s.URL, 420, time.Minute, s.Client())
	if err != nil { t.Fatal(err) }
	c.now = func() time.Time { return now }
	if err := c.Qualified(context.Background()); err != nil { t.Fatalf("expected qualified boundary: %v", err) }
}

func TestWrongChainFailsClosed(t *testing.T) {
	s := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/ready" {
			writeData(t, w, map[string]any{"ready":true,"databaseReady":true,"chainId":"421","indexedHead":"100"})
			return
		}
		http.NotFound(w, r)
	}))
	defer s.Close()
	c, _ := NewWithHTTPClient(s.URL, 420, time.Minute, s.Client())
	_, err := c.Readiness(context.Background())
	if !errors.Is(err, ErrWrongChain) { t.Fatalf("expected wrong-chain failure, got %v", err) }
}

func TestAuthoritativeIndexerFailsClosed(t *testing.T) {
	s := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		writeData(t, w, map[string]any{"chainId":"420","indexedHead":"100","indexedHeadHash":"0xabc","indexedHeadTimestamp":"2000000000","authoritative":true,"finality":map[string]any{"mode":"head","confirmations":nil,"safeHead":"100"},"lag":nil})
	}))
	defer s.Close()
	c, _ := NewWithHTTPClient(s.URL, 420, time.Minute, s.Client())
	c.now = func() time.Time { return time.Unix(2_000_000_001, 0) }
	_, err := c.Status(context.Background())
	if !errors.Is(err, ErrIndexerAuthoritative) { t.Fatalf("expected authority violation, got %v", err) }
}

func TestStaleIndexerFailsClosed(t *testing.T) {
	s := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		writeData(t, w, map[string]any{"chainId":"420","indexedHead":"100","indexedHeadHash":"0xabc","indexedHeadTimestamp":"100","authoritative":false,"finality":map[string]any{"mode":"head","confirmations":nil,"safeHead":"100"},"lag":nil})
	}))
	defer s.Close()
	c, _ := NewWithHTTPClient(s.URL, 420, time.Minute, s.Client())
	c.now = func() time.Time { return time.Unix(1000, 0) }
	_, err := c.Status(context.Background())
	if !errors.Is(err, ErrIndexerStale) { t.Fatalf("expected stale failure, got %v", err) }
}

func TestSearchUsesPublicIndexerBoundary(t *testing.T) {
	seen := false
	s := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1/search" { http.NotFound(w, r); return }
		if r.URL.Query().Get("chainId") != "420" || r.URL.Query().Get("q") != "42" || r.URL.Query().Get("limit") != "5" { t.Fatalf("unexpected query: %s", r.URL.RawQuery) }
		seen = true
		writeData(t, w, []any{map[string]any{"type":"block","key":"42","value":"0xabc"}})
	}))
	defer s.Close()
	c, _ := NewWithHTTPClient(s.URL, 420, time.Minute, s.Client())
	results, err := c.Search(context.Background(), "42", 5)
	if err != nil { t.Fatal(err) }
	if !seen || len(results) != 1 || results[0].Type != "block" { t.Fatalf("unexpected search results: %+v", results) }
}

func TestProtocolObjectUsesPublicIndexerBoundary(t *testing.T) {
	s := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1/protocols/420Registry/objects/service%3Afoo" && r.URL.Path != "/v1/protocols/420Registry/objects/service:foo" { http.NotFound(w, r); return }
		writeData(t, w, map[string]any{"protocol":"420Registry","objectKey":"service:foo","blockNumber":"9","txHash":"0xtx"})
	}))
	defer s.Close()
	c, _ := NewWithHTTPClient(s.URL, 420, time.Minute, s.Client())
	obj, err := c.ProtocolObject(context.Background(), "420Registry", "service:foo")
	if err != nil { t.Fatal(err) }
	if obj.Protocol != "420Registry" || obj.ObjectKey != "service:foo" { t.Fatalf("unexpected object: %+v", obj) }
}

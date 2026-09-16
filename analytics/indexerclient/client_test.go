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
			if r.URL.Query().Get("chainId") != "420" { t.Fatalf("unexpected chain query: %s", r.URL.RawQuery) }
			writeData(t, w, map[string]any{"ready":true,"databaseReady":true,"chainId":"420","indexedHead":"100"})
		case "/v1/status":
			writeData(t, w, map[string]any{"chainId":"420","indexedHead":"100","indexedHeadHash":"0xabc","indexedHeadTimestamp":"1999999990","authoritative":false,"finality":map[string]any{"mode":"head","confirmations":"12","safeHead":"98"},"lag":"2"})
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
		writeData(t, w, map[string]any{"ready":true,"databaseReady":true,"chainId":"421","indexedHead":"100"})
	}))
	defer s.Close()
	c, _ := NewWithHTTPClient(s.URL, 420, time.Minute, s.Client())
	_, err := c.Readiness(context.Background())
	if !errors.Is(err, ErrWrongChain) { t.Fatalf("expected wrong-chain failure, got %v", err) }
}

func TestAuthoritativeIndexerFailsClosed(t *testing.T) {
	s := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		writeData(t, w, map[string]any{"chainId":"420","indexedHead":"100","indexedHeadHash":"0xabc","indexedHeadTimestamp":"2000000000","authoritative":true,"finality":map[string]any{"mode":"head","confirmations":"12","safeHead":"98"},"lag":"2"})
	}))
	defer s.Close()
	c, _ := NewWithHTTPClient(s.URL, 420, time.Minute, s.Client())
	c.now = func() time.Time { return time.Unix(2_000_000_001, 0) }
	_, err := c.Status(context.Background())
	if !errors.Is(err, ErrIndexerAuthoritative) { t.Fatalf("expected authority violation, got %v", err) }
}

func TestStaleIndexerFailsClosed(t *testing.T) {
	s := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		writeData(t, w, map[string]any{"chainId":"420","indexedHead":"100","indexedHeadHash":"0xabc","indexedHeadTimestamp":"100","authoritative":false,"finality":map[string]any{"mode":"head","confirmations":"12","safeHead":"98"},"lag":"2"})
	}))
	defer s.Close()
	c, _ := NewWithHTTPClient(s.URL, 420, time.Minute, s.Client())
	c.now = func() time.Time { return time.Unix(1000, 0) }
	_, err := c.Status(context.Background())
	if !errors.Is(err, ErrIndexerStale) { t.Fatalf("expected stale failure, got %v", err) }
}

func TestFutureIndexerTimestampFailsClosed(t *testing.T) {
	s := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		writeData(t, w, map[string]any{"chainId":"420","indexedHead":"100","indexedHeadHash":"0xabc","indexedHeadTimestamp":"2000000100","authoritative":false,"finality":map[string]any{"mode":"head","confirmations":"12","safeHead":"98"},"lag":"2"})
	}))
	defer s.Close()
	c, _ := NewWithHTTPClient(s.URL, 420, time.Minute, s.Client())
	c.now = func() time.Time { return time.Unix(2_000_000_000, 0) }
	if _, err := c.Status(context.Background()); err == nil { t.Fatal("expected future timestamp failure") }
}

func TestSnapshotCarriesAnalyticsProvenance(t *testing.T) {
	s := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		writeData(t, w, map[string]any{"chainId":"420","indexedHead":"100","indexedHeadHash":"0xabc","indexedHeadTimestamp":"2000000000","authoritative":false,"finality":map[string]any{"mode":"head","confirmations":"12","safeHead":"98"},"lag":"2"})
	}))
	defer s.Close()
	c, _ := NewWithHTTPClient(s.URL, 420, time.Minute, s.Client())
	c.now = func() time.Time { return time.Unix(2_000_000_001, 0) }
	snap, err := c.Snapshot(context.Background())
	if err != nil { t.Fatal(err) }
	if snap.ChainID != 420 || snap.IndexedHeight != 100 || snap.SafeHeight != 98 || snap.IndexedHeadHash != "0xabc" { t.Fatalf("unexpected snapshot: %+v", snap) }
}

func TestSnapshotRejectsSafeHeadAboveIndexed(t *testing.T) {
	s := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		writeData(t, w, map[string]any{"chainId":"420","indexedHead":"100","indexedHeadHash":"0xabc","indexedHeadTimestamp":"2000000000","authoritative":false,"finality":map[string]any{"mode":"head","confirmations":"12","safeHead":"101"},"lag":"0"})
	}))
	defer s.Close()
	c, _ := NewWithHTTPClient(s.URL, 420, time.Minute, s.Client())
	c.now = func() time.Time { return time.Unix(2_000_000_001, 0) }
	if _, err := c.Snapshot(context.Background()); err == nil { t.Fatal("expected invalid snapshot failure") }
}

func TestProtocolObjectUsesOnlyPublicIndexerBoundary(t *testing.T) {
	s := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1/protocols/420Stake/objects/validator%3A42" && r.URL.Path != "/v1/protocols/420Stake/objects/validator:42" { http.NotFound(w, r); return }
		if r.URL.Query().Get("chainId") != "420" { t.Fatalf("missing chain binding: %s", r.URL.RawQuery) }
		writeData(t, w, map[string]any{"protocol":"420Stake","objectKey":"validator:42","blockNumber":"99","txHash":"0xtx","payload":map[string]any{"active":true}})
	}))
	defer s.Close()
	c, _ := NewWithHTTPClient(s.URL, 420, time.Minute, s.Client())
	obj, err := c.ProtocolObject(context.Background(), "420Stake", "validator:42")
	if err != nil { t.Fatal(err) }
	if obj.Protocol != "420Stake" || obj.ObjectKey != "validator:42" || obj.BlockNumber != "99" { t.Fatalf("unexpected object: %+v", obj) }
}

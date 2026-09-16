package runtime

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"

	"github.com/420integrated/420-integrated/analytics/indexerclient"
)

type upstreamState struct {
	mu sync.RWMutex
	indexed string
	safe string
	hash string
	timestamp string
}

func (s *upstreamState) set(indexed, safe, hash, timestamp string) { s.mu.Lock(); defer s.mu.Unlock(); s.indexed=indexed; s.safe=safe; s.hash=hash; s.timestamp=timestamp }
func (s *upstreamState) snapshot() (string,string,string,string) { s.mu.RLock(); defer s.mu.RUnlock(); return s.indexed,s.safe,s.hash,s.timestamp }

func testIndexer(t *testing.T, state *upstreamState) (*httptest.Server, *indexerclient.Client) {
	t.Helper()
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		indexed,safe,hash,ts := state.snapshot()
		w.Header().Set("Content-Type", "application/json")
		switch r.URL.Path {
		case "/health":
			_ = json.NewEncoder(w).Encode(map[string]any{"status":"ok","apiVersion":"v1"})
		case "/ready":
			_ = json.NewEncoder(w).Encode(map[string]any{"apiVersion":"v1","data":map[string]any{"ready":true,"databaseReady":true,"chainId":"420","indexedHead":indexed}})
		case "/v1/status":
			_ = json.NewEncoder(w).Encode(map[string]any{"apiVersion":"v1","data":map[string]any{"chainId":"420","indexedHead":indexed,"indexedHeadHash":hash,"indexedHeadTimestamp":ts,"lag":"0","authoritative":false,"finality":map[string]any{"mode":"safe","confirmations":"5","safeHead":safe}}})
		default:
			http.NotFound(w,r)
		}
	}))
	client, err := indexerclient.New(server.URL, 420, time.Second, 24*time.Hour)
	if err != nil { server.Close(); t.Fatal(err) }
	return server, client
}

func TestRestartRebuildProducesIdenticalDerivedSnapshot(t *testing.T) {
	ts := time.Now().UTC().Add(-time.Minute).Unix()
	state := &upstreamState{}
	state.set("100","95","0xaaa",formatUnix(ts))
	server, client := testIndexer(t,state); defer server.Close()

	firstCatalog := NewCatalog()
	first, _ := New(client, firstCatalog, 24*time.Hour)
	if err := first.Refresh(context.Background()); err != nil { t.Fatal(err) }
	firstSnapshots := firstCatalog.Snapshots()
	if len(firstSnapshots) != 1 { t.Fatalf("first snapshots=%d", len(firstSnapshots)) }

	secondCatalog := NewCatalog()
	second, _ := New(client, secondCatalog, 24*time.Hour)
	if err := second.Refresh(context.Background()); err != nil { t.Fatal(err) }
	secondSnapshots := secondCatalog.Snapshots()
	if len(secondSnapshots) != 1 { t.Fatalf("second snapshots=%d", len(secondSnapshots)) }
	if firstSnapshots[0].ID != secondSnapshots[0].ID { t.Fatalf("rebuild changed snapshot identity: %s != %s", firstSnapshots[0].ID, secondSnapshots[0].ID) }
	if len(firstCatalog.Metrics()) != len(secondCatalog.Metrics()) { t.Fatal("rebuild changed seeded metric count") }
}

func TestNonSafeSnapshotReconcilesDeterministicallyOnReorg(t *testing.T) {
	ts := time.Now().UTC().Add(-time.Minute).Unix()
	state := &upstreamState{}
	state.set("100","95","0xaaa",formatUnix(ts))
	server, client := testIndexer(t,state); defer server.Close()
	catalog := NewCatalog()
	service, _ := New(client,catalog,24*time.Hour)
	if err := service.Refresh(context.Background()); err != nil { t.Fatal(err) }
	before := catalog.Snapshots()
	if len(before) != 1 { t.Fatalf("before snapshots=%d",len(before)) }

	state.set("100","96","0xbbb",formatUnix(ts))
	if err := service.Refresh(context.Background()); err != nil { t.Fatal(err) }
	after := catalog.Snapshots()
	if len(after) != 1 { t.Fatalf("reorg should replace same slot, snapshots=%d",len(after)) }
	if before[0].ID == after[0].ID { t.Fatal("reorg replacement should change content-bound snapshot identity") }
	if after[0].Provenance.IndexedHeadHash != "0xbbb" || after[0].Provenance.SafeHeight != 96 { t.Fatalf("replacement provenance=%#v",after[0].Provenance) }
}

func TestSafeHeightRegressionFailsClosed(t *testing.T) {
	ts1 := time.Now().UTC().Add(-2*time.Minute).Unix()
	ts2 := time.Now().UTC().Add(-time.Minute).Unix()
	state := &upstreamState{}
	state.set("100","95","0xaaa",formatUnix(ts1))
	server, client := testIndexer(t,state); defer server.Close()
	catalog := NewCatalog(); service,_ := New(client,catalog,24*time.Hour)
	if err := service.Refresh(context.Background()); err != nil { t.Fatal(err) }
	state.set("101","94","0xbbb",formatUnix(ts2))
	if err := service.Refresh(context.Background()); err == nil { t.Fatal("safe-height regression must fail") }
	if catalog.Ready() { t.Fatal("safe-height regression must fail readiness closed") }
	if !catalog.Status().Stale { t.Fatal("failed reconciliation must expose stale status") }
}

func formatUnix(v int64) string { return fmt.Sprintf("%d",v) }

package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	indexerapi "github.com/420integrated/420-integrated/indexer/api"
	"github.com/420integrated/420-integrated/indexer/model"
)

func env(values map[string]string) func(string) string {
	return func(key string) string { return values[key] }
}

func TestLoadConfigDefaults(t *testing.T) {
	cfg, err := loadConfig(env(map[string]string{"EXPLORER_INDEXER_URL": "http://127.0.0.1:9420"}))
	if err != nil { t.Fatal(err) }
	if cfg.ListenAddr != ":8420" || cfg.RequiredChainID != 420 { t.Fatalf("unexpected config: %+v", cfg) }
	if cfg.StaleAfter != 2*time.Minute || cfg.IndexerTimeout != 10*time.Second || cfg.ShutdownTimeout != 10*time.Second {
		t.Fatalf("unexpected durations: %+v", cfg)
	}
}

func TestLoadConfigOverrides(t *testing.T) {
	cfg, err := loadConfig(env(map[string]string{
		"EXPLORER_INDEXER_URL":      "https://indexer.example",
		"EXPLORER_LISTEN_ADDR":      "127.0.0.1:18420",
		"EXPLORER_CHAIN_ID":         "421",
		"EXPLORER_STALE_AFTER":      "45s",
		"EXPLORER_INDEXER_TIMEOUT":  "3s",
		"EXPLORER_SHUTDOWN_TIMEOUT": "4s",
	}))
	if err != nil { t.Fatal(err) }
	if cfg.ListenAddr != "127.0.0.1:18420" || cfg.RequiredChainID != 421 || cfg.StaleAfter != 45*time.Second || cfg.IndexerTimeout != 3*time.Second || cfg.ShutdownTimeout != 4*time.Second {
		t.Fatalf("unexpected config: %+v", cfg)
	}
}

func TestLoadConfigRejectsInvalidValues(t *testing.T) {
	cases := []map[string]string{
		{},
		{"EXPLORER_INDEXER_URL": "http://indexer", "EXPLORER_CHAIN_ID": "0"},
		{"EXPLORER_INDEXER_URL": "http://indexer", "EXPLORER_STALE_AFTER": "nope"},
		{"EXPLORER_INDEXER_URL": "http://indexer", "EXPLORER_INDEXER_TIMEOUT": "0s"},
	}
	for i, values := range cases {
		if _, err := loadConfig(env(values)); err == nil { t.Fatalf("case %d expected error", i) }
	}
}

func TestRuntimeReadyUsesRealIndexerHTTPBoundary(t *testing.T) {
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1/health" { http.NotFound(w, r); return }
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(indexerapi.HealthResponse{Health: model.Health{
			ChainID: 420, IndexedHeight: 100, SafeHeight: 99, FinalizedHeight: 98,
			SchemaVersion: "v1", DecoderSet: "genesis", State: "READY", LastIngestAt: time.Now().UTC(),
		}})
	}))
	defer upstream.Close()

	server, err := newHTTPServer(config{
		ListenAddr: ":0", IndexerURL: upstream.URL, RequiredChainID: 420,
		StaleAfter: time.Minute, IndexerTimeout: time.Second, ShutdownTimeout: time.Second,
	})
	if err != nil { t.Fatal(err) }
	rr := httptest.NewRecorder()
	server.Handler.ServeHTTP(rr, httptest.NewRequest(http.MethodGet, "/v1/ready", nil))
	if rr.Code != http.StatusOK { t.Fatalf("status=%d body=%s", rr.Code, rr.Body.String()) }
	if rr.Header().Get("X-420-Data-Source") != "420Indexer" || rr.Header().Get("X-420-Canonical-Authority") != "false" {
		t.Fatalf("missing qualified boundary headers: %+v", rr.Header())
	}
}

func TestRuntimeStartsWithUnavailableIndexerAndFailsReadinessOnly(t *testing.T) {
	server, err := newHTTPServer(config{
		ListenAddr: ":0", IndexerURL: "http://127.0.0.1:1", RequiredChainID: 420,
		StaleAfter: time.Minute, IndexerTimeout: 50*time.Millisecond, ShutdownTimeout: time.Second,
	})
	if err != nil { t.Fatal(err) }

	health := httptest.NewRecorder()
	server.Handler.ServeHTTP(health, httptest.NewRequest(http.MethodGet, "/v1/health", nil))
	if health.Code != http.StatusOK { t.Fatalf("health status=%d body=%s", health.Code, health.Body.String()) }

	ready := httptest.NewRecorder()
	server.Handler.ServeHTTP(ready, httptest.NewRequest(http.MethodGet, "/v1/ready", nil))
	if ready.Code != http.StatusBadGateway { t.Fatalf("ready status=%d body=%s", ready.Code, ready.Body.String()) }
}

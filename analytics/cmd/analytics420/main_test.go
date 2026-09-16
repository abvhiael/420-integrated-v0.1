package main

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestLoadConfigRequiresIndexer(t *testing.T) {
	_, err := loadConfig(func(string) string { return "" })
	if err == nil { t.Fatal("expected missing indexer URL error") }
}

func TestLoadConfigDefaultsAndOverrides(t *testing.T) {
	values := map[string]string{
		"ANALYTICS_INDEXER_URL":"http://127.0.0.1:9999",
		"ANALYTICS_LISTEN_ADDR":"127.0.0.1:9000",
		"ANALYTICS_CHAIN_ID":"421",
		"ANALYTICS_STALE_AFTER":"3m",
		"ANALYTICS_INDEXER_TIMEOUT":"5s",
		"ANALYTICS_REFRESH_INTERVAL":"20s",
		"ANALYTICS_SHUTDOWN_TIMEOUT":"7s",
	}
	cfg, err := loadConfig(func(k string) string { return values[k] })
	if err != nil { t.Fatal(err) }
	if cfg.ListenAddr != "127.0.0.1:9000" || cfg.RequiredChainID != 421 || cfg.StaleAfter != 3*time.Minute || cfg.RefreshInterval != 20*time.Second {
		t.Fatalf("unexpected config: %#v", cfg)
	}
}

func TestLoadConfigRejectsInvalidDuration(t *testing.T) {
	values := map[string]string{"ANALYTICS_INDEXER_URL":"http://127.0.0.1:9999", "ANALYTICS_REFRESH_INTERVAL":"0s"}
	if _, err := loadConfig(func(k string) string { return values[k] }); err == nil { t.Fatal("expected invalid duration error") }
}

func TestHTTPServerMountsOperationalRoutes(t *testing.T) {
	indexer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { http.Error(w, "unavailable", http.StatusServiceUnavailable) }))
	defer indexer.Close()
	cfg := config{ListenAddr:":0", IndexerURL:indexer.URL, RequiredChainID:420, StaleAfter:time.Minute, IndexerTimeout:time.Second, RefreshInterval:time.Second, ShutdownTimeout:time.Second}
	server, service, err := newHTTPServer(cfg)
	if err != nil { t.Fatal(err) }
	if service == nil || server.Handler == nil { t.Fatal("runtime server incomplete") }
	for _, path := range []string{"/health", "/ready", "/dashboard", "/v1/status"} {
		rr := httptest.NewRecorder()
		server.Handler.ServeHTTP(rr, httptest.NewRequest(http.MethodGet, path, nil))
		if rr.Code == http.StatusNotFound { t.Fatalf("route %s not mounted", path) }
	}
}

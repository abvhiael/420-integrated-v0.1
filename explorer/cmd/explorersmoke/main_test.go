package main

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func testExplorer(t *testing.T, chainID uint64, ready bool) *httptest.Server {
	t.Helper()
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-420-Service", "420Explorer")
		w.Header().Set("X-420-Data-Source", "420Indexer")
		w.Header().Set("X-420-Canonical-Authority", "false")
		w.Header().Set("X-420-Consumer-Qualification", "QUALIFIED_INDEXER_API_CONSUMER")
		w.Header().Set("Content-Type", "application/json")
		switch r.URL.Path {
		case "/v1/health":
			_ = json.NewEncoder(w).Encode(healthResponse{Status: "LIVE", DataSource: "420Indexer", CanonicalAuthority: false})
		case "/v1/ready":
			if !ready { w.WriteHeader(http.StatusServiceUnavailable) }
			_ = json.NewEncoder(w).Encode(readinessResponse{Ready: ready, Status: networkStatus{ChainID: chainID, Ready: ready}})
		case "/v1/status":
			_ = json.NewEncoder(w).Encode(networkStatus{ChainID: chainID, Ready: ready})
		case "/v1/capabilities":
			_ = json.NewEncoder(w).Encode(capabilitiesResponse{
				DataSource: "420Indexer", CanonicalAuthority: false,
				Qualification: "QUALIFIED_INDEXER_API_CONSUMER",
				Endpoints: []string{"1","2","3","4","5","6","7","8","9","10"},
			})
		default:
			http.NotFound(w, r)
		}
	}))
}

func TestLoadConfig(t *testing.T) {
	cfg, err := loadConfig(func(key string) string {
		switch key {
		case "EXPLORER_SMOKE_URL": return "https://explorer.test/"
		case "EXPLORER_SMOKE_CHAIN_ID": return "421"
		case "EXPLORER_SMOKE_TIMEOUT": return "3s"
		default: return ""
		}
	})
	if err != nil { t.Fatal(err) }
	if cfg.BaseURL != "https://explorer.test" || cfg.RequiredChainID != 421 || cfg.Timeout != 3*time.Second { t.Fatalf("unexpected config: %+v", cfg) }
}

func TestQualifyAcceptsHealthyQualifiedExplorer(t *testing.T) {
	server := testExplorer(t, 420, true)
	defer server.Close()
	cfg := config{BaseURL: server.URL, RequiredChainID: 420, Timeout: time.Second}
	if err := qualify(context.Background(), server.Client(), cfg); err != nil { t.Fatal(err) }
}

func TestQualifyRejectsWrongChain(t *testing.T) {
	server := testExplorer(t, 1, true)
	defer server.Close()
	cfg := config{BaseURL: server.URL, RequiredChainID: 420, Timeout: time.Second}
	if err := qualify(context.Background(), server.Client(), cfg); err == nil { t.Fatal("expected wrong-chain failure") }
}

func TestQualifyRejectsUnavailableReadiness(t *testing.T) {
	server := testExplorer(t, 420, false)
	defer server.Close()
	cfg := config{BaseURL: server.URL, RequiredChainID: 420, Timeout: time.Second}
	if err := qualify(context.Background(), server.Client(), cfg); err == nil { t.Fatal("expected readiness failure") }
}

func TestQualifyRejectsMissingProvenance(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(healthResponse{Status: "LIVE", DataSource: "420Indexer"})
	}))
	defer server.Close()
	cfg := config{BaseURL: server.URL, RequiredChainID: 420, Timeout: time.Second}
	if err := qualify(context.Background(), server.Client(), cfg); err == nil { t.Fatal("expected provenance failure") }
}

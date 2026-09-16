package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestValidatorAcceptsQualifiedAnalyticsRuntime(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		switch r.URL.Path {
		case "/health":
			_ = json.NewEncoder(w).Encode(map[string]any{"status":"ok","apiVersion":"v1","service":"420Analytics"})
		case "/ready":
			_ = json.NewEncoder(w).Encode(map[string]any{"ready":true,"apiVersion":"v1"})
		case "/v1/status":
			_ = json.NewEncoder(w).Encode(map[string]any{"chainId":420,"indexedHeight":100,"safeHeight":95,"indexedAt":"2026-09-16T05:00:00Z","stale":false,"canonical":false})
		case "/v1/capabilities":
			_ = json.NewEncoder(w).Encode(map[string]any{"apiVersion":"v1","canonical":false,"rebuildable":true})
		case "/v1/metrics":
			items := []any{}
			for _, id := range []string{"network.indexed_height","network.safe_height","network.finality_depth","network.projection_lag"} {
				items = append(items, map[string]any{"id":id,"canonical":false,"provenance":map[string]any{"source":"420Indexer"},"methodology":map[string]any{"id":"method."+id,"version":"v1"}})
			}
			_ = json.NewEncoder(w).Encode(map[string]any{"items":items,"count":4})
		case "/v1/snapshots":
			_ = json.NewEncoder(w).Encode(map[string]any{"items":[]any{map[string]any{"id":"snap-1","provenance":map[string]any{"source":"420Indexer"}}},"count":1})
		case "/v1/methodologies":
			_ = json.NewEncoder(w).Encode(map[string]any{"items":[]any{1,2,3,4},"count":4})
		default:
			http.NotFound(w,r)
		}
	}))
	defer server.Close()
	v := newValidator(server.URL, server.Client())
	report := v.run()
	if !report.Passed { t.Fatalf("qualification failed: %#v", report.Checks) }
	if report.Schema != "420-analytics-testnet-qualification-v1" || report.Phase != "ANALYTICS-9" { t.Fatalf("unexpected report identity: %#v", report) }
}

func TestValidatorFailsWhenSeededMetricMissing(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		switch r.URL.Path {
		case "/health": _ = json.NewEncoder(w).Encode(map[string]any{"status":"ok","apiVersion":"v1","service":"420Analytics"})
		case "/ready": _ = json.NewEncoder(w).Encode(map[string]any{"ready":true})
		case "/v1/status": _ = json.NewEncoder(w).Encode(map[string]any{"chainId":420,"indexedHeight":100,"safeHeight":95,"stale":false,"canonical":false})
		case "/v1/capabilities": _ = json.NewEncoder(w).Encode(map[string]any{"canonical":false,"rebuildable":true})
		case "/v1/metrics": _ = json.NewEncoder(w).Encode(map[string]any{"items":[]any{},"count":0})
		case "/v1/snapshots": _ = json.NewEncoder(w).Encode(map[string]any{"items":[]any{map[string]any{"provenance":map[string]any{"source":"420Indexer"}}},"count":1})
		case "/v1/methodologies": _ = json.NewEncoder(w).Encode(map[string]any{"count":4})
		default: http.NotFound(w,r)
		}
	}))
	defer server.Close()
	if report := newValidator(server.URL, server.Client()).run(); report.Passed { t.Fatal("missing seeded metrics must fail qualification") }
}

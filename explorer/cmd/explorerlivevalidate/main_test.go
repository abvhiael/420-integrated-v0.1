package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func qualifiedHeaders(w http.ResponseWriter) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("X-420-Service", "420Explorer")
	w.Header().Set("X-420-Data-Source", "420Indexer")
	w.Header().Set("X-420-Canonical-Authority", "false")
	w.Header().Set("X-420-Consumer-Qualification", "QUALIFIED_INDEXER_API_CONSUMER")
}

func fixtureServer(t *testing.T, withLogs bool) *httptest.Server {
	t.Helper()
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		qualifiedHeaders(w)
		var body any = map[string]any{}
		switch r.URL.Path {
		case "/v1/health": body = map[string]any{"status":"LIVE"}
		case "/v1/ready": body = map[string]any{"ready":true}
		case "/v1/status": body = map[string]any{"chainId":420,"ready":true}
		case "/v1/capabilities": body = map[string]any{"dataSource":"420Indexer"}
		case "/v1/blocks": body = map[string]any{"blocks":[]any{map[string]any{"number":7,"hash":"0xblock"}},"meta":map[string]any{"chainId":420}}
		case "/v1/blocks/7":
			logs := []any{}
			if withLogs { logs = append(logs, map[string]any{"transactionHash":"0xtx","address":"0xcontract"}) }
			body = map[string]any{"block":map[string]any{"number":7,"hash":"0xblock"},"logs":logs}
		case "/v1/transactions/0xtx": body = map[string]any{"transaction":map[string]any{"hash":"0xtx"}}
		case "/v1/receipts/0xtx": body = map[string]any{"receipt":map[string]any{"transactionHash":"0xtx"}}
		case "/v1/addresses/0xcontract": body = map[string]any{"address":"0xcontract"}
		case "/v1/services": body = map[string]any{"services":[]any{map[string]any{"serviceId":"420Registry"}},"count":1}
		case "/v1/services/420Registry": body = map[string]any{"serviceId":"420Registry"}
		case "/v1/assets/activity": body = map[string]any{"transfers":[]any{}}
		case "/v1/consensus": body = map[string]any{"currentSlot":42}
		default: http.NotFound(w,r); return
		}
		_ = json.NewEncoder(w).Encode(body)
	}))
}

func TestLiveValidatorPassesRepresentativeQualifiedData(t *testing.T) {
	server := fixtureServer(t, true)
	defer server.Close()
	v := newValidator(server.URL, 420, &http.Client{Timeout:time.Second})
	got := v.run()
	if !got.Passed { t.Fatalf("expected pass: %+v", got.Checks) }
	if got.Samples["blockNumber"] != uint64(7) || got.Samples["transactionHash"] != "0xtx" || got.Samples["address"] != "0xcontract" || got.Samples["serviceId"] != "420Registry" {
		t.Fatalf("unexpected samples: %+v", got.Samples)
	}
}

func TestLiveValidatorRequiresTransactionAndAddressEvidence(t *testing.T) {
	server := fixtureServer(t, false)
	defer server.Close()
	v := newValidator(server.URL, 420, &http.Client{Timeout:time.Second})
	got := v.run()
	if got.Passed { t.Fatalf("expected failure without live tx/address evidence") }
	failed := map[string]bool{}
	for _, c := range got.Checks { if !c.Passed { failed[c.Name] = true } }
	if !failed["transaction.sample"] || !failed["address.sample"] { t.Fatalf("missing expected evidence failures: %+v", got.Checks) }
}

func TestLiveValidatorRejectsUnqualifiedBoundary(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{"status":"LIVE"})
	}))
	defer server.Close()
	v := newValidator(server.URL, 420, &http.Client{Timeout:time.Second})
	got := v.run()
	if got.Passed { t.Fatalf("expected failure for unqualified responses") }
	if len(got.Checks) == 0 || got.Checks[0].Passed { t.Fatalf("expected first boundary check to fail: %+v", got.Checks) }
}

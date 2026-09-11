package web

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestHandlerServesExplorerShell(t *testing.T) {
	rr := httptest.NewRecorder()
	Handler().ServeHTTP(rr, httptest.NewRequest(http.MethodGet, "/", nil))
	if rr.Code != http.StatusOK { t.Fatalf("status=%d body=%s", rr.Code, rr.Body.String()) }
	body := rr.Body.String()
	if !strings.Contains(body, "420Explorer") || !strings.Contains(body, "global-search") {
		t.Fatalf("unexpected shell body: %s", body)
	}
	if got := rr.Header().Get("Content-Security-Policy"); !strings.Contains(got, "connect-src 'self'") {
		t.Fatalf("missing CSP: %q", got)
	}
	if got := rr.Header().Get("X-Content-Type-Options"); got != "nosniff" { t.Fatalf("nosniff=%q", got) }
}

func TestHandlerServesStaticAssets(t *testing.T) {
	for _, path := range []string{"/app.css", "/app.js"} {
		rr := httptest.NewRecorder()
		Handler().ServeHTTP(rr, httptest.NewRequest(http.MethodGet, path, nil))
		if rr.Code != http.StatusOK { t.Fatalf("%s status=%d", path, rr.Code) }
		if rr.Body.Len() == 0 { t.Fatalf("%s empty body", path) }
	}
}

func TestExplorerScriptContainsQualifiedCoreDetailViews(t *testing.T) {
	rr := httptest.NewRecorder()
	Handler().ServeHTTP(rr, httptest.NewRequest(http.MethodGet, "/app.js", nil))
	if rr.Code != http.StatusOK { t.Fatalf("status=%d", rr.Code) }
	body := rr.Body.String()
	for _, marker := range []string{
		"Transaction history",
		"Direction",
		"Created contract",
		"Runtime bytecode",
		"Deployment transaction",
		"Block hash",
		"logTable(logs)",
	} {
		if !strings.Contains(body, marker) {
			t.Fatalf("app.js missing EXP-5.2 marker %q", marker)
		}
	}
	for _, endpoint := range []string{"/v1/blocks/", "/v1/transactions/", "/v1/addresses/", "/v1/contracts/"} {
		if !strings.Contains(body, endpoint) {
			t.Fatalf("app.js missing qualified endpoint %q", endpoint)
		}
	}
	if strings.Contains(body, "eth_get") || strings.Contains(body, "INDEXER_RPC_URL") {
		t.Fatal("frontend must not introduce direct RPC access")
	}
}

func TestExplorerScriptContainsAdvancedPresentationViews(t *testing.T) {
	rr := httptest.NewRecorder()
	Handler().ServeHTTP(rr, httptest.NewRequest(http.MethodGet, "/app.js", nil))
	if rr.Code != http.StatusOK { t.Fatalf("status=%d", rr.Code) }
	body := rr.Body.String()
	for _, marker := range []string{
		"Version history",
		"Dependency root",
		"Asset activity",
		"Token ID",
		"scheduledProposer",
		"latestQc",
		"quorumParticipationPercent",
		"Active seats",
		"Finality ordering",
		"WRONG CHAIN",
		"fail-closed",
	} {
		if !strings.Contains(body, marker) {
			t.Fatalf("app.js missing EXP-5.3 marker %q", marker)
		}
	}
	for _, endpoint := range []string{"/v1/services", "/v1/assets/activity", "/v1/consensus", "/v1/status"} {
		if !strings.Contains(body, endpoint) {
			t.Fatalf("app.js missing qualified EXP-5.3 endpoint %q", endpoint)
		}
	}
	for _, obsolete := range []string{"c.proposer?.primarySeat", "c.latestQC?.signerCount", "['Slot',c.slot]"} {
		if strings.Contains(body, obsolete) {
			t.Fatalf("app.js still references obsolete consensus field %q", obsolete)
		}
	}
	if strings.Contains(body, "eth_get") || strings.Contains(body, "INDEXER_RPC_URL") {
		t.Fatal("frontend must not introduce direct RPC access")
	}
}

func TestHandlerRejectsMutationMethods(t *testing.T) {
	rr := httptest.NewRecorder()
	Handler().ServeHTTP(rr, httptest.NewRequest(http.MethodPost, "/", strings.NewReader("x")))
	if rr.Code != http.StatusMethodNotAllowed { t.Fatalf("status=%d", rr.Code) }
}

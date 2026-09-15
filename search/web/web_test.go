package web

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestHandlerServesSearchShell(t *testing.T) {
	rr := httptest.NewRecorder()
	Handler().ServeHTTP(rr, httptest.NewRequest(http.MethodGet, "/", nil))
	if rr.Code != http.StatusOK { t.Fatalf("status=%d body=%s", rr.Code, rr.Body.String()) }
	body := rr.Body.String()
	for _, marker := range []string{"420Search", "global-search", "data-domain", "Capabilities", "Status"} {
		if !strings.Contains(body, marker) { t.Fatalf("shell missing %q", marker) }
	}
	if got := rr.Header().Get("X-Content-Type-Options"); got != "nosniff" { t.Fatalf("nosniff=%q", got) }
	if got := rr.Header().Get("Content-Security-Policy"); !strings.Contains(got, "connect-src 'self'") { t.Fatalf("missing CSP: %q", got) }
}

func TestHandlerServesSearchAssets(t *testing.T) {
	for _, path := range []string{"/app.css", "/app.js"} {
		rr := httptest.NewRecorder()
		Handler().ServeHTTP(rr, httptest.NewRequest(http.MethodGet, path, nil))
		if rr.Code != http.StatusOK { t.Fatalf("%s status=%d", path, rr.Code) }
		if rr.Body.Len() == 0 { t.Fatalf("%s empty body", path) }
	}
}

func TestSearchShellUsesOnlyVersionedSearchAPI(t *testing.T) {
	rr := httptest.NewRecorder()
	Handler().ServeHTTP(rr, httptest.NewRequest(http.MethodGet, "/app.js", nil))
	if rr.Code != http.StatusOK { t.Fatal(rr.Code) }
	body := rr.Body.String()
	for _, endpoint := range []string{"/v1/search", "/v1/status", "/v1/capabilities"} {
		if !strings.Contains(body, endpoint) { t.Fatalf("app.js missing %q", endpoint) }
	}
	for _, forbidden := range []string{"eth_get", "INDEXER_RPC_URL", "/v1/blocks/", "/v1/transactions/"} {
		if strings.Contains(body, forbidden) { t.Fatalf("frontend bypasses Search API via %q", forbidden) }
	}
}

func TestSearchShellContainsNavigationAndFilterBehavior(t *testing.T) {
	rr := httptest.NewRecorder()
	Handler().ServeHTTP(rr, httptest.NewRequest(http.MethodGet, "/app.js", nil))
	body := rr.Body.String()
	for _, marker := range []string{"queryText", "activeDomain", "domain:", "load-more", "hashchange"} {
		if !strings.Contains(body, marker) { t.Fatalf("app.js missing SEARCH-7.1 marker %q", marker) }
	}
}

func TestSearchShellContainsDomainAwareResultPresentation(t *testing.T) {
	rr := httptest.NewRecorder()
	Handler().ServeHTTP(rr, httptest.NewRequest(http.MethodGet, "/app.js", nil))
	if rr.Code != http.StatusOK { t.Fatal(rr.Code) }
	body := rr.Body.String()
	for _, marker := range []string{"domainPresentation","public_identity","market_listing","rights_record","public_commons","public_pulse","resultCard","Open canonical view","Source","Category","Sponsored","organic ranking unchanged"} {
		if !strings.Contains(body, marker) { t.Fatalf("app.js missing SEARCH-7.2 marker %q", marker) }
	}
}

func TestSearchShellContainsTrustPresentation(t *testing.T) {
	rr := httptest.NewRecorder()
	Handler().ServeHTTP(rr, httptest.NewRequest(http.MethodGet, "/app.js", nil))
	if rr.Code != http.StatusOK { t.Fatal(rr.Code) }
	body := rr.Body.String()
	for _, marker := range []string{"finalityBadge","authorityBadge","trustMeta","snapshotBanner","Finalized","Safe","Unknown finality","Canonical authority","Search results are rebuildable projections","420Search is non-canonical","fails closed"} {
		if !strings.Contains(body, marker) { t.Fatalf("app.js missing SEARCH-7.3 marker %q", marker) }
	}
}

func TestSearchStylesContainTrustClasses(t *testing.T) {
	rr := httptest.NewRecorder()
	Handler().ServeHTTP(rr, httptest.NewRequest(http.MethodGet, "/app.css", nil))
	body := rr.Body.String()
	for _, marker := range []string{".trust-meta", ".trust-finalized", ".trust-safe", ".trust-head", ".trust-unknown", ".snapshot-banner", ".trust-callout"} {
		if !strings.Contains(body, marker) { t.Fatalf("app.css missing SEARCH-7.3 marker %q", marker) }
	}
}

func TestSearchShellSeparatesSponsoredAndOrganicResults(t *testing.T) {
	rr := httptest.NewRecorder()
	Handler().ServeHTTP(rr, httptest.NewRequest(http.MethodGet, "/app.js", nil))
	body := rr.Body.String()
	for _, marker := range []string{"sponsored-section", "organic-section", "result-sponsored", "sponsored-badge"} {
		if !strings.Contains(body, marker) { t.Fatalf("app.js missing sponsored separation marker %q", marker) }
	}
}

func TestHandlerRejectsMutationMethods(t *testing.T) {
	rr := httptest.NewRecorder()
	Handler().ServeHTTP(rr, httptest.NewRequest(http.MethodPost, "/", strings.NewReader("x")))
	if rr.Code != http.StatusMethodNotAllowed { t.Fatalf("status=%d", rr.Code) }
}

package publicservice

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	appstoreapi "github.com/420integrated/420-integrated/appstore/api"
	"github.com/420integrated/420-integrated/appstore/curation"
	"github.com/420integrated/420-integrated/appstore/hardening"
	appregistry "github.com/420integrated/420-integrated/appstore/registry"
	appstoreruntime "github.com/420integrated/420-integrated/appstore/runtime"
	"github.com/420integrated/420-integrated/appstore/security"
	"github.com/420integrated/420-integrated/appstore/wallet"
)

type fakeProbe struct {
	chainID uint64
}

func (f fakeProbe) ChainID(context.Context) (uint64, error) { return f.chainID, nil }
func (f fakeProbe) RegistryAvailable(context.Context) error { return nil }

type staticViews struct {
	views []appstoreapi.ApplicationView
}

func (s staticViews) Snapshot() []appstoreapi.ApplicationView {
	return append([]appstoreapi.ApplicationView(nil), s.views...)
}

func qualifiedRuntime(t *testing.T) *appstoreruntime.Service {
	t.Helper()
	cfg := appstoreruntime.Config{
		ChainID:         420,
		RPCURL:          "http://127.0.0.1:8545",
		IndexerURL:      "http://127.0.0.1:8420",
		RegistryAddress: "0x1111111111111111111111111111111111111111",
		CatalogueStore:  "./catalogue",
		ListenAddr:      ":8426",
	}
	svc, err := appstoreruntime.NewService(cfg, fakeProbe{chainID: 420})
	if err != nil {
		t.Fatal(err)
	}
	if err := svc.Qualify(context.Background()); err != nil {
		t.Fatal(err)
	}
	return svc
}

func publicView(t *testing.T) appstoreapi.ApplicationView {
	t.Helper()
	record := appregistry.VersionRecord{
		ServiceID:      "420/service/demo/v1",
		Version:        1,
		Implementation: "0x1111111111111111111111111111111111111111",
		CodeHash:       "0x" + strings.Repeat("a", 64),
		MetadataHash:   "0x" + strings.Repeat("b", 64),
		Active:         true,
		BlockNumber:    10,
		BlockHash:      "0x" + strings.Repeat("c", 64),
	}
	listing, err := curation.Compose(record, curation.Metadata{
		ServiceID:   record.ServiceID,
		Categories:  []string{"tools"},
		Description: "demo",
	})
	if err != nil {
		t.Fatal(err)
	}
	sec, err := security.Build(record.ServiceID, record.Version, []security.Evidence{
		{Kind: security.KindVerification, Source: "420Verify", Reference: "verify:demo", Status: "FULL_MATCH", Severity: security.SeverityInfo, ObservedAt: 100},
		{Kind: security.KindAudit, Source: "auditor", Reference: "audit:demo", Status: "PUBLISHED", Severity: security.SeverityInfo, ObservedAt: 90},
	})
	if err != nil {
		t.Fatal(err)
	}
	walletView, err := wallet.Build(wallet.Request{
		ChainID:   420,
		ServiceID: record.ServiceID,
		AppURL:    "https://demo.example/app",
	})
	if err != nil {
		t.Fatal(err)
	}
	return appstoreapi.ApplicationView{
		Listing:  listing,
		Security: sec,
		Wallet:   walletView,
		Links:    appstoreapi.Links{Direct: "https://demo.example/app"},
	}
}

func TestHandlerMountsHealthAPIAndFrontend(t *testing.T) {
	deps := NewDependencyState(hardening.Dependencies{Registry: true, RPC: true, Search: true, Verify: true, Store: true})
	svc, err := New(qualifiedRuntime(t), staticViews{views: []appstoreapi.ApplicationView{publicView(t)}}, deps, Config{RateLimit: 10, RateWindow: time.Minute})
	if err != nil {
		t.Fatal(err)
	}
	handler := svc.Handler()

	for _, path := range []string{"/healthz", "/readyz", "/v1/apps", "/v1/apps/categories", "/"} {
		req := httptest.NewRequest(http.MethodGet, path, nil)
		req.RemoteAddr = "198.51.100.10:1234"
		res := httptest.NewRecorder()
		handler.ServeHTTP(res, req)
		if res.Code != http.StatusOK {
			t.Fatalf("%s status=%d body=%s", path, res.Code, res.Body.String())
		}
	}
	if got := requestBody(t, handler, "/"); !strings.Contains(got, "420AppStore") {
		t.Fatalf("frontend not mounted: %s", got)
	}
}

func TestBlockedCanonicalDependenciesRejectAPIButKeepFrontendAndHealth(t *testing.T) {
	deps := NewDependencyState(hardening.Dependencies{Registry: false, RPC: true, Search: true, Verify: true, Store: true})
	svc, _ := New(qualifiedRuntime(t), staticViews{views: []appstoreapi.ApplicationView{publicView(t)}}, deps, Config{RateLimit: 10})
	handler := svc.Handler()

	for _, path := range []string{"/readyz", "/v1/apps"} {
		req := httptest.NewRequest(http.MethodGet, path, nil)
		req.RemoteAddr = "198.51.100.11:1234"
		res := httptest.NewRecorder()
		handler.ServeHTTP(res, req)
		if res.Code != http.StatusServiceUnavailable {
			t.Fatalf("%s status=%d body=%s", path, res.Code, res.Body.String())
		}
	}
	for _, path := range []string{"/healthz", "/"} {
		req := httptest.NewRequest(http.MethodGet, path, nil)
		res := httptest.NewRecorder()
		handler.ServeHTTP(res, req)
		if res.Code != http.StatusOK {
			t.Fatalf("%s status=%d", path, res.Code)
		}
	}
}

func TestVerifyOutageDegradesAndOmitsVerificationEvidence(t *testing.T) {
	deps := NewDependencyState(hardening.Dependencies{Registry: true, RPC: true, Search: true, Verify: false, Store: true})
	svc, _ := New(qualifiedRuntime(t), staticViews{views: []appstoreapi.ApplicationView{publicView(t)}}, deps, Config{RateLimit: 10})
	handler := svc.Handler()

	readyReq := httptest.NewRequest(http.MethodGet, "/readyz", nil)
	readyRes := httptest.NewRecorder()
	handler.ServeHTTP(readyRes, readyReq)
	if readyRes.Code != http.StatusOK || !strings.Contains(readyRes.Body.String(), `"mode":"DEGRADED"`) {
		t.Fatalf("unexpected degraded readiness: %d %s", readyRes.Code, readyRes.Body.String())
	}

	req := httptest.NewRequest(http.MethodGet, "/v1/apps/420/service/demo/v1", nil)
	req.RemoteAddr = "198.51.100.12:1234"
	res := httptest.NewRecorder()
	handler.ServeHTTP(res, req)
	if res.Code != http.StatusOK {
		t.Fatalf("status=%d body=%s", res.Code, res.Body.String())
	}
	var detail appstoreapi.DetailResponse
	if err := json.Unmarshal(res.Body.Bytes(), &detail); err != nil {
		t.Fatal(err)
	}
	if len(detail.Application.Security.Evidence) != 1 || detail.Application.Security.Evidence[0].Kind != security.KindAudit {
		t.Fatalf("verification evidence was not omitted during Verify outage: %#v", detail.Application.Security.Evidence)
	}
}

func TestRateLimitUsesTransportKeyAndDoesNotRequireWalletIdentity(t *testing.T) {
	deps := NewDependencyState(hardening.Dependencies{Registry: true, RPC: true, Search: true, Verify: true, Store: true})
	svc, _ := New(qualifiedRuntime(t), staticViews{views: []appstoreapi.ApplicationView{publicView(t)}}, deps, Config{RateLimit: 1, RateWindow: time.Minute})
	handler := svc.Handler()

	req := httptest.NewRequest(http.MethodGet, "/v1/apps", nil)
	req.RemoteAddr = "198.51.100.13:4567"
	first := httptest.NewRecorder()
	handler.ServeHTTP(first, req)
	if first.Code != http.StatusOK {
		t.Fatalf("first status=%d", first.Code)
	}

	req = httptest.NewRequest(http.MethodGet, "/v1/apps", nil)
	req.RemoteAddr = "198.51.100.13:9999"
	second := httptest.NewRecorder()
	handler.ServeHTTP(second, req)
	if second.Code != http.StatusTooManyRequests || second.Header().Get("Retry-After") == "" {
		t.Fatalf("second status=%d retry=%q", second.Code, second.Header().Get("Retry-After"))
	}
}

func TestUnqualifiedRuntimeBlocksCanonicalAPI(t *testing.T) {
	cfg := appstoreruntime.Config{
		ChainID:         420,
		RPCURL:          "http://127.0.0.1:8545",
		IndexerURL:      "http://127.0.0.1:8420",
		RegistryAddress: "0x1111111111111111111111111111111111111111",
		CatalogueStore:  "./catalogue",
		ListenAddr:      ":8426",
	}
	runtimeSvc, err := appstoreruntime.NewService(cfg, fakeProbe{chainID: 420})
	if err != nil {
		t.Fatal(err)
	}
	deps := NewDependencyState(hardening.Dependencies{Registry: true, RPC: true, Search: true, Verify: true, Store: true})
	svc, _ := New(runtimeSvc, staticViews{views: []appstoreapi.ApplicationView{publicView(t)}}, deps, Config{RateLimit: 10})

	req := httptest.NewRequest(http.MethodGet, "/v1/apps", nil)
	req.RemoteAddr = "198.51.100.14:1234"
	res := httptest.NewRecorder()
	svc.Handler().ServeHTTP(res, req)
	if res.Code != http.StatusServiceUnavailable {
		t.Fatalf("status=%d body=%s", res.Code, res.Body.String())
	}
}

func TestPublicHandlerAddsSecurityHeaders(t *testing.T) {
	deps := NewDependencyState(hardening.Dependencies{Registry: true, RPC: true, Search: true, Verify: true, Store: true})
	svc, _ := New(qualifiedRuntime(t), staticViews{views: []appstoreapi.ApplicationView{publicView(t)}}, deps, Config{RateLimit: 10})
	req := httptest.NewRequest(http.MethodGet, "/healthz", nil)
	res := httptest.NewRecorder()
	svc.Handler().ServeHTTP(res, req)
	if res.Header().Get("X-Content-Type-Options") != "nosniff" || res.Header().Get("Referrer-Policy") != "no-referrer" {
		t.Fatalf("missing public security headers: %#v", res.Header())
	}
}

func requestBody(t *testing.T, handler http.Handler, path string) string {
	t.Helper()
	req := httptest.NewRequest(http.MethodGet, path, nil)
	req.RemoteAddr = "198.51.100.15:1234"
	res := httptest.NewRecorder()
	handler.ServeHTTP(res, req)
	if res.Code != http.StatusOK {
		t.Fatalf("%s status=%d", path, res.Code)
	}
	return res.Body.String()
}

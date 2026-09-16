package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/420integrated/420-integrated/appstore/curation"
	appregistry "github.com/420integrated/420-integrated/appstore/registry"
	"github.com/420integrated/420-integrated/appstore/security"
	"github.com/420integrated/420-integrated/appstore/wallet"
)

func testView(id string, version uint32, categories []string, featured, sponsored, active bool) ApplicationView {
	listing, err := curation.Compose(appregistry.VersionRecord{
		ServiceID: id, Version: version, Implementation: "0x1111111111111111111111111111111111111111",
		CodeHash: "0x" + strings.Repeat("a", 64), MetadataHash: "0x" + strings.Repeat("b", 64),
		Active: active, BlockNumber: 10, BlockHash: "0x" + strings.Repeat("c", 64),
	}, curation.Metadata{ServiceID: id, Categories: categories, Featured: featured, Sponsored: sponsored, SponsorLabel: func() string { if sponsored { return "Sponsored" }; return "" }(), Description: "A useful app", Rating: curation.RatingSummary{Average: 4.5, Count: 2}})
	if err != nil { panic(err) }
	sec, err := security.Build(id, version, nil)
	if err != nil { panic(err) }
	w, err := wallet.Build(wallet.Request{ChainID: 420, ServiceID: id, AppURL: "https://example.test/app", RequiresConfirmation: false})
	if err != nil { panic(err) }
	return ApplicationView{Listing: listing, Security: sec, Wallet: w, Links: Links{Registry: "https://registry.test/"+id, Explorer: "https://explorer.test/"+id, Verify: "https://verify.test/"+id, Direct: "https://example.test/app"}}
}

func TestBrowseSeparatesCanonicalAndCuration(t *testing.T) {
	svc, err := New([]ApplicationView{testView("420/service/alpha/v1", 1, []string{"social"}, true, false, true)})
	if err != nil { t.Fatal(err) }
	r := httptest.NewRequest(http.MethodGet, "/v1/apps", nil)
	w := httptest.NewRecorder()
	svc.Handler().ServeHTTP(w, r)
	if w.Code != http.StatusOK { t.Fatalf("status %d", w.Code) }
	var got ListResponse
	if err := json.Unmarshal(w.Body.Bytes(), &got); err != nil { t.Fatal(err) }
	if len(got.Items) != 1 || !got.Items[0].Canonical { t.Fatalf("unexpected items: %#v", got.Items) }
	if got.Items[0].ServiceID != "420/service/alpha/v1" || got.Items[0].Curation.Categories[0] != "social" { t.Fatalf("canonical/curation split lost: %#v", got.Items[0]) }
	if !strings.Contains(got.Disclaimer, "non-canonical") { t.Fatalf("missing discovery disclaimer: %q", got.Disclaimer) }
}

func TestSearchCategoryAndActiveFilters(t *testing.T) {
	svc, err := New([]ApplicationView{
		testView("420/service/alpha/v1", 1, []string{"social"}, false, false, true),
		testView("420/service/beta/v1", 1, []string{"finance"}, false, false, false),
	})
	if err != nil { t.Fatal(err) }
	r := httptest.NewRequest(http.MethodGet, "/v1/apps/search?q=alpha&category=social&active=true", nil)
	w := httptest.NewRecorder()
	svc.Handler().ServeHTTP(w, r)
	if w.Code != http.StatusOK { t.Fatalf("status %d", w.Code) }
	var got ListResponse
	if err := json.Unmarshal(w.Body.Bytes(), &got); err != nil { t.Fatal(err) }
	if got.Total != 1 || got.Items[0].ServiceID != "420/service/alpha/v1" { t.Fatalf("wrong filtered result: %#v", got) }
}

func TestCategoriesAreDeterministic(t *testing.T) {
	svc, err := New([]ApplicationView{
		testView("420/service/alpha/v1", 1, []string{"social", "tools"}, false, false, true),
		testView("420/service/beta/v1", 1, []string{"finance", "social"}, false, false, true),
	})
	if err != nil { t.Fatal(err) }
	r := httptest.NewRequest(http.MethodGet, "/v1/apps/categories", nil)
	w := httptest.NewRecorder()
	svc.Handler().ServeHTTP(w, r)
	var got CategoriesResponse
	if err := json.Unmarshal(w.Body.Bytes(), &got); err != nil { t.Fatal(err) }
	want := []string{"finance", "social", "tools"}
	if strings.Join(got.Categories, ",") != strings.Join(want, ",") { t.Fatalf("got %v want %v", got.Categories, want) }
}

func TestDetailPreservesDirectAndWalletLinks(t *testing.T) {
	view := testView("420/service/alpha/v1", 1, []string{"social"}, false, false, true)
	svc, err := New([]ApplicationView{view})
	if err != nil { t.Fatal(err) }
	r := httptest.NewRequest(http.MethodGet, "/v1/apps/420/service/alpha/v1", nil)
	w := httptest.NewRecorder()
	svc.Handler().ServeHTTP(w, r)
	if w.Code != http.StatusOK { t.Fatalf("status %d body %s", w.Code, w.Body.String()) }
	var got DetailResponse
	if err := json.Unmarshal(w.Body.Bytes(), &got); err != nil { t.Fatal(err) }
	if got.Application.Links.Registry == "" || got.Application.Links.Explorer == "" || got.Application.Links.Verify == "" || got.Application.Links.Direct == "" { t.Fatalf("missing direct provenance links: %#v", got.Application.Links) }
	if !strings.HasPrefix(got.Application.Wallet.URI, "420wallet://open?") { t.Fatalf("missing wallet context: %q", got.Application.Wallet.URI) }
}

func TestNewRejectsCrossServiceSecurityProvenance(t *testing.T) {
	view := testView("420/service/alpha/v1", 1, []string{"social"}, false, false, true)
	view.Security.ServiceID = "420/service/beta/v1"
	if _, err := New([]ApplicationView{view}); err != ErrInvalidView { t.Fatalf("got %v want %v", err, ErrInvalidView) }
}

func TestPaginationCapsLimit(t *testing.T) {
	svc, err := New([]ApplicationView{testView("420/service/alpha/v1", 1, []string{"social"}, false, false, true)})
	if err != nil { t.Fatal(err) }
	r := httptest.NewRequest(http.MethodGet, "/v1/apps?limit=999", nil)
	w := httptest.NewRecorder()
	svc.Handler().ServeHTTP(w, r)
	var got ListResponse
	if err := json.Unmarshal(w.Body.Bytes(), &got); err != nil { t.Fatal(err) }
	if got.Limit != 100 { t.Fatalf("limit not capped: %d", got.Limit) }
}

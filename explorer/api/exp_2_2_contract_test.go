package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"reflect"
	"testing"
)

func TestCapabilitiesAdvertisesCompleteExplorerAPIContract(t *testing.T) {
	s := newTestServer(t, &fakeIndexer{})
	rr := httptest.NewRecorder()
	s.Handler().ServeHTTP(rr, httptest.NewRequest(http.MethodGet, "/v1/capabilities", nil))
	if rr.Code != http.StatusOK {
		t.Fatalf("status=%d body=%s", rr.Code, rr.Body.String())
	}

	var got capabilitiesResponse
	if err := json.Unmarshal(rr.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	want := []string{
		"/v1/health",
		"/v1/ready",
		"/v1/status",
		"/v1/blocks",
		"/v1/blocks/{number}",
		"/v1/blocks/{number}/trace",
		"/v1/transactions/{hash}",
		"/v1/receipts/{hash}",
		"/v1/addresses/{address}",
		"/v1/contracts/{address}",
		"/v1/services",
		"/v1/services/{service}",
		"/v1/services/{service}/versions/{version}",
		"/v1/assets/activity",
		"/v1/stake/activity",
		"/v1/consensus",
	}
	if !reflect.DeepEqual(got.Endpoints, want) {
		t.Fatalf("capability contract mismatch\n got: %#v\nwant: %#v", got.Endpoints, want)
	}
	if got.Service != "420Explorer" || got.DataSource != "420Indexer" || got.CanonicalAuthority {
		t.Fatalf("unexpected capability provenance: %+v", got)
	}
}

func TestBlocksRejectLimitAboveContractMaximum(t *testing.T) {
	s := newTestServer(t, &fakeIndexer{})
	rr := httptest.NewRecorder()
	s.Handler().ServeHTTP(rr, httptest.NewRequest(http.MethodGet, "/v1/blocks?limit=251", nil))
	if rr.Code != http.StatusBadRequest {
		t.Fatalf("status=%d body=%s", rr.Code, rr.Body.String())
	}
	var got errorResponse
	if err := json.Unmarshal(rr.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	if got.Error != "invalid limit" {
		t.Fatalf("unexpected error: %+v", got)
	}
}

func TestUnknownAPIRouteFailsClosedAsJSON(t *testing.T) {
	s := newTestServer(t, &fakeIndexer{})
	rr := httptest.NewRecorder()
	s.Handler().ServeHTTP(rr, httptest.NewRequest(http.MethodGet, "/v1/definitely-not-a-route", nil))
	if rr.Code != http.StatusNotFound {
		t.Fatalf("status=%d body=%s", rr.Code, rr.Body.String())
	}
	if got := rr.Header().Get("Content-Type"); got != "application/json" {
		t.Fatalf("content-type=%q", got)
	}
	if got := rr.Header().Get("X-420-Data-Source"); got != "420Indexer" {
		t.Fatalf("missing API provenance header: %q", got)
	}
	var body errorResponse
	if err := json.Unmarshal(rr.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if body.Error != "unknown API route" {
		t.Fatalf("unexpected error body: %+v", body)
	}
}

func TestUnsupportedMethodDoesNotFallThroughToSPA(t *testing.T) {
	s := newTestServer(t, &fakeIndexer{})
	rr := httptest.NewRecorder()
	s.Handler().ServeHTTP(rr, httptest.NewRequest(http.MethodPost, "/v1/blocks", nil))
	if rr.Code != http.StatusNotFound {
		t.Fatalf("status=%d body=%s", rr.Code, rr.Body.String())
	}
	if got := rr.Header().Get("Content-Type"); got != "application/json" {
		t.Fatalf("content-type=%q body=%s", got, rr.Body.String())
	}
}

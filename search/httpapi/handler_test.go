package httpapi

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/420integrated/420-integrated/search/pagination"
	"github.com/420integrated/420-integrated/search/query"
)

type stubBackend struct {
	searchReq  SearchRequest
	suggestReq SuggestRequest
	resolveReq ResolveRequest
	searchErr  error
	status     OperationalStatus
}

func (s *stubBackend) Search(_ context.Context, req SearchRequest) (SearchResponse, error) {
	s.searchReq = req
	if s.searchErr != nil {
		return SearchResponse{}, s.searchErr
	}
	return SearchResponse{Snapshot: pagination.Snapshot{IndexedHeight: 4200, FinalizedHeight: 4190}}, nil
}
func (s *stubBackend) Suggest(_ context.Context, req SuggestRequest) ([]Suggestion, error) {
	s.suggestReq = req
	return []Suggestion{{Text: req.Query}}, nil
}
func (s *stubBackend) Resolve(_ context.Context, req ResolveRequest) (ResolveResponse, error) {
	s.resolveReq = req
	return ResolveResponse{}, nil
}
func (s *stubBackend) Health(context.Context) (OperationalStatus, error)    { return s.status, nil }
func (s *stubBackend) Readiness(context.Context) (OperationalStatus, error) { return s.status, nil }
func (s *stubBackend) Status(context.Context) (OperationalStatus, error)     { return s.status, nil }

func newTestHandler(t *testing.T, backend Backend) http.Handler {
	t.Helper()
	h, err := New(backend)
	if err != nil {
		t.Fatal(err)
	}
	return h
}

func TestNewRejectsNilBackend(t *testing.T) {
	if _, err := New(nil); err == nil {
		t.Fatal("expected nil backend rejection")
	}
}

func TestSearchParsesAndBoundsRequest(t *testing.T) {
	backend := &stubBackend{}
	h := newTestHandler(t, backend)
	req := httptest.NewRequest(http.MethodGet, BasePath+"/search?q=domain:assets+kush&limit=7&cursor=abc", nil)
	res := httptest.NewRecorder()
	h.ServeHTTP(res, req)
	if res.Code != http.StatusOK {
		t.Fatalf("status=%d body=%s", res.Code, res.Body.String())
	}
	if backend.searchReq.Limit != 7 || backend.searchReq.Cursor != "abc" {
		t.Fatalf("unexpected request: %#v", backend.searchReq)
	}
	if backend.searchReq.Plan.Schema != query.SchemaVersion || backend.searchReq.Plan.Normalized != "kush" {
		t.Fatalf("unexpected plan: %#v", backend.searchReq.Plan)
	}
	if got := res.Header().Get("Cache-Control"); got != "no-store" {
		t.Fatalf("cache control=%q", got)
	}
}

func TestSearchRejectsUnknownRepeatedAndOutOfRangeParameters(t *testing.T) {
	h := newTestHandler(t, &stubBackend{})
	for _, target := range []string{
		BasePath + "/search?q=kush&extra=1",
		BasePath + "/search?q=kush&q=hash",
		BasePath + "/search?q=kush&limit=0",
		BasePath + "/search?q=kush&limit=101",
	} {
		res := httptest.NewRecorder()
		h.ServeHTTP(res, httptest.NewRequest(http.MethodGet, target, nil))
		if res.Code != http.StatusBadRequest {
			t.Fatalf("target=%s status=%d", target, res.Code)
		}
	}
}

func TestSearchRejectsOversizedQueryAndCursor(t *testing.T) {
	h := newTestHandler(t, &stubBackend{})
	for _, target := range []string{
		BasePath + "/search?q=" + strings.Repeat("a", MaxQueryBytes+1),
		BasePath + "/search?q=kush&cursor=" + strings.Repeat("a", MaxCursorBytes+1),
	} {
		res := httptest.NewRecorder()
		h.ServeHTTP(res, httptest.NewRequest(http.MethodGet, target, nil))
		if res.Code != http.StatusBadRequest {
			t.Fatalf("status=%d body=%s", res.Code, res.Body.String())
		}
	}
}

func TestSuggestUsesIndependentBound(t *testing.T) {
	backend := &stubBackend{}
	h := newTestHandler(t, backend)
	res := httptest.NewRecorder()
	h.ServeHTTP(res, httptest.NewRequest(http.MethodGet, BasePath+"/suggest?q=ku&limit=20", nil))
	if res.Code != http.StatusOK || backend.suggestReq.Limit != 20 {
		t.Fatalf("status=%d req=%#v", res.Code, backend.suggestReq)
	}
	res = httptest.NewRecorder()
	h.ServeHTTP(res, httptest.NewRequest(http.MethodGet, BasePath+"/suggest?q=ku&limit=21", nil))
	if res.Code != http.StatusBadRequest {
		t.Fatalf("expected suggest limit rejection, got %d", res.Code)
	}
}

func TestResolveRequiresExactIdentifier(t *testing.T) {
	backend := &stubBackend{}
	h := newTestHandler(t, backend)
	res := httptest.NewRecorder()
	h.ServeHTTP(res, httptest.NewRequest(http.MethodGet, BasePath+"/resolve?q=kush", nil))
	if res.Code != http.StatusBadRequest {
		t.Fatalf("expected text resolver rejection, got %d", res.Code)
	}
	res = httptest.NewRecorder()
	h.ServeHTTP(res, httptest.NewRequest(http.MethodGet, BasePath+"/resolve?q=420registry:service-1", nil))
	if res.Code != http.StatusNotFound {
		t.Fatalf("expected backend not-found surface, got %d", res.Code)
	}
	if backend.resolveReq.Plan.Kind != query.KindProtocolObject {
		t.Fatalf("unexpected resolve plan: %#v", backend.resolveReq.Plan)
	}
}

func TestCapabilitiesExposeVersionAndBounds(t *testing.T) {
	h := newTestHandler(t, &stubBackend{})
	res := httptest.NewRecorder()
	h.ServeHTTP(res, httptest.NewRequest(http.MethodGet, BasePath+"/capabilities", nil))
	if res.Code != http.StatusOK {
		t.Fatal(res.Code)
	}
	body := res.Body.String()
	for _, token := range []string{APIVersion, query.SchemaVersion, pagination.CursorSchema, "maxSearchResults"} {
		if !strings.Contains(body, token) {
			t.Fatalf("capabilities missing %q: %s", token, body)
		}
	}
}

func TestOperationalEndpointsFailClosedWhenNotReady(t *testing.T) {
	h := newTestHandler(t, &stubBackend{status: OperationalStatus{OK: false, State: "degraded", Reason: "indexer stale"}})
	for _, path := range []string{"/health", "/readiness", "/status"} {
		res := httptest.NewRecorder()
		h.ServeHTTP(res, httptest.NewRequest(http.MethodGet, BasePath+path, nil))
		if res.Code != http.StatusServiceUnavailable {
			t.Fatalf("path=%s status=%d", path, res.Code)
		}
	}
}

func TestBackendErrorsDoNotLeakInternalFailureByDefault(t *testing.T) {
	h := newTestHandler(t, &stubBackend{searchErr: errors.New("dial tcp secret.internal:4200")})
	res := httptest.NewRecorder()
	h.ServeHTTP(res, httptest.NewRequest(http.MethodGet, BasePath+"/search?q=kush", nil))
	if res.Code != http.StatusServiceUnavailable {
		t.Fatal(res.Code)
	}
	if strings.Contains(res.Body.String(), "secret.internal") {
		t.Fatalf("backend details leaked: %s", res.Body.String())
	}
}

func TestStatusErrorPreservesPublicCodeAndStatus(t *testing.T) {
	h := newTestHandler(t, &stubBackend{searchErr: &StatusError{Status: http.StatusConflict, Code: "snapshot_changed", Err: errors.New("snapshot changed")}})
	res := httptest.NewRecorder()
	h.ServeHTTP(res, httptest.NewRequest(http.MethodGet, BasePath+"/search?q=kush", nil))
	if res.Code != http.StatusConflict || !strings.Contains(res.Body.String(), "snapshot_changed") {
		t.Fatalf("status=%d body=%s", res.Code, res.Body.String())
	}
}

func TestMethodAndPathContracts(t *testing.T) {
	h := newTestHandler(t, &stubBackend{})
	res := httptest.NewRecorder()
	h.ServeHTTP(res, httptest.NewRequest(http.MethodPost, BasePath+"/search?q=kush", nil))
	if res.Code != http.StatusMethodNotAllowed {
		t.Fatal(res.Code)
	}
	res = httptest.NewRecorder()
	h.ServeHTTP(res, httptest.NewRequest(http.MethodGet, BasePath+"/unknown", nil))
	if res.Code != http.StatusNotFound {
		t.Fatal(res.Code)
	}
}

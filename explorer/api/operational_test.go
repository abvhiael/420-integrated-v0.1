package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	indexerapi "github.com/420integrated/420-integrated/indexer/api"
	"github.com/420integrated/420-integrated/indexer/model"
)

func decodeStatusFailure(t *testing.T, rr *httptest.ResponseRecorder) statusFailureResponse {
	t.Helper()
	var got statusFailureResponse
	if err := json.Unmarshal(rr.Body.Bytes(), &got); err != nil { t.Fatal(err) }
	return got
}

func TestStatusWrongChainIsCriticalAndNotRetryable(t *testing.T) {
	f := &fakeIndexer{health:indexerapi.HealthResponse{Health:model.Health{
		ChainID:1, IndexedHeight:10, SafeHeight:9, FinalizedHeight:8,
		State:"READY", LastIngestAt:time.Now().UTC(),
	}}}
	s := newTestServer(t,f)
	rr := httptest.NewRecorder()
	s.Handler().ServeHTTP(rr,httptest.NewRequest(http.MethodGet,"/v1/status",nil))
	if rr.Code != http.StatusServiceUnavailable { t.Fatalf("status=%d body=%s",rr.Code,rr.Body.String()) }
	got := decodeStatusFailure(t,rr)
	if got.Issue.Code != "WRONG_CHAIN" || got.Issue.Severity != "critical" || got.Issue.Retryable { t.Fatalf("unexpected issue: %+v",got.Issue) }
	if rr.Header().Get("Retry-After") != "" { t.Fatalf("wrong-chain response must not advertise retry: %q",rr.Header().Get("Retry-After")) }
}

func TestStatusStaleProvidesRetryGuidance(t *testing.T) {
	f := &fakeIndexer{health:indexerapi.HealthResponse{Health:model.Health{
		ChainID:420, IndexedHeight:10, SafeHeight:9, FinalizedHeight:8,
		State:"READY", LastIngestAt:time.Now().UTC().Add(-2*time.Hour),
	}}}
	s := newTestServer(t,f)
	rr := httptest.NewRecorder()
	s.Handler().ServeHTTP(rr,httptest.NewRequest(http.MethodGet,"/v1/status",nil))
	if rr.Code != http.StatusServiceUnavailable { t.Fatalf("status=%d body=%s",rr.Code,rr.Body.String()) }
	got := decodeStatusFailure(t,rr)
	if got.Issue.Code != "INDEXER_STALE" || !got.Issue.Retryable || !got.Status.Stale { t.Fatalf("unexpected stale response: %+v",got) }
	if rr.Header().Get("Retry-After") != "15" { t.Fatalf("retry-after=%q",rr.Header().Get("Retry-After")) }
}

func TestStatusDegradedProvidesMachineReadableWarning(t *testing.T) {
	f := &fakeIndexer{health:indexerapi.HealthResponse{Health:model.Health{
		ChainID:420, IndexedHeight:10, SafeHeight:9, FinalizedHeight:8,
		State:"DEGRADED", LastIngestAt:time.Now().UTC(),
	}}}
	s := newTestServer(t,f)
	rr := httptest.NewRecorder()
	s.Handler().ServeHTTP(rr,httptest.NewRequest(http.MethodGet,"/v1/status",nil))
	got := decodeStatusFailure(t,rr)
	if got.Issue.Code != "INDEXER_DEGRADED" || got.Issue.Severity != "warning" || !got.Status.Degraded { t.Fatalf("unexpected degraded response: %+v",got) }
}

func TestStatusInconsistentFinalityIsCritical(t *testing.T) {
	f := &fakeIndexer{health:indexerapi.HealthResponse{Health:model.Health{
		ChainID:420, IndexedHeight:10, SafeHeight:11, FinalizedHeight:9,
		State:"READY", LastIngestAt:time.Now().UTC(),
	}}}
	s := newTestServer(t,f)
	rr := httptest.NewRecorder()
	s.Handler().ServeHTTP(rr,httptest.NewRequest(http.MethodGet,"/v1/status",nil))
	got := decodeStatusFailure(t,rr)
	if got.Issue.Code != "INCONSISTENT_FINALITY" || got.Issue.Severity != "critical" || got.Status.Consistent { t.Fatalf("unexpected inconsistent response: %+v",got) }
}

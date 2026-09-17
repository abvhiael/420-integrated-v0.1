package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/420integrated/420-integrated/status/components"
	"github.com/420integrated/420-integrated/status/evidence"
	"github.com/420integrated/420-integrated/status/history"
	"github.com/420integrated/420-integrated/status/incidents"
)

type fixedSource struct { id string; observation evidence.Observation }
func (s fixedSource) ID() string { return s.id }
func (s fixedSource) Observe(_ components.Component, _ time.Time) (evidence.Observation, error) { return s.observation, nil }

func fixture(t *testing.T) (*PublicAPI, *components.Registry, *evidence.Ingestor, *incidents.Store, *history.Store, time.Time) {
	t.Helper()
	registry := components.NewRegistry()
	component := components.Component{ID:"indexer", Name:"420Indexer", Class:components.ClassIndexer, Network:"420-testnet", Environment:"testnet", Public:true}
	if err := registry.Register(component); err != nil { t.Fatal(err) }
	ingestor, err := evidence.NewIngestor(registry, "420-testnet", "testnet")
	if err != nil { t.Fatal(err) }
	incidentStore := incidents.NewStore()
	historyStore := history.NewStore()
	api, err := NewPublicAPI(registry, ingestor, incidentStore, historyStore)
	if err != nil { t.Fatal(err) }
	now := time.Date(2026, 9, 17, 16, 0, 0, 0, time.UTC)
	api.now = func() time.Time { return now }
	return api, registry, ingestor, incidentStore, historyStore, now
}

func TestNetworkStatusIsReadOnlyAndNoncanonical(t *testing.T) {
	api, _, ingestor, _, _, now := fixture(t)
	obs := evidence.Observation{ComponentID:"indexer", SourceID:"probe-a", Network:"420-testnet", Environment:"testnet", State:components.HealthHealthy, Live:true, Ready:true, ObservedAt:now.Add(-time.Second), ExpiresAt:now.Add(time.Minute)}
	if _, err := ingestor.Ingest("indexer", fixedSource{id:"probe-a", observation:obs}, now); err != nil { t.Fatal(err) }

	req := httptest.NewRequest(http.MethodGet, "/v1/status", nil)
	res := httptest.NewRecorder()
	api.Handler().ServeHTTP(res, req)
	if res.Code != http.StatusOK { t.Fatalf("expected 200, got %d", res.Code) }
	var body map[string]any
	if err := json.Unmarshal(res.Body.Bytes(), &body); err != nil { t.Fatal(err) }
	if body["canonical"] != false { t.Fatalf("public status must be noncanonical: %#v", body) }
	if body["health"] != string(components.HealthHealthy) { t.Fatalf("expected healthy rollup, got %#v", body["health"]) }
}

func TestIncidentAndMaintenanceFeedsRemainSeparate(t *testing.T) {
	api, _, _, incidentStore, _, now := fixture(t)
	incident := incidents.Incident{ID:"inc-1", Kind:incidents.KindIncident, Title:"Indexer lag", Network:"420-testnet", Environment:"testnet", AffectedComponents:[]string{"indexer"}, StartedAt:now.Add(-time.Minute), Updates:[]incidents.Update{{At:now.Add(-time.Minute), State:incidents.StateOpen, Severity:incidents.SeverityWarn, Summary:"lagging"}}}
	maintenance := incidents.Incident{ID:"maint-1", Kind:incidents.KindMaintenance, Title:"Indexer maintenance", Network:"420-testnet", Environment:"testnet", AffectedComponents:[]string{"indexer"}, StartedAt:now, PlannedStart:now, PlannedEnd:now.Add(time.Hour), Updates:[]incidents.Update{{At:now, State:incidents.StateOpen, Severity:incidents.SeverityInfo, Summary:"planned"}}}
	if err := incidentStore.Create(incident); err != nil { t.Fatal(err) }
	if err := incidentStore.Create(maintenance); err != nil { t.Fatal(err) }

	cases := map[string]struct{ key string; want int }{
		"/v1/incidents": {key:"incidents", want:1},
		"/v1/maintenance": {key:"maintenance", want:1},
	}
	for path, tc := range cases {
		req := httptest.NewRequest(http.MethodGet, path, nil)
		res := httptest.NewRecorder()
		api.Handler().ServeHTTP(res, req)
		if res.Code != http.StatusOK { t.Fatalf("%s expected 200, got %d", path, res.Code) }
		var body map[string]any
		if err := json.Unmarshal(res.Body.Bytes(), &body); err != nil { t.Fatal(err) }
		items, ok := body[tc.key].([]any)
		if !ok || len(items) != tc.want { t.Fatalf("%s expected %d items: %#v", path, tc.want, body) }
	}
}

func TestHistoryPaginationUsesMonotonicSequenceCursor(t *testing.T) {
	api, _, _, _, historyStore, now := fixture(t)
	for n := 0; n < 3; n++ {
		obs := evidence.Observation{ComponentID:"indexer", SourceID:"probe-a", Network:"420-testnet", Environment:"testnet", State:components.HealthHealthy, Live:true, Ready:true, ObservedAt:now.Add(time.Duration(n)*time.Second), ExpiresAt:now.Add(time.Minute+time.Duration(n)*time.Second)}
		if err := historyStore.AppendObservation(obs, now.Add(time.Duration(n)*time.Second)); err != nil { t.Fatal(err) }
	}

	first := httptest.NewRecorder()
	api.Handler().ServeHTTP(first, httptest.NewRequest(http.MethodGet, "/v1/history?limit=2", nil))
	if first.Code != http.StatusOK { t.Fatalf("expected 200, got %d", first.Code) }
	var page1 struct { Items []historyItem `json:"items"`; Next string `json:"next_cursor"` }
	if err := json.Unmarshal(first.Body.Bytes(), &page1); err != nil { t.Fatal(err) }
	if len(page1.Items) != 2 || page1.Next == "" { t.Fatalf("expected first page and cursor: %+v", page1) }
	if page1.Items[0].Sequence >= page1.Items[1].Sequence { t.Fatal("history must be deterministic ascending sequence") }

	second := httptest.NewRecorder()
	api.Handler().ServeHTTP(second, httptest.NewRequest(http.MethodGet, "/v1/history?limit=2&cursor="+page1.Next, nil))
	if second.Code != http.StatusOK { t.Fatalf("expected 200, got %d", second.Code) }
	var page2 struct { Items []historyItem `json:"items"`; Next string `json:"next_cursor"` }
	if err := json.Unmarshal(second.Body.Bytes(), &page2); err != nil { t.Fatal(err) }
	if len(page2.Items) != 1 || page2.Items[0].Sequence <= page1.Items[1].Sequence { t.Fatalf("cursor did not advance monotonically: %+v %+v", page1, page2) }
	if page2.Next != "" { t.Fatalf("final page must not advertise cursor: %q", page2.Next) }
}

func TestHistoryRejectsInvalidPagination(t *testing.T) {
	api, _, _, _, _, _ := fixture(t)
	for _, path := range []string{"/v1/history?limit=0", "/v1/history?limit=201", "/v1/history?cursor=%%%"} {
		res := httptest.NewRecorder()
		api.Handler().ServeHTTP(res, httptest.NewRequest(http.MethodGet, path, nil))
		if res.Code != http.StatusBadRequest { t.Fatalf("%s expected 400, got %d", path, res.Code) }
	}
}

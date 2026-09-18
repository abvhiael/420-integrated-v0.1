package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/420integrated/420-integrated/status/components"
	"github.com/420integrated/420-integrated/status/evidence"
	"github.com/420integrated/420-integrated/status/incidents"
)

func TestPublicAPIExcludesPrivateComponents(t *testing.T) {
	api, registry, ingestor, _, historyStore, now := fixture(t)
	private := components.Component{ID:"internal-rpc", Name:"Internal RPC", Class:components.ClassRPC, Network:"420-testnet", Environment:"testnet", Public:false}
	if err := registry.Register(private); err != nil { t.Fatal(err) }
	obs := evidence.Observation{ComponentID:"internal-rpc", SourceID:"private-probe", Network:"420-testnet", Environment:"testnet", State:components.HealthHealthy, Live:true, Ready:true, Summary:"internal secret context", ObservedAt:now, ExpiresAt:now.Add(time.Minute)}
	if _, err := ingestor.Ingest("internal-rpc", fixedSource{id:"private-probe", observation:obs}, now); err != nil { t.Fatal(err) }
	if err := historyStore.AppendObservation(obs, now); err != nil { t.Fatal(err) }

	for _, path := range []string{"/v1/components", "/v1/status", "/v1/history"} {
		res := httptest.NewRecorder()
		api.Handler().ServeHTTP(res, httptest.NewRequest(http.MethodGet, path, nil))
		if res.Code != http.StatusOK { t.Fatalf("%s expected 200, got %d", path, res.Code) }
		if strings.Contains(res.Body.String(), "internal-rpc") || strings.Contains(res.Body.String(), "internal secret context") {
			t.Fatalf("%s leaked private component data: %s", path, res.Body.String())
		}
	}
}

func TestPublicHistoryDropsRawObservationSummary(t *testing.T) {
	api, _, _, _, historyStore, now := fixture(t)
	obs := evidence.Observation{ComponentID:"indexer", SourceID:"probe-a", Network:"420-testnet", Environment:"testnet", State:components.HealthHealthy, Live:true, Ready:true, Summary:"JWT=super-secret-value", ObservedAt:now, ExpiresAt:now.Add(time.Minute), References:[]evidence.Reference{{Kind:"block", Value:"420"}}}
	if err := historyStore.AppendObservation(obs, now); err != nil { t.Fatal(err) }
	res := httptest.NewRecorder()
	api.Handler().ServeHTTP(res, httptest.NewRequest(http.MethodGet, "/v1/history", nil))
	if res.Code != http.StatusOK { t.Fatalf("expected 200, got %d", res.Code) }
	if strings.Contains(res.Body.String(), "super-secret-value") || strings.Contains(res.Body.String(), "JWT=") { t.Fatalf("raw observation summary leaked: %s", res.Body.String()) }
	if !strings.Contains(res.Body.String(), `"references":[{"Kind":"block","Value":"420"}]`) { t.Fatalf("provenance reference missing: %s", res.Body.String()) }
}

func TestPrivateIncidentAffectedComponentsAreRemoved(t *testing.T) {
	api, registry, _, store, _, now := fixture(t)
	private := components.Component{ID:"internal-rpc", Name:"Internal RPC", Class:components.ClassRPC, Network:"420-testnet", Environment:"testnet", Public:false}
	if err := registry.Register(private); err != nil { t.Fatal(err) }
	i := incidents.Incident{ID:"inc-mixed", Kind:incidents.KindIncident, Title:"Mixed impact", Network:"420-testnet", Environment:"testnet", AffectedComponents:[]string{"indexer","internal-rpc"}, StartedAt:now, Updates:[]incidents.Update{{At:now, State:incidents.StateOpen, Severity:incidents.SeverityWarn, Summary:"public impact"}}}
	if err := store.Create(i); err != nil { t.Fatal(err) }
	res := httptest.NewRecorder()
	api.Handler().ServeHTTP(res, httptest.NewRequest(http.MethodGet, "/v1/incidents", nil))
	if res.Code != http.StatusOK { t.Fatalf("expected 200, got %d", res.Code) }
	if strings.Contains(res.Body.String(), "internal-rpc") { t.Fatalf("private affected component leaked: %s", res.Body.String()) }
	var body map[string]any
	if err := json.Unmarshal(res.Body.Bytes(), &body); err != nil { t.Fatal(err) }
	if res.Header().Get("X-Content-Type-Options") != "nosniff" || res.Header().Get("Cache-Control") != "no-store" { t.Fatal("public status security headers missing") }
}

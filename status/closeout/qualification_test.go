package closeout

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	statusapi "github.com/420integrated/420-integrated/status/api"
	"github.com/420integrated/420-integrated/status/aggregation"
	"github.com/420integrated/420-integrated/status/components"
	"github.com/420integrated/420-integrated/status/evidence"
	"github.com/420integrated/420-integrated/status/history"
	"github.com/420integrated/420-integrated/status/incidents"
	statusruntime "github.com/420integrated/420-integrated/status/runtime"
	statussecurity "github.com/420integrated/420-integrated/status/security"
)

type source struct {
	id  string
	obs evidence.Observation
}

func (s source) ID() string { return s.id }
func (s source) Observe(_ components.Component, _ time.Time) (evidence.Observation, error) { return s.obs, nil }

type runtimeProbe struct {
	chain    uint64
	readyErr error
	observed time.Time
}

func (p runtimeProbe) ChainID(context.Context) (uint64, error) { return p.chain, nil }
func (p runtimeProbe) Ready(context.Context) error { return p.readyErr }
func (p runtimeProbe) ObservedAt(context.Context) (time.Time, error) { return p.observed, nil }

func TestCloseoutConflictAndFailureIsolationRemainFailClosed(t *testing.T) {
	now := time.Date(2026, 9, 17, 21, 0, 0, 0, time.UTC)
	componentA := components.Component{ID: "indexer", Name: "420Indexer", Class: components.ClassIndexer, Network: "420-testnet", Environment: "testnet", Public: true}
	componentB := components.Component{ID: "rpc", Name: "420RPC", Class: components.ClassRPC, Network: "420-testnet", Environment: "testnet", Public: true}

	fresh := func(componentID, sourceID string, state components.Health, live, ready bool) evidence.Observation {
		return evidence.Observation{ComponentID: componentID, SourceID: sourceID, Network: "420-testnet", Environment: "testnet", State: state, Live: live, Ready: ready, ObservedAt: now.Add(-time.Second), ExpiresAt: now.Add(time.Minute)}
	}

	conflicted, err := aggregation.Evaluate(componentA, []evidence.Observation{
		fresh("indexer", "probe-a", components.HealthHealthy, true, true),
		fresh("indexer", "probe-b", components.HealthDegraded, true, true),
	}, nil, now)
	if err != nil { t.Fatal(err) }
	if conflicted.Health != components.HealthUnknown || !conflicted.Conflicting || conflicted.Authoritative {
		t.Fatalf("conflict must fail closed and remain non-authoritative: %+v", conflicted)
	}

	unavailable, err := aggregation.Evaluate(componentB, []evidence.Observation{
		fresh("rpc", "probe-c", components.HealthUnavailable, false, false),
	}, nil, now)
	if err != nil { t.Fatal(err) }
	rollup, err := aggregation.Aggregate([]aggregation.ComponentStatus{conflicted, unavailable})
	if err != nil { t.Fatal(err) }
	if rollup.Health != components.HealthDegraded || rollup.Authoritative {
		t.Fatalf("isolated failures must degrade rather than fabricate canonical network failure: %+v", rollup)
	}
}

func TestCloseoutPublicSurfaceMinimizesPrivateAndFreeFormData(t *testing.T) {
	// PublicAPI evaluates freshness against its runtime clock. Anchor this fixture
	// to that same clock so the qualification test proves payload minimization
	// rather than failing because fixed evidence happens to be future-dated.
	now := time.Now().UTC().Truncate(time.Second)
	registry := components.NewRegistry()
	public := components.Component{ID: "indexer", Name: "420Indexer", Class: components.ClassIndexer, Network: "420-testnet", Environment: "testnet", Public: true}
	private := components.Component{ID: "private-ai", Name: "PrivateAI", Class: components.ClassAI, Network: "420-testnet", Environment: "testnet", Public: false}
	if err := registry.Register(public); err != nil { t.Fatal(err) }
	if err := registry.Register(private); err != nil { t.Fatal(err) }
	ingestor, err := evidence.NewIngestor(registry, "420-testnet", "testnet")
	if err != nil { t.Fatal(err) }
	incidentStore := incidents.NewStore()
	historyStore := history.NewStore()

	publicObs := evidence.Observation{ComponentID: "indexer", SourceID: "probe-public", Network: "420-testnet", Environment: "testnet", State: components.HealthHealthy, Live: true, Ready: true, Summary: "SECRET-FREEFORM-PAYLOAD", ObservedAt: now.Add(-time.Second), ExpiresAt: now.Add(time.Minute)}
	privateObs := evidence.Observation{ComponentID: "private-ai", SourceID: "probe-private", Network: "420-testnet", Environment: "testnet", State: components.HealthHealthy, Live: true, Ready: true, Summary: "PRIVATE-CONTENT", ObservedAt: now.Add(-time.Second), ExpiresAt: now.Add(time.Minute)}
	if _, err := ingestor.Ingest("indexer", source{id: "probe-public", obs: publicObs}, now); err != nil { t.Fatal(err) }
	if _, err := ingestor.Ingest("private-ai", source{id: "probe-private", obs: privateObs}, now); err != nil { t.Fatal(err) }
	if err := historyStore.AppendObservation(publicObs, now); err != nil { t.Fatal(err) }
	if err := historyStore.AppendObservation(privateObs, now.Add(time.Second)); err != nil { t.Fatal(err) }

	api, err := statusapi.NewPublicAPI(registry, ingestor, incidentStore, historyStore)
	if err != nil { t.Fatal(err) }
	for _, path := range []string{"/v1/status", "/v1/components", "/v1/history"} {
		w := httptest.NewRecorder()
		api.Handler().ServeHTTP(w, httptest.NewRequest(http.MethodGet, path, nil))
		if w.Code != http.StatusOK { t.Fatalf("%s status %d: %s", path, w.Code, w.Body.String()) }
		body := w.Body.String()
		if strings.Contains(body, "private-ai") || strings.Contains(body, "PRIVATE-CONTENT") || strings.Contains(body, "SECRET-FREEFORM-PAYLOAD") {
			t.Fatalf("%s leaked private/free-form data: %s", path, body)
		}
		if !strings.Contains(body, `"canonical":false`) { t.Fatalf("%s lost noncanonical marker", path) }
	}
}

func TestCloseoutRestartRequiresFreshQualification(t *testing.T) {
	now := time.Date(2026, 9, 17, 21, 0, 0, 0, time.UTC)
	cfg := statusruntime.Config{ChainID: 420, IndexerURL: "https://indexer.example", ListenAddr: ":8422", RequestTimeout: time.Second, MaxEvidenceAge: 2 * time.Minute}
	probe := runtimeProbe{chain: 420, observed: now.Add(-time.Second)}

	qualified, err := statusruntime.NewService(cfg, probe)
	if err != nil { t.Fatal(err) }
	if err := qualified.Qualify(context.Background(), now); err != nil { t.Fatal(err) }
	w := httptest.NewRecorder()
	qualified.Handler().ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/readyz", nil))
	if w.Code != http.StatusOK { t.Fatalf("qualified service should be ready, got %d", w.Code) }

	restarted, err := statusruntime.NewService(cfg, probe)
	if err != nil { t.Fatal(err) }
	w = httptest.NewRecorder()
	restarted.Handler().ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/readyz", nil))
	if w.Code != http.StatusServiceUnavailable { t.Fatalf("restart must fail closed until requalified, got %d", w.Code) }

	failed, err := statusruntime.NewService(cfg, runtimeProbe{chain: 420, observed: now, readyErr: errors.New("dependency down")})
	if err != nil { t.Fatal(err) }
	if err := failed.Qualify(context.Background(), now); err == nil { t.Fatal("dependency failure must block readiness qualification") }
}

func TestCloseoutSecurityBoundariesRemainPinned(t *testing.T) {
	for _, raw := range []string{
		"http://127.0.0.1/status",
		"http://10.0.0.1/status",
		"http://169.254.169.254/latest/meta-data/",
		"http://metadata.google.internal/",
		"file:///etc/passwd",
		"https://user:pass@example.com/status",
	} {
		if err := statussecurity.ValidateProbeURL(raw); err == nil { t.Fatalf("unsafe probe target accepted: %s", raw) }
	}
	if err := statussecurity.ValidateProbeURL("https://status.example.com"); err != nil { t.Fatalf("public https target rejected: %v", err) }
	if err := statussecurity.ValidateIdentifier("source id", "probe\nforged"); err == nil { t.Fatal("hostile source id must fail closed") }
}

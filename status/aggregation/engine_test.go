package aggregation

import (
	"testing"
	"time"

	"github.com/420integrated/420-integrated/status/components"
	"github.com/420integrated/420-integrated/status/evidence"
	"github.com/420integrated/420-integrated/status/incidents"
)

func component() components.Component {
	return components.Component{ID:"rpc-1", Name:"RPC", Class:components.ClassRPC, Network:"420-testnet", Environment:"testnet", Public:true}
}

func obs(source string, state components.Health, live, ready bool, observedAt, expiresAt time.Time) evidence.Observation {
	return evidence.Observation{ComponentID:"rpc-1", SourceID:source, Network:"420-testnet", Environment:"testnet", State:state, Live:live, Ready:ready, ObservedAt:observedAt, ExpiresAt:expiresAt}
}

func TestEvaluateHealthyFreshEvidence(t *testing.T) {
	now := time.Date(2026,9,17,12,0,0,0,time.UTC)
	got, err := Evaluate(component(), []evidence.Observation{obs("a", components.HealthHealthy, true, true, now.Add(-time.Minute), now.Add(time.Minute))}, nil, now)
	if err != nil { t.Fatal(err) }
	if got.Health != components.HealthHealthy || !got.Live || !got.Ready { t.Fatalf("unexpected status: %+v", got) }
}

func TestEvaluateStaleEvidenceFailsClosedToUnknown(t *testing.T) {
	now := time.Date(2026,9,17,12,0,0,0,time.UTC)
	got, err := Evaluate(component(), []evidence.Observation{obs("a", components.HealthHealthy, true, true, now.Add(-10*time.Minute), now.Add(-time.Minute))}, nil, now)
	if err != nil { t.Fatal(err) }
	if got.Health != components.HealthUnknown || got.StaleSources != 1 || got.FreshSources != 0 { t.Fatalf("unexpected stale status: %+v", got) }
}

func TestEvaluateConflictingFreshEvidenceIsUnknown(t *testing.T) {
	now := time.Date(2026,9,17,12,0,0,0,time.UTC)
	observations := []evidence.Observation{
		obs("a", components.HealthHealthy, true, true, now.Add(-time.Minute), now.Add(time.Minute)),
		obs("b", components.HealthDegraded, true, true, now.Add(-time.Minute), now.Add(time.Minute)),
	}
	got, err := Evaluate(component(), observations, nil, now)
	if err != nil { t.Fatal(err) }
	if got.Health != components.HealthUnknown || !got.Conflicting { t.Fatalf("expected conflict to fail closed: %+v", got) }
}

func TestEvaluateHealthyClaimWithoutReadinessDegrades(t *testing.T) {
	now := time.Date(2026,9,17,12,0,0,0,time.UTC)
	got, err := Evaluate(component(), []evidence.Observation{obs("a", components.HealthHealthy, true, false, now.Add(-time.Minute), now.Add(time.Minute))}, nil, now)
	if err != nil { t.Fatal(err) }
	if got.Health != components.HealthDegraded { t.Fatalf("expected degraded, got %+v", got) }
}

func TestCriticalIncidentOverridesMaintenance(t *testing.T) {
	now := time.Date(2026,9,17,12,0,0,0,time.UTC)
	maint := incidents.Incident{ID:"m1", Kind:incidents.KindMaintenance, Title:"planned", Network:"420-testnet", Environment:"testnet", AffectedComponents:[]string{"rpc-1"}, StartedAt:now.Add(-time.Hour), PlannedStart:now.Add(-time.Hour), PlannedEnd:now.Add(time.Hour), Updates:[]incidents.Update{{At:now.Add(-time.Hour), State:incidents.StateOpen, Severity:incidents.SeverityInfo, Summary:"maintenance"}}}
	crit := incidents.Incident{ID:"i1", Kind:incidents.KindIncident, Title:"fault", Network:"420-testnet", Environment:"testnet", AffectedComponents:[]string{"rpc-1"}, StartedAt:now.Add(-time.Minute), Updates:[]incidents.Update{{At:now.Add(-time.Minute), State:incidents.StateOpen, Severity:incidents.SeverityCritical, Summary:"critical"}}}
	got, err := Evaluate(component(), []evidence.Observation{obs("a", components.HealthHealthy, true, true, now.Add(-time.Minute), now.Add(time.Minute))}, []incidents.Incident{maint, crit}, now)
	if err != nil { t.Fatal(err) }
	if got.Health != components.HealthUnavailable || got.IncidentSeverity != incidents.SeverityCritical { t.Fatalf("critical incident must win: %+v", got) }
}

func TestAggregateFailureIsolation(t *testing.T) {
	statuses := []ComponentStatus{
		{Component:components.Component{ID:"a",Name:"A",Class:components.ClassRPC,Network:"n",Environment:"e"},Health:components.HealthHealthy,Live:true,Ready:true},
		{Component:components.Component{ID:"b",Name:"B",Class:components.ClassIndexer,Network:"n",Environment:"e"},Health:components.HealthUnavailable},
	}
	got, err := Aggregate(statuses)
	if err != nil { t.Fatal(err) }
	if got.Health != components.HealthDegraded { t.Fatalf("single outage must degrade rollup, not mark all unavailable: %+v", got) }
	if got.Unavailable != 1 || got.Healthy != 1 { t.Fatalf("unexpected counts: %+v", got) }
}

func TestAggregateAllUnavailable(t *testing.T) {
	statuses := []ComponentStatus{
		{Component:components.Component{ID:"a",Name:"A",Class:components.ClassRPC,Network:"n",Environment:"e"},Health:components.HealthUnavailable},
		{Component:components.Component{ID:"b",Name:"B",Class:components.ClassIndexer,Network:"n",Environment:"e"},Health:components.HealthUnavailable},
	}
	got, err := Aggregate(statuses)
	if err != nil { t.Fatal(err) }
	if got.Health != components.HealthUnavailable { t.Fatalf("expected unavailable rollup: %+v", got) }
}

func TestAggregateDeterministicOrder(t *testing.T) {
	statuses := []ComponentStatus{
		{Component:components.Component{ID:"z",Name:"Z",Class:components.ClassRPC,Network:"n",Environment:"e"},Health:components.HealthUnknown},
		{Component:components.Component{ID:"a",Name:"A",Class:components.ClassIndexer,Network:"n",Environment:"e"},Health:components.HealthUnknown},
	}
	got, err := Aggregate(statuses)
	if err != nil { t.Fatal(err) }
	if got.Components[0].Component.ID != "a" || got.Components[1].Component.ID != "z" { t.Fatalf("not deterministic: %+v", got.Components) }
}

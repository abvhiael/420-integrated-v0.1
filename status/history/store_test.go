package history

import (
	"testing"
	"time"

	"github.com/420integrated/420-integrated/status/components"
	"github.com/420integrated/420-integrated/status/evidence"
	"github.com/420integrated/420-integrated/status/incidents"
)

func TestObservationHistoryPreservesProvenanceAndReferences(t *testing.T) {
	now := time.Date(2026,9,17,16,0,0,0,time.UTC)
	s := NewStore()
	obs := evidence.Observation{ComponentID:"rpc-1", SourceID:"probe-a", Network:"420-testnet", Environment:"testnet", State:components.HealthHealthy, Live:true, Ready:true, ObservedAt:now.Add(-time.Second), ExpiresAt:now.Add(time.Minute), References:[]evidence.Reference{{Kind:"block",Value:"0xabc"}}}
	if err := s.AppendObservation(obs, now); err != nil { t.Fatal(err) }
	got := s.ObservationHistory("rpc-1")
	if len(got) != 1 { t.Fatalf("expected 1 record, got %d", len(got)) }
	if got[0].Observation.SourceID != "probe-a" { t.Fatal("source provenance lost") }
	if len(got[0].Observation.References) != 1 || got[0].Observation.References[0].Value != "0xabc" { t.Fatal("canonical/protocol reference lost") }
	got[0].Observation.References[0].Value = "mutated"
	again := s.ObservationHistory("rpc-1")
	if again[0].Observation.References[0].Value != "0xabc" { t.Fatal("history must return defensive copies") }
}

func TestIncidentHistoryIsAppendOnlyAndRecoveryPreserved(t *testing.T) {
	now := time.Date(2026,9,17,16,0,0,0,time.UTC)
	s := NewStore()
	i := incidents.Incident{ID:"inc-1", Kind:incidents.KindIncident, Title:"rpc degraded", Network:"420-testnet", Environment:"testnet", AffectedComponents:[]string{"rpc-1"}, StartedAt:now.Add(-2*time.Minute), Updates:[]incidents.Update{{At:now.Add(-2*time.Minute),State:incidents.StateOpen,Severity:incidents.SeverityMajor,Summary:"degraded",Evidence:[]evidence.Reference{{Kind:"block",Value:"0x1"}}},{At:now.Add(-time.Minute),State:incidents.StateMonitoring,Severity:incidents.SeverityWarn,Summary:"recovering"},{At:now,State:incidents.StateResolved,Severity:incidents.SeverityInfo,Summary:"recovered"}}}
	if err := s.AppendIncident(i, now); err != nil { t.Fatal(err) }
	got := s.Incidents()
	if len(got) != 1 { t.Fatalf("expected 1 incident record, got %d", len(got)) }
	resolvedAt, ok := got[0].Incident.ResolvedAt()
	if !ok || !resolvedAt.Equal(now) { t.Fatal("recovery timestamp not preserved") }
	if got[0].Sequence == 0 { t.Fatal("history sequence must be monotonic and non-zero") }
}

func TestHistoryRejectsCanonicalAuthorityClaims(t *testing.T) {
	now := time.Date(2026,9,17,16,0,0,0,time.UTC)
	s := NewStore()
	obs := evidence.Observation{ComponentID:"rpc-1", SourceID:"probe-a", Network:"420-testnet", Environment:"testnet", State:components.HealthUnknown, ObservedAt:now, ExpiresAt:now.Add(time.Minute), Canonical:true}
	if err := s.AppendObservation(obs, now); err == nil { t.Fatal("expected canonical authority claim rejection") }
}

func TestHistorySequencesAcrossRecordTypes(t *testing.T) {
	now := time.Date(2026,9,17,16,0,0,0,time.UTC)
	s := NewStore()
	obs := evidence.Observation{ComponentID:"rpc-1", SourceID:"probe-a", Network:"420-testnet", Environment:"testnet", State:components.HealthUnknown, ObservedAt:now.Add(-time.Second), ExpiresAt:now.Add(time.Minute)}
	if err := s.AppendObservation(obs, now); err != nil { t.Fatal(err) }
	i := incidents.Incident{ID:"inc-2",Kind:incidents.KindIncident,Title:"test",Network:"420-testnet",Environment:"testnet",AffectedComponents:[]string{"rpc-1"},StartedAt:now,Updates:[]incidents.Update{{At:now,State:incidents.StateOpen,Severity:incidents.SeverityInfo,Summary:"test"}}}
	if err := s.AppendIncident(i, now.Add(time.Second)); err != nil { t.Fatal(err) }
	if s.Observations()[0].Sequence >= s.Incidents()[0].Sequence { t.Fatal("global append order not preserved") }
}

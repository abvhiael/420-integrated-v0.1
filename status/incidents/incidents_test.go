package incidents

import (
	"testing"
	"time"

	"github.com/420integrated/420-integrated/status/evidence"
)

func baseIncident() Incident {
	start := time.Date(2026, 9, 17, 12, 0, 0, 0, time.UTC)
	return Incident{
		ID: "inc-001", Kind: KindIncident, Title: "Indexer degraded",
		Network: "420-testnet", Environment: "testnet",
		AffectedComponents: []string{"indexer", "explorer"}, StartedAt: start,
		Updates: []Update{{At: start, State: StateOpen, Severity: SeverityMajor, Summary: "Indexer freshness exceeded", Evidence: []evidence.Reference{{Kind: "block", Value: "1234"}}}},
	}
}

func TestIncidentLifecycle(t *testing.T) {
	s := NewStore()
	i := baseIncident()
	if err := s.Create(i); err != nil { t.Fatal(err) }
	if err := s.Append(i.ID, Update{At: i.StartedAt.Add(time.Minute), State: StateMonitoring, Severity: SeverityWarn, Summary: "Catch-up progressing", Mitigation: "restarted replica"}); err != nil { t.Fatal(err) }
	resolved := i.StartedAt.Add(2 * time.Minute)
	if err := s.Append(i.ID, Update{At: resolved, State: StateResolved, Severity: SeverityInfo, Summary: "Freshness restored"}); err != nil { t.Fatal(err) }
	got, ok := s.Get(i.ID)
	if !ok { t.Fatal("incident missing") }
	if got.CurrentState() != StateResolved { t.Fatalf("expected resolved, got %s", got.CurrentState()) }
	at, ok := got.ResolvedAt()
	if !ok || !at.Equal(resolved) { t.Fatalf("unexpected recovery timestamp %v %v", at, ok) }
	if err := s.Append(i.ID, Update{At: resolved.Add(time.Minute), State: StateOpen, Severity: SeverityMajor, Summary: "rewrite"}); err == nil { t.Fatal("resolved incident must be immutable") }
}

func TestInvalidTransitionsFailClosed(t *testing.T) {
	i := baseIncident()
	i.Updates = append(i.Updates, Update{At: i.StartedAt.Add(time.Minute), State: StateResolved, Severity: SeverityInfo, Summary: "resolved"})
	i.Updates = append(i.Updates, Update{At: i.StartedAt.Add(2*time.Minute), State: StateOpen, Severity: SeverityMajor, Summary: "silently reopened"})
	if err := i.Validate(); err == nil { t.Fatal("resolved incident cannot be silently reopened") }
}

func TestMaintenanceMustBePlanned(t *testing.T) {
	i := baseIncident()
	i.Kind = KindMaintenance
	if err := i.Validate(); err == nil { t.Fatal("maintenance without window must fail") }
	i.PlannedStart = i.StartedAt
	i.PlannedEnd = i.StartedAt.Add(time.Hour)
	if err := i.Validate(); err != nil { t.Fatal(err) }
}

func TestIncidentCannotClaimAuthority(t *testing.T) {
	i := baseIncident()
	i.Updates[0].Authoritative = true
	if err := i.Validate(); err == nil { t.Fatal("incident update must not claim protocol authority") }
}

func TestActiveOrderingDeterministic(t *testing.T) {
	s := NewStore()
	a := baseIncident()
	b := baseIncident()
	a.ID = "inc-b"
	b.ID = "inc-a"
	if err := s.Create(a); err != nil { t.Fatal(err) }
	if err := s.Create(b); err != nil { t.Fatal(err) }
	active := s.Active()
	if len(active) != 2 || active[0].ID != "inc-a" || active[1].ID != "inc-b" { t.Fatalf("unexpected active order: %+v", active) }
}

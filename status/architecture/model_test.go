package architecture

import "testing"

func TestGenesisBoundary(t *testing.T) {
	b := GenesisBoundary()
	if b.ContractsRequired { t.Fatal("420Status must not require a Genesis contract") }
	if b.CanonicalStateAuthority { t.Fatal("420Status must not be canonical authority") }
	if !b.ReadOnlyPublicSurface { t.Fatal("public status surface must be read-only") }
	if !b.AlternativeClients { t.Fatal("alternative status clients must be allowed") }
	if b.PrivatePayloadsPublic { t.Fatal("private payloads must not be public status data") }
	if !b.NotificationsDownstream { t.Fatal("420Notifications must remain downstream of Status") }
	if !b.FreshnessRequired { t.Fatal("status observations require freshness context") }
	if b.IncidentStateCanonical { t.Fatal("incident coordination state cannot be canonical") }
}

func TestHealthStatesAreExplicit(t *testing.T) {
	for _, state := range []HealthState{HealthHealthy, HealthDegraded, HealthUnavailable, HealthMaintenance, HealthUnknown} {
		if !ValidHealthState(state) { t.Fatalf("expected valid state %q", state) }
	}
	if ValidHealthState("green") { t.Fatal("unqualified green state must not be accepted") }
}

func TestObservationIdentityFailsClosed(t *testing.T) {
	good := ObservationIdentity{Network:"420-testnet", Environment:"testnet", SourceID:"rpc-1", ObservedAt:"2026-09-17T00:00:00Z"}
	if err := good.Validate(); err != nil { t.Fatal(err) }
	cases := []ObservationIdentity{
		{Environment:"testnet", SourceID:"rpc-1", ObservedAt:"x"},
		{Network:"420-testnet", SourceID:"rpc-1", ObservedAt:"x"},
		{Network:"420-testnet", Environment:"testnet", ObservedAt:"x"},
		{Network:"420-testnet", Environment:"testnet", SourceID:"rpc-1"},
	}
	for _, tc := range cases { if err := tc.Validate(); err == nil { t.Fatalf("expected invalid identity: %+v", tc) } }
}

func TestGenesisInvariantSetIsCompleteAndUnique(t *testing.T) {
	if len(Invariants) != 14 { t.Fatalf("expected 14 invariants, got %d", len(Invariants)) }
	seen := map[string]bool{}
	for _, id := range Invariants {
		if seen[id] { t.Fatalf("duplicate invariant %s", id) }
		seen[id] = true
	}
	for i := 1; i <= 14; i++ {
		want := "STATUS-INV-0"
		if i < 10 { want += string(rune('0'+i)) } else { want = "STATUS-INV-" + string(rune('0'+i/10)) + string(rune('0'+i%10)) }
		if !seen[want] { t.Fatalf("missing invariant %s", want) }
	}
}

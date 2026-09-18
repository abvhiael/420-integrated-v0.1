package evidence

import (
	"errors"
	"testing"
	"time"

	"github.com/420integrated/420-integrated/status/components"
)

type fakeProbe struct { result ProbeResult; err error }
func (f fakeProbe) Probe(_ components.Component, _ time.Time) (ProbeResult, error) { return f.result, f.err }

func testRegistry(t *testing.T) *components.Registry {
	t.Helper()
	r := components.NewRegistry()
	if err := r.Register(components.Component{ID:"indexer", Name:"420Indexer", Class:components.ClassIndexer, Network:"420-testnet", Environment:"testnet", Public:true}); err != nil { t.Fatal(err) }
	return r
}

func TestProbeSourceAndIngestor(t *testing.T) {
	now := time.Date(2026,9,17,12,0,0,0,time.UTC)
	src, err := NewProbeSource("public-indexer", fakeProbe{result:ProbeResult{State:components.HealthHealthy, Live:true, Ready:true, TTL:time.Minute, References:[]Reference{{Kind:"block", Value:"0x420"}}}})
	if err != nil { t.Fatal(err) }
	ing, err := NewIngestor(testRegistry(t), "420-testnet", "testnet")
	if err != nil { t.Fatal(err) }
	obs, err := ing.Ingest("indexer", src, now)
	if err != nil { t.Fatal(err) }
	if obs.Canonical { t.Fatal("evidence must remain noncanonical") }
	if !obs.Fresh(now.Add(30*time.Second)) { t.Fatal("expected fresh observation") }
	if obs.Fresh(now.Add(2*time.Minute)) { t.Fatal("expired observation must be stale") }
	got := ing.Latest("indexer")
	if len(got) != 1 || got[0].SourceID != "public-indexer" { t.Fatalf("unexpected latest evidence: %+v", got) }
}

func TestObservationValidationFailsClosed(t *testing.T) {
	now := time.Now().UTC()
	base := Observation{ComponentID:"indexer", SourceID:"s", Network:"420-testnet", Environment:"testnet", State:components.HealthHealthy, Live:true, Ready:true, ObservedAt:now, ExpiresAt:now.Add(time.Minute)}
	bad := base; bad.Canonical = true
	if err := bad.Validate(now); err == nil { t.Fatal("canonical authority claim must fail") }
	bad = base; bad.Network = ""
	if err := bad.Validate(now); err == nil { t.Fatal("missing network must fail") }
	bad = base; bad.ExpiresAt = now.Add(-time.Second)
	if err := bad.Validate(now); err == nil { t.Fatal("invalid expiry must fail") }
	bad = base; bad.References = []Reference{{Kind:"block"}}
	if err := bad.Validate(now); err == nil { t.Fatal("partial reference must fail") }
}

func TestIngestorRejectsSourceAndNetworkMismatch(t *testing.T) {
	now := time.Now().UTC()
	ing, err := NewIngestor(testRegistry(t), "420-testnet", "testnet")
	if err != nil { t.Fatal(err) }
	src, _ := NewProbeSource("source-a", fakeProbe{result:ProbeResult{State:components.HealthHealthy, Live:true, Ready:true, TTL:time.Minute}})
	if _, err := ing.Ingest("missing", src, now); err == nil { t.Fatal("unknown component must fail") }

	r := components.NewRegistry()
	_ = r.Register(components.Component{ID:"wrong", Name:"wrong", Class:components.ClassRPC, Network:"other", Environment:"testnet", Public:true})
	wrong, _ := NewIngestor(r, "420-testnet", "testnet")
	if _, err := wrong.Ingest("wrong", src, now); err == nil { t.Fatal("network mismatch must fail") }
}

func TestProbeFailuresAreIsolated(t *testing.T) {
	now := time.Now().UTC()
	ing, _ := NewIngestor(testRegistry(t), "420-testnet", "testnet")
	src, _ := NewProbeSource("broken", fakeProbe{err:errors.New("down")})
	if _, err := ing.Ingest("indexer", src, now); err == nil { t.Fatal("probe error must be returned") }
	if got := ing.Latest("indexer"); len(got) != 0 { t.Fatal("failed probe must not fabricate evidence") }
}

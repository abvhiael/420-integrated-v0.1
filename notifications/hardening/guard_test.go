package hardening

import (
	"testing"
	"time"
)

func TestGuardRateLimitsPresentationScope(t *testing.T) {
	g, err := NewGuard(AbusePolicy{MaxEvents:2, Window:time.Minute})
	if err != nil { t.Fatal(err) }
	now := time.Unix(100,0).UTC()
	for i := 0; i < 2; i++ {
		ok, retry, err := g.Allow("sub-1", now)
		if err != nil || !ok || retry != 0 { t.Fatalf("allow=%v retry=%v err=%v", ok, retry, err) }
	}
	ok, retry, err := g.Allow("sub-1", now)
	if err != nil || ok || retry <= 0 { t.Fatalf("expected throttle, allow=%v retry=%v err=%v", ok, retry, err) }
	ok, _, err = g.Allow("sub-1", now.Add(time.Minute))
	if err != nil || !ok { t.Fatal("expected window reset") }
}

func TestProviderFailureIsIsolated(t *testing.T) {
	g, err := NewGuard(AbusePolicy{MaxEvents:1, Window:time.Minute})
	if err != nil { t.Fatal(err) }
	if err := g.SetProviderFailed("push-a", true); err != nil { t.Fatal(err) }
	if g.ProviderAvailable("push-a") { t.Fatal("failed provider should be unavailable") }
	if !g.ProviderAvailable("push-b") { t.Fatal("unrelated provider should remain available") }
	if err := g.SetProviderFailed("push-a", false); err != nil { t.Fatal(err) }
	if !g.ProviderAvailable("push-a") { t.Fatal("recovered provider should be available") }
}

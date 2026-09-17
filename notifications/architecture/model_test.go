package architecture

import "testing"

func TestGenesisBoundary(t *testing.T) {
	b := GenesisBoundary()
	if b.ContractsRequired { t.Fatal("notifications must not require a Genesis-specific contract") }
	if b.CanonicalStateAuthority { t.Fatal("notifications must not own canonical state") }
	if !b.IndexerPublicAPIOnly { t.Fatal("notifications must consume the public indexer boundary only") }
	if !b.ConsumerCheckpointPrivate { t.Fatal("replay checkpoints must remain consumer-owned/private") }
	if !b.SubscriptionsPrivate || !b.DeliveryEndpointsPrivate { t.Fatal("subscriptions and delivery endpoints must be private by default") }
	if !b.PromotionalConsentSeparate { t.Fatal("promotional consent must be separate") }
	if !b.WalletAuthoritative { t.Fatal("wallet must remain authorization authority") }
	if !b.AlternativeProviders { t.Fatal("alternative notification providers must be allowed") }
	if b.PrivatePayloadsIndexed { t.Fatal("private payloads must not be notification index inputs") }
}

func TestCanonicalityVocabulary(t *testing.T) {
	for _, v := range []Canonicality{CanonicalityFinalized, CanonicalityRetracted, CanonicalitySuperseded} {
		if !ValidCanonicality(v) { t.Fatalf("expected canonicality %q to be valid", v) }
	}
	if ValidCanonicality("rewritten") { t.Fatal("notification layer must not invent canonical-history rewrite state") }
}

func TestActionContextCannotInheritWalletAuthority(t *testing.T) {
	base := ActionContext{ChainID: 420, SourceID: "420/service/pay/v1"}
	if err := base.Validate(); err != nil { t.Fatalf("valid handoff rejected: %v", err) }

	cases := []ActionContext{
		{ChainID: 420, SourceID: "x", CanSign: true},
		{ChainID: 420, SourceID: "x", CanSpend: true},
		{ChainID: 420, SourceID: "x", CanGrant: true},
		{ChainID: 420, SourceID: "x", CanBypass: true},
	}
	for _, tc := range cases {
		if err := tc.Validate(); err == nil { t.Fatalf("wallet-authoritative action accepted: %#v", tc) }
	}
}

func TestReplayCheckpointRequiresOpaqueChainBoundCursor(t *testing.T) {
	if err := (ReplayCheckpoint{ChainID: 420, Cursor: "opaque:idx:0001"}).Validate(); err != nil { t.Fatal(err) }
	if err := (ReplayCheckpoint{Cursor: "opaque:idx:0001"}).Validate(); err == nil { t.Fatal("checkpoint without chain id accepted") }
	if err := (ReplayCheckpoint{ChainID: 420}).Validate(); err == nil { t.Fatal("checkpoint without cursor accepted") }
}

func TestInvariantRegistryIsExactAndUnique(t *testing.T) {
	if len(Invariants) != 14 { t.Fatalf("invariant count=%d, want 14", len(Invariants)) }
	seen := map[string]bool{}
	for i, inv := range Invariants {
		if seen[inv] { t.Fatalf("duplicate invariant %q", inv) }
		seen[inv] = true
		want := "NOTIFY-INV-0"
		if i+1 >= 10 { want = "NOTIFY-INV-" }
		if len(inv) < len(want) || inv[:len(want)] != want { t.Fatalf("unexpected invariant id %q", inv) }
	}
}

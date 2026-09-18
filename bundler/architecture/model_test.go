package architecture

import (
	"fmt"
	"testing"
)

func TestGenesisBoundary(t *testing.T) {
	b := GenesisBoundary()
	if b.ContractsRequired { t.Fatal("bundler service must not require a Bundler-specific Genesis contract") }
	if b.Custodial { t.Fatal("bundler must not custody user funds") }
	if b.AuthorizationAuthority { t.Fatal("bundler must not authorize smart-account actions") }
	if b.FinalityAuthority { t.Fatal("bundler must not determine chain finality") }
	if !b.EntryPointAuthoritative { t.Fatal("EntryPoint/account validation must remain authoritative") }
	if !b.LocalValidationRequired { t.Fatal("every operator must locally validate admitted operations") }
	if !b.AlternativeBundlersAllowed { t.Fatal("alternative bundlers must be allowed") }
	if !b.PaymasterNeutral { t.Fatal("bundler must not grant sponsorship authority") }
	if !b.StatusNonCanonical { t.Fatal("bundler status must remain operational/noncanonical") }
	if b.PrivateKeysStored { t.Fatal("bundler must not store wallet private keys") }
	if b.PeerBypassesValidation { t.Fatal("peer propagation must never bypass local validation") }
}

func TestUserOperationIdentityFailsClosed(t *testing.T) {
	good := UserOperationIdentity{
		ChainID: 420,
		EntryPoint: "0xentrypoint",
		Sender: "0xsender",
		Nonce: "7",
		Hash: "0xuserophash",
	}
	if err := good.Validate(); err != nil { t.Fatal(err) }

	cases := []UserOperationIdentity{
		{EntryPoint:"0xentrypoint", Sender:"0xsender", Nonce:"7", Hash:"0xhash"},
		{ChainID:420, Sender:"0xsender", Nonce:"7", Hash:"0xhash"},
		{ChainID:420, EntryPoint:"0xentrypoint", Nonce:"7", Hash:"0xhash"},
		{ChainID:420, EntryPoint:"0xentrypoint", Sender:"0xsender", Hash:"0xhash"},
		{ChainID:420, EntryPoint:"0xentrypoint", Sender:"0xsender", Nonce:"7"},
	}
	for _, tc := range cases {
		if err := tc.Validate(); err == nil { t.Fatalf("expected invalid identity: %+v", tc) }
	}
}

func TestGenesisInvariantSetIsCompleteAndUnique(t *testing.T) {
	if len(Invariants) != 16 { t.Fatalf("expected 16 invariants, got %d", len(Invariants)) }
	seen := map[string]bool{}
	for _, id := range Invariants {
		if seen[id] { t.Fatalf("duplicate invariant %s", id) }
		seen[id] = true
	}
	for i := 1; i <= 16; i++ {
		want := fmt.Sprintf("BUNDLER-INV-%03d", i)
		if !seen[want] { t.Fatalf("missing invariant %s", want) }
	}
}

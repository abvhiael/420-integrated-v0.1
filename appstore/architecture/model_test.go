package architecture

import "testing"

func TestGenesisBoundaryPreservesExternalAuthority(t *testing.T) {
	b := GenesisBoundary()
	if b.ContractsRequired || b.CanonicalStateAuthority {
		t.Fatal("AppStore must remain contract-free and non-canonical")
	}
	if !b.RegistryAuthoritative || !b.WalletAuthoritative {
		t.Fatal("Registry and Wallet boundaries must remain authoritative")
	}
	if !b.CatalogueRebuildable || !b.AlternativeClients {
		t.Fatal("catalogue must be rebuildable and replaceable")
	}
	if b.PrivateContentIndexed || b.LaunchHistoryPublic {
		t.Fatal("private content and launch history must not become public catalogue data")
	}
}

func TestCanonicalAndPresentationFieldsRemainSeparated(t *testing.T) {
	for _, field := range CanonicalFields() {
		if field.Authority != AuthorityCanonical {
			t.Fatalf("canonical field %s lost authority marker", field.Name)
		}
	}
	for _, field := range PresentationFields() {
		if field.Authority != AuthorityNonCanonical {
			t.Fatalf("presentation field %s became canonical", field.Name)
		}
	}
}

func TestLaunchContextCannotGrantWalletAuthority(t *testing.T) {
	base := LaunchContext{ChainID: 420, AppID: "420/app/example/v1", Network: "420"}
	if err := base.Validate(); err != nil { t.Fatal(err) }

	for _, hostile := range []LaunchContext{
		{ChainID:420, AppID:"420/app/example/v1", Network:"420", CanSign:true},
		{ChainID:420, AppID:"420/app/example/v1", Network:"420", CanGrant:true},
		{ChainID:420, AppID:"420/app/example/v1", Network:"420", CanBypass:true},
	} {
		if err := hostile.Validate(); err == nil {
			t.Fatal("wallet authority escalation must be rejected")
		}
	}
}

func TestAllGenesisInvariantsAreEnumerated(t *testing.T) {
	if len(Invariants) != 13 { t.Fatalf("expected 13 invariants, got %d", len(Invariants)) }
	for i, invariant := range Invariants {
		if invariant == "" { t.Fatalf("invariant %d is empty", i+1) }
	}
}

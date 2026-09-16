package architecture

import "testing"

func TestGenesisProfileTrustBoundary(t *testing.T) {
	p := GenesisProfile()

	if p.Service != ServiceName || p.ServiceID != ServiceID || p.Phase != Phase {
		t.Fatalf("unexpected service identity: %+v", p)
	}
	if p.ContractsRequired {
		t.Fatal("VER-INV-001: 420Verify must remain contract-free")
	}
	if p.CanonicalStateAuthority {
		t.Fatal("VER-INV-001: 420Verify must not own canonical protocol state")
	}
	if p.VerificationDatabaseCanonical {
		t.Fatal("VER-INV-008: verification records must remain non-canonical")
	}
	if !p.AlternativeVerifiersAllowed {
		t.Fatal("VER-INV-011: alternative independent verification must remain possible")
	}
}

func TestGenesisProfileVerificationMeaning(t *testing.T) {
	p := GenesisProfile()

	if !p.FullMatchRequiresRuntimeMatch {
		t.Fatal("VER-INV-002: FULL_MATCH must require deployed runtime bytecode reproduction")
	}
	if !p.ResultsBoundToChainAddressCode {
		t.Fatal("VER-INV-003: results must bind chain, address and deployed code")
	}
	if !p.ProxyAndImplementationSeparate {
		t.Fatal("VER-INV-006: proxy shell and implementation must be verified separately")
	}
	if p.VerificationImpliesAudit || p.VerificationImpliesSafety || p.VerificationImpliesOfficial {
		t.Fatal("VER-INV-002/009/013: verification must not imply audit, safety or official status")
	}
}

func TestGenesisProfileSourcesAndResultClasses(t *testing.T) {
	p := GenesisProfile()

	for _, source := range []CanonicalSource{SourceChainState, SourceRegistry} {
		if !p.AllowsSource(source) {
			t.Fatalf("required canonical source missing: %s", source)
		}
	}
	for _, class := range []ResultClass{
		ResultFullMatch,
		ResultPartialMatch,
		ResultMismatch,
		ResultUnverifiable,
	} {
		if !p.AllowsResultClass(class) {
			t.Fatalf("required result class missing: %s", class)
		}
	}
}

func TestGenesisProfileRejectsAuthorityAndSecrets(t *testing.T) {
	p := GenesisProfile()

	for _, excluded := range []SecurityExclusion{
		PrivateKeys,
		SigningSecrets,
		RegistryAuthority,
		WalletAuthority,
		GovernanceAuthority,
	} {
		if !p.Excludes(excluded) {
			t.Fatalf("required exclusion missing: %s", excluded)
		}
	}
}

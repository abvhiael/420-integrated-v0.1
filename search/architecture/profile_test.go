package architecture

import "testing"

func TestGenesisProfileAuthorityBoundary(t *testing.T) {
	p := GenesisProfile()
	if p.ServiceName != "420Search" || p.ServiceID != "420/service/search/v1" || p.Phase != "SEARCH-0" {
		t.Fatalf("unexpected identity: %+v", p)
	}
	if p.ContractsRequired || p.CanonicalStateAuthority || p.SearchOwnsChainIngestion || p.SearchMayUseDirectRPC || p.SearchDatabaseCanonical || p.RankingCanonical || p.SponsoredMayRewriteCanonical {
		t.Fatalf("authority boundary violated: %+v", p)
	}
	if !p.SearchIndexRebuildable {
		t.Fatal("search index must remain rebuildable")
	}
}

func TestGenesisProfileFreezesResolverAndDiscoveryModes(t *testing.T) {
	p := GenesisProfile()
	if len(p.Modes) != 2 || p.Modes[0] != SearchModeResolver || p.Modes[1] != SearchModeDiscovery {
		t.Fatalf("unexpected search modes: %+v", p.Modes)
	}
}

func TestGenesisProfileContainsRequiredDomains(t *testing.T) {
	p := GenesisProfile()
	required := map[ResultDomain]bool{
		DomainBlock: true,
		DomainTransaction: true,
		DomainAddress: true,
		DomainContract: true,
		DomainService: true,
		DomainName: true,
		DomainPublicIdentity: true,
		DomainAsset: true,
		DomainValidator: true,
		DomainMarketListing: true,
		DomainRightsRecord: true,
		DomainPublicCommons: true,
		DomainPublicPulse: true,
	}
	for _, domain := range p.Domains {
		delete(required, domain)
	}
	if len(required) != 0 {
		t.Fatalf("missing genesis search domains: %+v", required)
	}
}

func TestGenesisProfilePrivacyExclusionsAreExplicit(t *testing.T) {
	p := GenesisProfile()
	required := map[PrivacyExclusion]bool{
		ExcludePrivateMessenger: true,
		ExcludePrivateCommons: true,
		ExcludePrivateIdentity: true,
		ExcludeEncryptedResource: true,
		ExcludeRawAttention: true,
	}
	for _, exclusion := range p.PrivacyExclusions {
		delete(required, exclusion)
	}
	if len(required) != 0 {
		t.Fatalf("missing privacy exclusions: %+v", required)
	}
}

func TestGenesisProfileFreezesAllSearchInvariants(t *testing.T) {
	p := GenesisProfile()
	if len(p.InvariantIDs) != 12 {
		t.Fatalf("expected 12 search invariants, got %d", len(p.InvariantIDs))
	}
	for i, id := range p.InvariantIDs {
		expected := []string{
			"SRCH-INV-001", "SRCH-INV-002", "SRCH-INV-003", "SRCH-INV-004",
			"SRCH-INV-005", "SRCH-INV-006", "SRCH-INV-007", "SRCH-INV-008",
			"SRCH-INV-009", "SRCH-INV-010", "SRCH-INV-011", "SRCH-INV-012",
		}[i]
		if id != expected {
			t.Fatalf("invariant[%d]=%q expected %q", i, id, expected)
		}
	}
}

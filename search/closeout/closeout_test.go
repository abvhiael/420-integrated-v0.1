package closeout

import (
	"testing"

	"github.com/420integrated/420-integrated/search/architecture"
)

func TestGenesisManifestQualifies(t *testing.T) {
	m := GenesisManifest()
	if err := ValidateGenesisManifest(m); err != nil {
		t.Fatal(err)
	}
	if m.Service != "420Search" || m.ServiceID != "420/service/search/v1" {
		t.Fatalf("unexpected service identity: %+v", m)
	}
	if m.CanonicalAuthority || m.DirectRPC || m.ContractsRequired {
		t.Fatalf("authority boundary violated: %+v", m)
	}
	if !m.SearchIndexRebuildable {
		t.Fatal("search index must remain rebuildable")
	}
}

func TestGenesisManifestFreezesAllDomainsAndPrivacyExclusions(t *testing.T) {
	m := GenesisManifest()
	if len(m.GenesisDomains) != 13 {
		t.Fatalf("genesis domains=%d want=13", len(m.GenesisDomains))
	}
	if len(m.PrivacyExclusions) != 5 {
		t.Fatalf("privacy exclusions=%d want=5", len(m.PrivacyExclusions))
	}
	for _, forbidden := range []architecture.PrivacyExclusion{
		architecture.ExcludePrivateMessenger,
		architecture.ExcludePrivateCommons,
		architecture.ExcludePrivateIdentity,
		architecture.ExcludeEncryptedResource,
		architecture.ExcludeRawAttention,
	} {
		found := false
		for _, got := range m.PrivacyExclusions {
			if got == forbidden { found = true; break }
		}
		if !found { t.Fatalf("missing privacy exclusion %q", forbidden) }
	}
}

func TestGenesisManifestFreezesInvariantSet(t *testing.T) {
	m := GenesisManifest()
	if len(m.InvariantIDs) != 12 {
		t.Fatalf("invariants=%d want=12", len(m.InvariantIDs))
	}
	for i, id := range m.InvariantIDs {
		want := architecture.InvariantIDs[i]
		if id != want { t.Fatalf("invariant[%d]=%q want=%q", i, id, want) }
	}
}

func TestGenesisManifestRecordsFullRoadmap(t *testing.T) {
	m := GenesisManifest()
	if len(m.CompletedPhases) != 22 {
		t.Fatalf("completed phases=%d want=22", len(m.CompletedPhases))
	}
	if m.CompletedPhases[0] != "SEARCH-0" || m.CompletedPhases[len(m.CompletedPhases)-1] != "SEARCH-10" {
		t.Fatalf("phase boundaries invalid: %v", m.CompletedPhases)
	}
}

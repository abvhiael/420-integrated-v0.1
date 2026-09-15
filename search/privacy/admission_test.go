package privacy

import (
	"testing"

	"github.com/420integrated/420-integrated/search/architecture"
)

func TestGenesisPrivacyExclusionsFailClosed(t *testing.T) {
	tests := []Classification{
		ClassPrivateMessenger,
		ClassPrivateCommons,
		ClassPrivateIdentity,
		ClassEncryptedResource,
		ClassRawAttentionTelemetry,
	}
	for _, classification := range tests {
		t.Run(string(classification), func(t *testing.T) {
			err := Admit(Candidate{
				Source: architecture.SourceCommons,
				Domain: architecture.DomainPublicCommons,
				Classification: classification,
				Public: true,
			})
			if err == nil {
				t.Fatalf("expected exclusion for %s", classification)
			}
		})
	}
}

func TestPublicFlagCannotOverridePrivateClassification(t *testing.T) {
	if err := Admit(Candidate{
		Source: architecture.SourceIdentity,
		Domain: architecture.DomainPublicIdentity,
		Classification: ClassPrivateIdentity,
		Public: true,
	}); err == nil {
		t.Fatal("private identity must remain excluded even when mislabeled public")
	}
}

func TestUnclassifiedAndUnknownMaterialFailsClosed(t *testing.T) {
	for _, classification := range []Classification{"", "future_private_blob"} {
		if err := Admit(Candidate{
			Source: architecture.SourcePulse,
			Domain: architecture.DomainPublicPulse,
			Classification: classification,
			Public: true,
		}); err == nil {
			t.Fatalf("expected fail-closed classification rejection for %q", classification)
		}
	}
}

func TestPublicClassificationStillRequiresExplicitPublicAdmission(t *testing.T) {
	if err := Admit(Candidate{
		Source: architecture.SourceCommons,
		Domain: architecture.DomainPublicCommons,
		Classification: ClassPublicOnChain,
		Public: false,
	}); err == nil {
		t.Fatal("non-public record must not be admitted")
	}
}

func TestPrivateSourceBoundaryIsNeverAdmitted(t *testing.T) {
	if err := Admit(Candidate{
		Source: architecture.SourceBoundary("420Identity:private"),
		Domain: architecture.DomainPublicIdentity,
		Classification: ClassPublicOnChain,
		Public: true,
	}); err == nil {
		t.Fatal("private source boundary must fail closed")
	}
}

func TestSourceDomainPairsAreAllowlisted(t *testing.T) {
	if err := Admit(Candidate{
		Source: architecture.SourceIdentity,
		Domain: architecture.DomainPublicCommons,
		Classification: ClassPublicOnChain,
		Public: true,
	}); err == nil {
		t.Fatal("mismatched source/domain pair must fail closed")
	}
}

func TestQualifiedPublicSourcesAreAdmitted(t *testing.T) {
	tests := []Candidate{
		{Source: architecture.SourceIndexer, Domain: architecture.DomainBlock, Classification: ClassPublicOnChain, Public: true},
		{Source: architecture.SourceRegistry, Domain: architecture.DomainService, Classification: ClassPublicOnChain, Public: true},
		{Source: architecture.SourceNames, Domain: architecture.DomainName, Classification: ClassPublicOnChain, Public: true},
		{Source: architecture.SourceIdentity, Domain: architecture.DomainPublicIdentity, Classification: ClassPublicOnChain, Public: true},
		{Source: architecture.SourceMarket, Domain: architecture.DomainMarketListing, Classification: ClassPublicOnChain, Public: true},
		{Source: architecture.SourceRights, Domain: architecture.DomainRightsRecord, Classification: ClassPublicOnChain, Public: true},
		{Source: architecture.SourceCommons, Domain: architecture.DomainPublicCommons, Classification: ClassPublicOnChain, Public: true},
		{Source: architecture.SourcePulse, Domain: architecture.DomainPublicPulse, Classification: ClassPublicOnChain, Public: true},
	}
	for _, candidate := range tests {
		if err := Admit(candidate); err != nil {
			t.Fatalf("expected admission for %#v: %v", candidate, err)
		}
	}
}

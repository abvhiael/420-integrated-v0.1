package result

import (
	"testing"
	"time"

	"github.com/420integrated/420-integrated/search/architecture"
)

func ptr[T any](v T) *T { return &v }

func baseResult(t *testing.T) Result {
	t.Helper()
	r, err := New(
		architecture.DomainTransaction,
		"0xABCDEF",
		architecture.SearchModeResolver,
		Provenance{
			Source: architecture.SourceIndexer,
			Authority: "420 chain",
			ChainID: 420,
			BlockNumber: ptr(uint64(42)),
			BlockHash: "0xblock",
			TransactionHash: "0xabcdef",
			Finality: FinalitySafe,
			IndexedAt: time.Unix(1700000000, 0).UTC(),
			IndexedHeight: ptr(uint64(44)),
			FinalizedHeight: ptr(uint64(40)),
		},
		Presentation{
			Title: "Transaction 0xabcdef",
			CanonicalURL: "/tx/0xabcdef",
			Category: "transaction",
		},
	)
	if err != nil { t.Fatal(err) }
	return r
}

func TestStableIDIsDeterministicAndCaseNormalized(t *testing.T) {
	a, err := StableID(architecture.DomainAddress, architecture.SourceIndexer, "0xABC")
	if err != nil { t.Fatal(err) }
	b, err := StableID(architecture.DomainAddress, architecture.SourceIndexer, "0xabc")
	if err != nil { t.Fatal(err) }
	if a != b { t.Fatalf("stable IDs differ: %s != %s", a, b) }
	if len(a) != len("srch_")+64 { t.Fatalf("unexpected stable ID length: %d", len(a)) }
}

func TestNewResultCarriesRequiredProvenanceAndNonCanonicalMetadata(t *testing.T) {
	r := baseResult(t)
	if r.Schema != SchemaVersion { t.Fatalf("schema = %q", r.Schema) }
	if r.Provenance.ChainID != 420 { t.Fatalf("chain id = %d", r.Provenance.ChainID) }
	if r.Provenance.Finality != FinalitySafe { t.Fatalf("finality = %q", r.Provenance.Finality) }
	if r.Ranking.Canonical { t.Fatal("ranking became canonical") }
	if r.Sponsorship.Canonical { t.Fatal("sponsorship became canonical") }
	if err := r.Validate(); err != nil { t.Fatal(err) }
}

func TestValidateRejectsCanonicalRankingOrSponsorship(t *testing.T) {
	r := baseResult(t)
	r.Ranking.Canonical = true
	if err := r.Validate(); err == nil { t.Fatal("expected canonical ranking rejection") }

	r = baseResult(t)
	r.Sponsorship.Canonical = true
	if err := r.Validate(); err == nil { t.Fatal("expected canonical sponsorship rejection") }
}

func TestValidateRequiresSponsoredLabel(t *testing.T) {
	r := baseResult(t)
	r.Sponsorship.Sponsored = true
	if err := r.Validate(); err == nil { t.Fatal("expected unlabeled sponsorship rejection") }
	r.Sponsorship.Label = "sponsored"
	if err := r.Validate(); err != nil { t.Fatal(err) }
}

func TestValidateRejectsForgedStableID(t *testing.T) {
	r := baseResult(t)
	r.ID = "srch_deadbeef"
	if err := r.Validate(); err == nil { t.Fatal("expected forged ID rejection") }
}

func TestNewRejectsMissingAuthorityFreshnessOrCanonicalLink(t *testing.T) {
	_, err := New(architecture.DomainBlock, "42", architecture.SearchModeResolver,
		Provenance{Source: architecture.SourceIndexer, IndexedAt: time.Now()},
		Presentation{Title: "Block 42", CanonicalURL: "/block/42"})
	if err == nil { t.Fatal("expected authority requirement") }

	_, err = New(architecture.DomainBlock, "42", architecture.SearchModeResolver,
		Provenance{Source: architecture.SourceIndexer, Authority: "420 chain"},
		Presentation{Title: "Block 42", CanonicalURL: "/block/42"})
	if err == nil { t.Fatal("expected indexedAt requirement") }

	_, err = New(architecture.DomainBlock, "42", architecture.SearchModeResolver,
		Provenance{Source: architecture.SourceIndexer, Authority: "420 chain", IndexedAt: time.Now()},
		Presentation{Title: "Block 42"})
	if err == nil { t.Fatal("expected canonical URL requirement") }
}

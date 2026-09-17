package curation

import (
	"errors"
	"testing"

	appregistry "github.com/420integrated/420-integrated/appstore/registry"
)

func canonical(service string) appregistry.VersionRecord {
	return appregistry.VersionRecord{ServiceID: service, Version: 2, Implementation: "0x0000000000000000000000000000000000000001", CodeHash: "0x" + string(make([]byte, 64)), MetadataHash: "0x" + string(make([]byte, 64)), Active: true, BlockNumber: 10, BlockHash: "0x" + string(make([]byte, 64))}
}

func TestSponsoredPlacementRequiresLabel(t *testing.T) {
	_, err := Normalize(Metadata{ServiceID: "420/service/demo/v1", Sponsored: true})
	if !errors.Is(err, ErrSponsorLabelMissing) { t.Fatalf("expected sponsor label error, got %v", err) }
}

func TestUnsponsoredPlacementRejectsSponsorLabel(t *testing.T) {
	_, err := Normalize(Metadata{ServiceID: "420/service/demo/v1", SponsorLabel: "paid"})
	if !errors.Is(err, ErrInvalidCuration) { t.Fatalf("expected invalid curation, got %v", err) }
}

func TestCanonicalFieldsCannotBeOverridden(t *testing.T) {
	_, err := Normalize(Metadata{ServiceID: "420/service/demo/v1", Presentation: map[string]string{"implementation": "0xdead"}})
	if !errors.Is(err, ErrCanonicalOverride) { t.Fatalf("expected canonical override rejection, got %v", err) }
}

func TestComposePreservesCanonicalRecord(t *testing.T) {
	r := canonical("420/service/demo/v1")
	listing, err := Compose(r, Metadata{ServiceID: "420/service/demo/v1", Categories: []string{"Games", "games", "Social"}, Featured: true, Sponsored: true, SponsorLabel: "Sponsored", Rating: RatingSummary{Average: 4.5, Count: 12}, ReviewCount: 12})
	if err != nil { t.Fatal(err) }
	if listing.Canonical != r { t.Fatal("canonical record changed during curation") }
	if len(listing.Curation.Categories) != 2 || listing.Curation.Categories[0] != "games" || listing.Curation.Categories[1] != "social" { t.Fatalf("unexpected categories: %#v", listing.Curation.Categories) }
	if listing.Disclaimer == "" { t.Fatal("listing disclaimer missing") }
}

func TestComposeRejectsServiceMismatch(t *testing.T) {
	_, err := Compose(canonical("420/service/a/v1"), Metadata{ServiceID: "420/service/b/v1"})
	if !errors.Is(err, ErrInvalidCuration) { t.Fatalf("expected service mismatch rejection, got %v", err) }
}

func TestRatingValidation(t *testing.T) {
	for _, rating := range []RatingSummary{{Average: -1, Count: 1}, {Average: 5.1, Count: 1}, {Average: 4, Count: 0}} {
		if _, err := Normalize(Metadata{ServiceID: "420/service/demo/v1", Rating: rating}); !errors.Is(err, ErrInvalidCuration) { t.Fatalf("expected invalid rating %#v, got %v", rating, err) }
	}
}

func TestRankingIsPresentationOnly(t *testing.T) {
	a, _ := Compose(canonical("420/service/a/v1"), Metadata{ServiceID: "420/service/a/v1", Rating: RatingSummary{Average: 5, Count: 1}})
	b, _ := Compose(canonical("420/service/b/v1"), Metadata{ServiceID: "420/service/b/v1", Featured: true, Rating: RatingSummary{Average: 1, Count: 1}})
	c, _ := Compose(canonical("420/service/c/v1"), Metadata{ServiceID: "420/service/c/v1", Sponsored: true, SponsorLabel: "Sponsored", Rating: RatingSummary{Average: 4, Count: 1}})
	ordered := Rank([]Listing{a, c, b})
	if ordered[0].Canonical.ServiceID != "420/service/b/v1" || ordered[1].Canonical.ServiceID != "420/service/c/v1" { t.Fatalf("unexpected ranking: %#v", ordered) }
	if a.Canonical.ServiceID != "420/service/a/v1" { t.Fatal("ranking mutated canonical listing") }
}

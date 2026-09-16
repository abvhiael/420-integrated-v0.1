package cohorts

import (
	"testing"
	"time"

	"github.com/420integrated/420-integrated/analytics/model"
)

func testProvenance() model.Provenance {
	return model.Provenance{
		Source:          "420Indexer",
		ChainID:         420,
		IndexedHeight:   100,
		IndexedHeadHash: "0xabc",
		SafeHeight:      95,
		IndexedAt:       time.Date(2026, 9, 15, 22, 0, 0, 0, time.UTC),
	}
}

func testDefinition() Definition {
	return Definition{ID: "validator-performance", Version: "v1", Description: "rank validators by a derived public performance score", MinMembers: 3}
}

func TestBuildDeterministicRankingAndTieBreak(t *testing.T) {
	members := []Member{
		{EntityID: "0xB", Cohort: "active", Score: "10"},
		{EntityID: "0xA", Cohort: "active", Score: "10"},
		{EntityID: "0xC", Cohort: "active", Score: "9"},
	}
	result, err := Build(testDefinition(), testProvenance(), members)
	if err != nil {
		t.Fatalf("Build() error = %v", err)
	}
	if len(result.Cohorts) != 1 {
		t.Fatalf("cohorts = %d, want 1", len(result.Cohorts))
	}
	ranking := result.Cohorts[0].Ranking
	if ranking[0].EntityID != "0xa" || ranking[1].EntityID != "0xb" || ranking[2].EntityID != "0xc" {
		t.Fatalf("unexpected deterministic ranking: %#v", ranking)
	}
	if ranking[0].Rank != 1 || ranking[1].Rank != 2 || ranking[2].Rank != 3 {
		t.Fatalf("unexpected ranks: %#v", ranking)
	}
}

func TestBuildSuppressesSmallCohorts(t *testing.T) {
	members := []Member{
		{EntityID: "a", Cohort: "large", Score: "3"},
		{EntityID: "b", Cohort: "large", Score: "2"},
		{EntityID: "c", Cohort: "large", Score: "1"},
		{EntityID: "d", Cohort: "small", Score: "5"},
		{EntityID: "e", Cohort: "small", Score: "4"},
	}
	result, err := Build(testDefinition(), testProvenance(), members)
	if err != nil {
		t.Fatalf("Build() error = %v", err)
	}
	if len(result.Cohorts) != 1 || result.Cohorts[0].Key != "large" {
		t.Fatalf("unexpected exposed cohorts: %#v", result.Cohorts)
	}
	if result.SuppressedCohorts != 1 {
		t.Fatalf("SuppressedCohorts = %d, want 1", result.SuppressedCohorts)
	}
}

func TestBuildRejectsDuplicateEntityAcrossCohorts(t *testing.T) {
	members := []Member{
		{EntityID: "A", Cohort: "one", Score: "1"},
		{EntityID: "a", Cohort: "two", Score: "2"},
	}
	if _, err := Build(testDefinition(), testProvenance(), members); err == nil {
		t.Fatal("Build() expected duplicate entity error")
	}
}

func TestBuildRejectsInvalidProvenance(t *testing.T) {
	p := testProvenance()
	p.Source = "node420"
	members := []Member{
		{EntityID: "a", Cohort: "active", Score: "3"},
		{EntityID: "b", Cohort: "active", Score: "2"},
		{EntityID: "c", Cohort: "active", Score: "1"},
	}
	if _, err := Build(testDefinition(), p, members); err == nil {
		t.Fatal("Build() expected provenance error")
	}
}

func TestBuildResultIDStableAcrossInputOrder(t *testing.T) {
	first := []Member{
		{EntityID: "c", Cohort: "active", Score: "1"},
		{EntityID: "a", Cohort: "active", Score: "3"},
		{EntityID: "b", Cohort: "active", Score: "2"},
	}
	second := []Member{first[1], first[2], first[0]}

	a, err := Build(testDefinition(), testProvenance(), first)
	if err != nil {
		t.Fatalf("first Build() error = %v", err)
	}
	b, err := Build(testDefinition(), testProvenance(), second)
	if err != nil {
		t.Fatalf("second Build() error = %v", err)
	}
	if a.ID != b.ID {
		t.Fatalf("result IDs differ: %s != %s", a.ID, b.ID)
	}
}

func TestValidateRejectsCanonicalResult(t *testing.T) {
	members := []Member{
		{EntityID: "a", Cohort: "active", Score: "3"},
		{EntityID: "b", Cohort: "active", Score: "2"},
		{EntityID: "c", Cohort: "active", Score: "1"},
	}
	result, err := Build(testDefinition(), testProvenance(), members)
	if err != nil {
		t.Fatalf("Build() error = %v", err)
	}
	result.Canonical = true
	if err := Validate(result); err == nil {
		t.Fatal("Validate() expected canonical rejection")
	}
}

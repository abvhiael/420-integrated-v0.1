package sponsorship

import (
	"reflect"
	"testing"
	"time"

	"github.com/420integrated/420-integrated/search/architecture"
	"github.com/420integrated/420-integrated/search/query"
	searchresult "github.com/420integrated/420-integrated/search/result"
)

func TestSponsoredLaneDoesNotMutateOrganicRankingOrCanonicalData(t *testing.T) {
	now := time.Date(2026, 9, 11, 15, 30, 0, 0, time.UTC)
	candidate := sponsoredFixture(t, architecture.DomainAsset, "asset-420", "Kush Asset", 321)
	original := candidate
	plan, err := query.Parse("kush")
	if err != nil { t.Fatal(err) }

	set, err := Apply(plan, []searchresult.Result{candidate}, []Campaign{{
		ID: "campaign-1", TargetResultID: candidate.ID, Label: "Sponsored", Priority: 99,
		Active: true, QueryTerms: []string{"kush"}, Domains: []architecture.ResultDomain{architecture.DomainAsset},
	}}, now, 1)
	if err != nil { t.Fatal(err) }
	if len(set.Sponsored) != 1 || len(set.Organic) != 1 { t.Fatalf("unexpected set sizes: %#v", set) }
	got := set.Sponsored[0].Result
	if !got.Sponsorship.Sponsored || got.Sponsorship.Label != "Sponsored" || got.Sponsorship.Campaign != "campaign-1" { t.Fatalf("bad sponsorship: %#v", got.Sponsorship) }
	if !reflect.DeepEqual(got.Ranking, candidate.Ranking) { t.Fatalf("sponsorship changed ranking: %#v vs %#v", got.Ranking, candidate.Ranking) }
	if got.ID != candidate.ID || got.SourceKey != candidate.SourceKey || got.Provenance != candidate.Provenance || !reflect.DeepEqual(got.Presentation, candidate.Presentation) { t.Fatal("sponsorship changed canonical/result identity fields") }
	if !reflect.DeepEqual(set.Organic[0], original) { t.Fatal("organic result mutated") }
	if !reflect.DeepEqual(candidate, original) { t.Fatal("input candidate mutated") }
}

func TestCampaignPriorityOnlyOrdersSponsoredLane(t *testing.T) {
	now := time.Date(2026, 9, 11, 15, 30, 0, 0, time.UTC)
	a := sponsoredFixture(t, architecture.DomainAsset, "a", "Alpha", 1000)
	b := sponsoredFixture(t, architecture.DomainAsset, "b", "Beta", 10)
	plan, err := query.Parse("assets")
	if err != nil { t.Fatal(err) }
	set, err := Apply(plan, []searchresult.Result{a, b}, []Campaign{
		{ID:"low", TargetResultID:a.ID, Label:"Sponsored", Priority:1, Active:true},
		{ID:"high", TargetResultID:b.ID, Label:"Sponsored", Priority:100, Active:true},
	}, now, 2)
	if err != nil { t.Fatal(err) }
	if set.Sponsored[0].Campaign != "high" { t.Fatalf("sponsored priority order wrong: %#v", set.Sponsored) }
	if set.Organic[0].ID != a.ID || set.Organic[1].ID != b.ID { t.Fatal("organic order changed by campaign priority") }
	if set.Organic[0].Ranking.Score != 1000 || set.Organic[1].Ranking.Score != 10 { t.Fatal("organic scores changed") }
}

func TestInactiveExpiredAndMismatchedCampaignsAreExcluded(t *testing.T) {
	now := time.Date(2026, 9, 11, 15, 30, 0, 0, time.UTC)
	candidate := sponsoredFixture(t, architecture.DomainAsset, "asset", "Asset", 10)
	plan, err := query.Parse("kush")
	if err != nil { t.Fatal(err) }
	campaigns := []Campaign{
		{ID:"inactive", TargetResultID:candidate.ID, Label:"Sponsored", Active:false},
		{ID:"expired", TargetResultID:candidate.ID, Label:"Sponsored", Active:true, EndsAt:now},
		{ID:"future", TargetResultID:candidate.ID, Label:"Sponsored", Active:true, StartsAt:now.Add(time.Minute)},
		{ID:"domain", TargetResultID:candidate.ID, Label:"Sponsored", Active:true, Domains:[]architecture.ResultDomain{architecture.DomainValidator}},
		{ID:"query", TargetResultID:candidate.ID, Label:"Sponsored", Active:true, QueryTerms:[]string{"other"}},
	}
	set, err := Apply(plan, []searchresult.Result{candidate}, campaigns, now, 5)
	if err != nil { t.Fatal(err) }
	if len(set.Sponsored) != 0 { t.Fatalf("ineligible campaigns leaked: %#v", set.Sponsored) }
}

func TestSponsoredCampaignRequiresExplicitDisclosure(t *testing.T) {
	now := time.Date(2026, 9, 11, 15, 30, 0, 0, time.UTC)
	candidate := sponsoredFixture(t, architecture.DomainAsset, "asset", "Asset", 10)
	plan, err := query.Parse("asset")
	if err != nil { t.Fatal(err) }
	_, err = Apply(plan, []searchresult.Result{candidate}, []Campaign{{ID:"c", TargetResultID:candidate.ID, Active:true}}, now, 1)
	if err == nil { t.Fatal("expected missing disclosure label error") }
}

func TestDuplicateCampaignsCannotDuplicateSponsoredTarget(t *testing.T) {
	now := time.Date(2026, 9, 11, 15, 30, 0, 0, time.UTC)
	candidate := sponsoredFixture(t, architecture.DomainAsset, "asset", "Asset", 10)
	plan, err := query.Parse("asset")
	if err != nil { t.Fatal(err) }
	set, err := Apply(plan, []searchresult.Result{candidate}, []Campaign{
		{ID:"a", TargetResultID:candidate.ID, Label:"Sponsored", Priority:5, Active:true},
		{ID:"b", TargetResultID:candidate.ID, Label:"Sponsored", Priority:10, Active:true},
	}, now, 5)
	if err != nil { t.Fatal(err) }
	if len(set.Sponsored) != 1 { t.Fatalf("duplicate sponsored target: %#v", set.Sponsored) }
}

func TestZeroSponsoredLimitProducesOrganicOnly(t *testing.T) {
	now := time.Date(2026, 9, 11, 15, 30, 0, 0, time.UTC)
	candidate := sponsoredFixture(t, architecture.DomainAsset, "asset", "Asset", 10)
	plan, err := query.Parse("asset")
	if err != nil { t.Fatal(err) }
	set, err := Apply(plan, []searchresult.Result{candidate}, []Campaign{{ID:"c", TargetResultID:candidate.ID, Label:"Sponsored", Active:true}}, now, 0)
	if err != nil { t.Fatal(err) }
	if len(set.Sponsored) != 0 || len(set.Organic) != 1 { t.Fatalf("unexpected zero-limit result: %#v", set) }
}

func sponsoredFixture(t *testing.T, domain architecture.ResultDomain, key, title string, score float64) searchresult.Result {
	t.Helper()
	n := uint64(100)
	r, err := searchresult.New(domain, key, architecture.SearchModeDiscovery, searchresult.Provenance{
		Source: architecture.SourceIndexer, Authority:"test authority", ChainID:420, BlockNumber:&n,
		Finality:searchresult.FinalitySafe, IndexedAt:time.Date(2026,9,11,15,0,0,0,time.UTC), IndexedHeight:&n,
	}, searchresult.Presentation{Title:title, CanonicalURL:"/search/"+key})
	if err != nil { t.Fatal(err) }
	r.Ranking = searchresult.Ranking{Score:score, Signals:[]string{"fixture"}, Ranker:"420-search-ranker-v1", Canonical:false}
	return r
}

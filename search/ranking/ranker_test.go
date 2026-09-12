package ranking

import (
	"reflect"
	"testing"
	"time"

	"github.com/420integrated/420-integrated/search/architecture"
	"github.com/420integrated/420-integrated/search/query"
	searchresult "github.com/420integrated/420-integrated/search/result"
)

func mkResult(t *testing.T, domain architecture.ResultDomain, key, title string, finality searchresult.Finality) searchresult.Result {
	t.Helper()
	now := time.Unix(1_700_000_000, 0).UTC()
	r, err := searchresult.New(domain, key, architecture.SearchModeDiscovery, searchresult.Provenance{
		Source: architecture.SourceIndexer,
		Authority: "test canonical authority",
		Finality: finality,
		IndexedAt: now,
	}, searchresult.Presentation{
		Title: title,
		CanonicalURL: "/" + key,
	})
	if err != nil { t.Fatal(err) }
	return r
}

func TestExactSourceKeyOutranksTextMatch(t *testing.T) {
	plan, err := query.Parse("asset:0xabc")
	if err != nil { t.Fatal(err) }
	exact := mkResult(t, architecture.DomainAsset, "0xabc", "Some Asset", searchresult.FinalityHead)
	text := mkResult(t, architecture.DomainAsset, "other", "0xabc", searchresult.FinalityFinalized)

	got, err := Rank(plan, []searchresult.Result{text, exact})
	if err != nil { t.Fatal(err) }
	if len(got) != 2 { t.Fatalf("len = %d", len(got)) }
	if got[0].SourceKey != "0xabc" { t.Fatalf("top result = %q", got[0].SourceKey) }
	if got[0].Ranking.Ranker != RankerVersion || got[0].Ranking.Canonical {
		t.Fatalf("invalid ranking metadata: %#v", got[0].Ranking)
	}
}

func TestDomainFiltersExcludeIneligibleResults(t *testing.T) {
	plan, err := query.Parse("domain:assets kush")
	if err != nil { t.Fatal(err) }
	asset := mkResult(t, architecture.DomainAsset, "a", "kush", searchresult.FinalitySafe)
	validator := mkResult(t, architecture.DomainValidator, "v", "kush", searchresult.FinalitySafe)
	got, err := Rank(plan, []searchresult.Result{validator, asset})
	if err != nil { t.Fatal(err) }
	if len(got) != 1 || got[0].Domain != architecture.DomainAsset { t.Fatalf("unexpected results: %#v", got) }
}

func TestStableTieBreakByResultID(t *testing.T) {
	plan, err := query.Parse("nomatch")
	if err != nil { t.Fatal(err) }
	a := mkResult(t, architecture.DomainAsset, "b", "x", searchresult.FinalityUnknown)
	b := mkResult(t, architecture.DomainAsset, "a", "x", searchresult.FinalityUnknown)
	got1, err := Rank(plan, []searchresult.Result{a, b})
	if err != nil { t.Fatal(err) }
	got2, err := Rank(plan, []searchresult.Result{b, a})
	if err != nil { t.Fatal(err) }
	if got1[0].ID != got2[0].ID || got1[1].ID != got2[1].ID {
		t.Fatalf("tie order changed with input order")
	}
	if got1[0].ID > got1[1].ID { t.Fatalf("IDs not ascending on tie") }
}

func TestRankingDoesNotMutateCanonicalFieldsOrInput(t *testing.T) {
	plan, err := query.Parse("kush")
	if err != nil { t.Fatal(err) }
	original := mkResult(t, architecture.DomainAsset, "asset-1", "Kush", searchresult.FinalityFinalized)
	original.Presentation.Tags = []string{"kush"}
	original.Sponsorship = searchresult.Sponsorship{Sponsored: true, Label: "Sponsored", Campaign: "cmp", Canonical: false}
	before := original
	before.Presentation.Tags = append([]string(nil), original.Presentation.Tags...)

	got, err := Rank(plan, []searchresult.Result{original})
	if err != nil { t.Fatal(err) }
	if len(got) != 1 { t.Fatalf("len = %d", len(got)) }
	if original.Ranking.Ranker != "unranked" || original.Ranking.Score != 0 { t.Fatalf("input was mutated: %#v", original.Ranking) }
	if got[0].ID != before.ID || got[0].SourceKey != before.SourceKey || got[0].Provenance != before.Provenance || got[0].Presentation.CanonicalURL != before.Presentation.CanonicalURL || !reflect.DeepEqual(got[0].Sponsorship, before.Sponsorship) {
		t.Fatalf("canonical or sponsorship fields changed")
	}
}

func TestSponsorshipDoesNotAffectScore(t *testing.T) {
	plan, err := query.Parse("kush")
	if err != nil { t.Fatal(err) }
	a := mkResult(t, architecture.DomainAsset, "a", "kush", searchresult.FinalitySafe)
	b := mkResult(t, architecture.DomainAsset, "b", "kush", searchresult.FinalitySafe)
	b.Sponsorship = searchresult.Sponsorship{Sponsored: true, Label: "Sponsored", Campaign: "paid", Canonical: false}
	got, err := Rank(plan, []searchresult.Result{a, b})
	if err != nil { t.Fatal(err) }
	if got[0].Ranking.Score != got[1].Ranking.Score { t.Fatalf("sponsorship changed score: %v vs %v", got[0].Ranking.Score, got[1].Ranking.Score) }
}

func TestInvalidCandidateFailsClosed(t *testing.T) {
	plan, err := query.Parse("kush")
	if err != nil { t.Fatal(err) }
	bad := mkResult(t, architecture.DomainAsset, "a", "kush", searchresult.FinalitySafe)
	bad.ID = "forged"
	if _, err := Rank(plan, []searchresult.Result{bad}); err == nil { t.Fatal("expected forged candidate rejection") }
}

package pagination

import (
	"testing"
	"time"

	"github.com/420integrated/420-integrated/search/architecture"
	"github.com/420integrated/420-integrated/search/query"
	"github.com/420integrated/420-integrated/search/ranking"
	searchresult "github.com/420integrated/420-integrated/search/result"
)

func TestSnapshotPaginationWalksDeterministicRankedSet(t *testing.T) {
	plan, err := query.Parse("kush")
	if err != nil { t.Fatal(err) }
	ranked := rankedFixtures(t, []fixture{{"a", 300}, {"b", 200}, {"c", 200}, {"d", 100}})
	snapshot := Snapshot{IndexedHeight: 4200, FinalizedHeight: 4190}

	first, err := Paginate(plan, ranked, snapshot, 2, "")
	if err != nil { t.Fatal(err) }
	if len(first.Items) != 2 || first.NextCursor == nil { t.Fatalf("unexpected first page: %#v", first) }
	second, err := Paginate(plan, ranked, snapshot, 2, *first.NextCursor)
	if err != nil { t.Fatal(err) }
	if len(second.Items) != 2 || second.NextCursor != nil { t.Fatalf("unexpected second page: %#v", second) }
	if first.Items[0].ID == second.Items[0].ID { t.Fatal("pagination repeated result") }
}

func TestCursorRejectsDifferentQueryPlan(t *testing.T) {
	plan, _ := query.Parse("kush")
	ranked := rankedFixtures(t, []fixture{{"a", 20}, {"b", 10}})
	snapshot := Snapshot{IndexedHeight: 4200, FinalizedHeight: 4190}
	first, err := Paginate(plan, ranked, snapshot, 1, "")
	if err != nil { t.Fatal(err) }
	other, _ := query.Parse("hash")
	if _, err := Paginate(other, ranked, snapshot, 1, *first.NextCursor); err == nil { t.Fatal("expected query-bound cursor rejection") }
}

func TestCursorRejectsDifferentSnapshot(t *testing.T) {
	plan, _ := query.Parse("kush")
	ranked := rankedFixtures(t, []fixture{{"a", 20}, {"b", 10}})
	first, err := Paginate(plan, ranked, Snapshot{IndexedHeight:4200, FinalizedHeight:4190}, 1, "")
	if err != nil { t.Fatal(err) }
	if _, err := Paginate(plan, ranked, Snapshot{IndexedHeight:4201, FinalizedHeight:4190}, 1, *first.NextCursor); err == nil { t.Fatal("expected snapshot-bound cursor rejection") }
}

func TestCursorRejectsMissingPosition(t *testing.T) {
	plan, _ := query.Parse("kush")
	ranked := rankedFixtures(t, []fixture{{"a", 20}, {"b", 10}})
	snapshot := Snapshot{IndexedHeight:4200, FinalizedHeight:4190}
	first, err := Paginate(plan, ranked, snapshot, 1, "")
	if err != nil { t.Fatal(err) }
	changed := ranked[1:]
	if _, err := Paginate(plan, changed, snapshot, 1, *first.NextCursor); err == nil { t.Fatal("expected missing cursor position rejection") }
}

func TestRejectsInvalidPageSizeAndSnapshot(t *testing.T) {
	plan, _ := query.Parse("kush")
	ranked := rankedFixtures(t, []fixture{{"a", 10}})
	for _, tc := range []struct{ snapshot Snapshot; limit int }{
		{Snapshot{}, 1},
		{Snapshot{IndexedHeight:10, FinalizedHeight:11}, 1},
		{Snapshot{IndexedHeight:10, FinalizedHeight:9}, 0},
		{Snapshot{IndexedHeight:10, FinalizedHeight:9}, MaxPageSize+1},
	} {
		if _, err := Paginate(plan, ranked, tc.snapshot, tc.limit, ""); err == nil { t.Fatalf("expected rejection: %#v", tc) }
	}
}

func TestRejectsUnsortedOrWrongRankerResults(t *testing.T) {
	plan, _ := query.Parse("kush")
	snapshot := Snapshot{IndexedHeight:4200, FinalizedHeight:4190}
	ranked := rankedFixtures(t, []fixture{{"a", 10}, {"b", 20}})
	if _, err := Paginate(plan, ranked, snapshot, 2, ""); err == nil { t.Fatal("expected unsorted result rejection") }
	ranked = rankedFixtures(t, []fixture{{"a", 20}})
	ranked[0].Ranking.Ranker = "old-ranker"
	if _, err := Paginate(plan, ranked, snapshot, 1, ""); err == nil { t.Fatal("expected wrong-ranker rejection") }
}

func TestPageReturnsCopies(t *testing.T) {
	plan, _ := query.Parse("kush")
	ranked := rankedFixtures(t, []fixture{{"a", 10}})
	page, err := Paginate(plan, ranked, Snapshot{IndexedHeight:4200, FinalizedHeight:4190}, 1, "")
	if err != nil { t.Fatal(err) }
	page.Items[0].Ranking.Signals[0] = "mutated"
	if ranked[0].Ranking.Signals[0] == "mutated" { t.Fatal("pagination mutated source result") }
}

type fixture struct { key string; score float64 }

func rankedFixtures(t *testing.T, fixtures []fixture) []searchresult.Result {
	t.Helper()
	n := uint64(100)
	out := make([]searchresult.Result, 0, len(fixtures))
	for _, f := range fixtures {
		r, err := searchresult.New(architecture.DomainAsset, f.key, architecture.SearchModeDiscovery, searchresult.Provenance{
			Source: architecture.SourceIndexer, Authority:"test", ChainID:420, BlockNumber:&n,
			Finality:searchresult.FinalitySafe, IndexedAt:time.Date(2026,9,14,16,0,0,0,time.UTC), IndexedHeight:&n,
		}, searchresult.Presentation{Title:f.key, CanonicalURL:"/assets/"+f.key})
		if err != nil { t.Fatal(err) }
		r.Ranking = searchresult.Ranking{Score:f.score, Signals:[]string{"fixture"}, Ranker:ranking.RankerVersion, Canonical:false}
		out = append(out, r)
	}
	return out
}

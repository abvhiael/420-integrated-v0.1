package consistency

import (
	"strings"
	"testing"
	"time"

	"github.com/420integrated/420-integrated/search/architecture"
	"github.com/420integrated/420-integrated/search/pagination"
	searchresult "github.com/420integrated/420-integrated/search/result"
)

func TestAssessSnapshotClassifiesFreshness(t *testing.T) {
	cases := []struct {
		name string
		state SnapshotState
		want Freshness
		lag uint64
	}{
		{"current", SnapshotState{Search: pagination.Snapshot{IndexedHeight: 100, FinalizedHeight: 90}, Upstream: pagination.Snapshot{IndexedHeight: 100, FinalizedHeight: 90}, MaxLag: 5}, FreshnessCurrent, 0},
		{"lagging", SnapshotState{Search: pagination.Snapshot{IndexedHeight: 98, FinalizedHeight: 90}, Upstream: pagination.Snapshot{IndexedHeight: 100, FinalizedHeight: 90}, MaxLag: 5}, FreshnessLagging, 2},
		{"stale", SnapshotState{Search: pagination.Snapshot{IndexedHeight: 90, FinalizedHeight: 85}, Upstream: pagination.Snapshot{IndexedHeight: 100, FinalizedHeight: 90}, MaxLag: 5}, FreshnessStale, 10},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got, err := AssessSnapshot(tc.state)
			if err != nil { t.Fatal(err) }
			if got.Freshness != tc.want || got.Lag != tc.lag { t.Fatalf("got %#v", got) }
		})
	}
}

func TestAssessSnapshotRejectsImpossibleRelationships(t *testing.T) {
	for _, state := range []SnapshotState{
		{Search: pagination.Snapshot{IndexedHeight: 101, FinalizedHeight: 90}, Upstream: pagination.Snapshot{IndexedHeight: 100, FinalizedHeight: 90}},
		{Search: pagination.Snapshot{IndexedHeight: 100, FinalizedHeight: 91}, Upstream: pagination.Snapshot{IndexedHeight: 100, FinalizedHeight: 90}},
	} {
		if _, err := AssessSnapshot(state); err == nil { t.Fatal("expected snapshot rejection") }
	}
}

func TestValidateResultAtSnapshotEnforcesFinalityAndHeight(t *testing.T) {
	snapshot := pagination.Snapshot{IndexedHeight: 100, FinalizedHeight: 90}
	good := testResult(t, "a", 95, "0xaaa", searchresult.FinalitySafe)
	if err := ValidateResultAtSnapshot(good, snapshot); err != nil { t.Fatal(err) }

	bad := testResult(t, "b", 91, "0xbbb", searchresult.FinalityFinalized)
	if err := ValidateResultAtSnapshot(bad, snapshot); err == nil { t.Fatal("expected finalized-above-snapshot rejection") }

	bad = testResult(t, "c", 80, "0xccc", searchresult.FinalityHead)
	if err := ValidateResultAtSnapshot(bad, snapshot); err == nil { t.Fatal("expected finalized-range head rejection") }

	bad = testResult(t, "d", 101, "0xddd", searchresult.FinalitySafe)
	if err := ValidateResultAtSnapshot(bad, snapshot); err == nil { t.Fatal("expected future block rejection") }
}

func TestReconcileAllowsHeadReorgButReportsIt(t *testing.T) {
	prevSnap := pagination.Snapshot{IndexedHeight: 100, FinalizedHeight: 90}
	currSnap := pagination.Snapshot{IndexedHeight: 102, FinalizedHeight: 91}
	before := testResult(t, "same", 99, "0xaaa", searchresult.FinalityHead)
	after := before
	after.Provenance.BlockHash = "0xbbb"
	report, err := Reconcile([]searchresult.Result{before}, []searchresult.Result{after}, prevSnap, currSnap)
	if err != nil { t.Fatal(err) }
	if len(report.ReorgedIDs) != 1 || report.ReorgedIDs[0] != before.ID { t.Fatalf("report=%#v", report) }
}

func TestReconcileAllowsNonFinalizedDisappearance(t *testing.T) {
	prevSnap := pagination.Snapshot{IndexedHeight: 100, FinalizedHeight: 90}
	currSnap := pagination.Snapshot{IndexedHeight: 101, FinalizedHeight: 90}
	before := testResult(t, "gone", 99, "0xaaa", searchresult.FinalityHead)
	report, err := Reconcile([]searchresult.Result{before}, nil, prevSnap, currSnap)
	if err != nil { t.Fatal(err) }
	if len(report.ReorgedIDs) != 1 { t.Fatalf("report=%#v", report) }
}

func TestReconcileRejectsFinalizedDisappearanceAndRewrite(t *testing.T) {
	prevSnap := pagination.Snapshot{IndexedHeight: 100, FinalizedHeight: 90}
	currSnap := pagination.Snapshot{IndexedHeight: 102, FinalizedHeight: 92}
	finalized := testResult(t, "final", 80, "0xaaa", searchresult.FinalityFinalized)
	if _, err := Reconcile([]searchresult.Result{finalized}, nil, prevSnap, currSnap); err == nil || !strings.Contains(err.Error(), "finalized result disappeared") {
		t.Fatalf("unexpected err=%v", err)
	}
	changed := finalized
	changed.Provenance.BlockHash = "0xbbb"
	if _, err := Reconcile([]searchresult.Result{finalized}, []searchresult.Result{changed}, prevSnap, currSnap); err == nil || !strings.Contains(err.Error(), "finalized result provenance changed") {
		t.Fatalf("unexpected err=%v", err)
	}
}

func TestReconcileRejectsSnapshotRegressionAndDuplicateIDs(t *testing.T) {
	prevSnap := pagination.Snapshot{IndexedHeight: 100, FinalizedHeight: 90}
	if _, err := Reconcile(nil, nil, prevSnap, pagination.Snapshot{IndexedHeight: 99, FinalizedHeight: 90}); err == nil { t.Fatal("expected indexed regression rejection") }
	if _, err := Reconcile(nil, nil, prevSnap, pagination.Snapshot{IndexedHeight: 100, FinalizedHeight: 89}); err == nil { t.Fatal("expected finalized regression rejection") }

	r := testResult(t, "dup", 95, "0xaaa", searchresult.FinalitySafe)
	if _, err := Reconcile([]searchresult.Result{r, r}, nil, prevSnap, prevSnap); err == nil { t.Fatal("expected duplicate id rejection") }
}

func TestReconcileSeparatesPresentationUpdateFromReorg(t *testing.T) {
	snap := pagination.Snapshot{IndexedHeight: 100, FinalizedHeight: 90}
	before := testResult(t, "present", 95, "0xaaa", searchresult.FinalitySafe)
	after := before
	after.Presentation.Snippet = "updated non-canonical presentation"
	report, err := Reconcile([]searchresult.Result{before}, []searchresult.Result{after}, snap, snap)
	if err != nil { t.Fatal(err) }
	if len(report.ReorgedIDs) != 0 || len(report.UpdatedIDs) != 1 || report.UpdatedIDs[0] != before.ID { t.Fatalf("report=%#v", report) }
}

func testResult(t *testing.T, key string, block uint64, blockHash string, finality searchresult.Finality) searchresult.Result {
	t.Helper()
	indexed := uint64(100)
	finalized := uint64(90)
	result, err := searchresult.New(
		architecture.DomainTransaction,
		key,
		architecture.SearchModeResolver,
		searchresult.Provenance{
			Source: architecture.SourceIndexer,
			Authority: "qualified 420Indexer projection",
			ChainID: 420,
			BlockNumber: &block,
			BlockHash: blockHash,
			TransactionHash: "0xtx" + key,
			Finality: finality,
			IndexedAt: time.Unix(1_700_000_000, 0),
			IndexedHeight: &indexed,
			FinalizedHeight: &finalized,
		},
		searchresult.Presentation{Title: "tx " + key, CanonicalURL: "/tx/" + key},
	)
	if err != nil { t.Fatal(err) }
	return result
}

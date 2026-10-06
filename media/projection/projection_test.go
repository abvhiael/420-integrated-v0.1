package projection

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/420integrated/420-integrated/media/authority"
	mediastorage "github.com/420integrated/420-integrated/media/storage"
	"github.com/420integrated/420-integrated/search/architecture"
	searchresult "github.com/420integrated/420-integrated/search/result"
)

type publicAuthorizerFake struct {
	err   error
	calls int
}

func (f *publicAuthorizerFake) AuthorizePublication(context.Context, authority.Actor, authority.Binding) error {
	f.calls++
	return f.err
}

func publicAsset() mediastorage.Asset {
	return mediastorage.Asset{
		ID: "media-1", State: mediastorage.StateReady, Visibility: mediastorage.VisibilityPublic,
	}
}

func status() IndexerStatus {
	return IndexerStatus{Qualified: true, ChainID: 420, IndexedHeight: 120, SafeHeight: 110, FinalizedHeight: 100}
}

func provenance(block uint64, finality searchresult.Finality, log uint64) Provenance {
	return Provenance{
		BlockNumber: block, BlockHash: "0xblock", TransactionHash: "0xtx",
		LogIndex: log, Finality: finality, IndexedAt: time.Unix(2_000_000_000, 0),
	}
}

func metadata() Metadata {
	return Metadata{Title: "Public media", CanonicalURL: "/media/media-1", Tags: []string{"Video", "media"}}
}

func build(t *testing.T, block uint64, finality searchresult.Finality, log uint64) searchresult.Result {
	return buildAsset(t, "media-1", block, finality, log)
}

func buildAsset(t *testing.T, assetID string, block uint64, finality searchresult.Finality, log uint64) searchresult.Result {
	t.Helper()
	a := &publicAuthorizerFake{}
	asset := publicAsset()
	asset.ID = assetID
	meta := metadata()
	meta.CanonicalURL = "/media/" + assetID
	r, err := BuildSearchResult(
		context.Background(), a,
		authority.Actor{Wallet: "0x1111111111111111111111111111111111111111"},
		authority.Binding{}, asset, status(), provenance(block, finality, log), meta,
	)
	if err != nil {
		t.Fatal(err)
	}
	return r
}

func TestBuildSearchResultPreservesPublicOnlyProvenance(t *testing.T) {
	auth := &publicAuthorizerFake{}
	r, err := BuildSearchResult(
		context.Background(), auth,
		authority.Actor{Wallet: "0x1111111111111111111111111111111111111111"},
		authority.Binding{}, publicAsset(), status(), provenance(100, searchresult.FinalityFinalized, 7), metadata(),
	)
	if err != nil {
		t.Fatal(err)
	}
	if auth.calls != 1 {
		t.Fatalf("authorization calls=%d", auth.calls)
	}
	if r.Domain != architecture.DomainAsset || r.Provenance.Source != architecture.SourceIndexer {
		t.Fatalf("unexpected search boundary: %+v", r)
	}
	if r.Provenance.BlockNumber == nil || *r.Provenance.BlockNumber != 100 ||
		r.Provenance.LogIndex == nil || *r.Provenance.LogIndex != 7 ||
		r.Provenance.Finality != searchresult.FinalityFinalized {
		t.Fatalf("provenance=%+v", r.Provenance)
	}
	if r.Ranking.Canonical || r.Sponsorship.Canonical {
		t.Fatal("projection became canonical")
	}
	if len(r.Presentation.Tags) != 2 || r.Presentation.Tags[0] != "media" || r.Presentation.Tags[1] != "video" {
		t.Fatalf("tags=%v", r.Presentation.Tags)
	}
}

func TestPrivateOrRightsDeniedAssetNeverProjects(t *testing.T) {
	private := publicAsset()
	private.Visibility = mediastorage.VisibilityPrivate
	auth := &publicAuthorizerFake{}
	if _, err := BuildSearchResult(context.Background(), auth, authority.Actor{}, authority.Binding{}, private, status(), provenance(100, searchresult.FinalityFinalized, 1), metadata()); err == nil {
		t.Fatal("private asset projected")
	}
	auth.err = authority.ErrRightsNotEffective
	if _, err := BuildSearchResult(context.Background(), auth, authority.Actor{}, authority.Binding{}, publicAsset(), status(), provenance(100, searchresult.FinalityFinalized, 1), metadata()); !errors.Is(err, authority.ErrRightsNotEffective) {
		t.Fatalf("rights error=%v", err)
	}
}

func TestSearchProjectionFailsClosedOnUnqualifiedOrImpossibleFinality(t *testing.T) {
	auth := &publicAuthorizerFake{}
	badStatus := status()
	badStatus.Qualified = false
	if _, err := BuildSearchResult(context.Background(), auth, authority.Actor{}, authority.Binding{}, publicAsset(), badStatus, provenance(100, searchresult.FinalityFinalized, 1), metadata()); !errors.Is(err, ErrUnqualifiedSource) {
		t.Fatalf("unqualified err=%v", err)
	}
	if _, err := BuildSearchResult(context.Background(), auth, authority.Actor{}, authority.Binding{}, publicAsset(), status(), provenance(111, searchresult.FinalitySafe, 1), metadata()); !errors.Is(err, ErrInvalidProjection) {
		t.Fatalf("safe boundary err=%v", err)
	}
	if _, err := BuildSearchResult(context.Background(), auth, authority.Actor{}, authority.Binding{}, publicAsset(), status(), provenance(101, searchresult.FinalityFinalized, 1), metadata()); !errors.Is(err, ErrInvalidProjection) {
		t.Fatalf("finalized boundary err=%v", err)
	}
}

func TestIndexRollbackRebuildAndFinalizedBoundary(t *testing.T) {
	index := NewIndex()
	head := build(t, 120, searchresult.FinalityHead, 1)
	if err := index.Apply(Event{Action: ActionUpsert, Result: head}); err != nil {
		t.Fatal(err)
	}
	if _, ok := index.Get(head.ID); !ok {
		t.Fatal("missing head projection")
	}
	if err := index.Rollback(110); err != nil {
		t.Fatal(err)
	}
	if _, ok := index.Get(head.ID); ok {
		t.Fatal("reorg failed to remove non-finalized projection")
	}

	finalized := build(t, 100, searchresult.FinalityFinalized, 2)
	if err := index.Apply(Event{Action: ActionUpsert, Result: finalized}); err != nil {
		t.Fatal(err)
	}
	if index.FinalizedHeight() != 100 {
		t.Fatalf("finalized=%d", index.FinalizedHeight())
	}
	if err := index.Rollback(99); !errors.Is(err, ErrFinalizedConflict) {
		t.Fatalf("rollback err=%v", err)
	}

	replacement := finalized
	block := uint64(99)
	replacement.Provenance.BlockNumber = &block
	replacement.Provenance.BlockHash = "0xother"
	if err := index.Apply(Event{Action: ActionUpsert, Result: replacement}); !errors.Is(err, ErrFinalizedConflict) {
		t.Fatalf("rewrite err=%v", err)
	}

	newer := build(t, 110, searchresult.FinalitySafe, 3)
	if err := index.Rebuild([]Event{
		{Action: ActionUpsert, Result: finalized},
		{Action: ActionUpsert, Result: newer},
	}); err != nil {
		t.Fatal(err)
	}
	if got := index.All(); len(got) != 1 || got[0].ID != newer.ID {
		t.Fatalf("rebuilt=%+v", got)
	}
}

func TestRebuildRejectsDuplicateCanonicalLog(t *testing.T) {
	index := NewIndex()
	a := buildAsset(t, "media-a", 100, searchresult.FinalityFinalized, 7)
	b := buildAsset(t, "media-b", 100, searchresult.FinalityFinalized, 7)
	if err := index.Rebuild([]Event{
		{Action: ActionUpsert, Result: a},
		{Action: ActionUpsert, Result: b},
	}); !errors.Is(err, ErrRebuildOrder) {
		t.Fatalf("duplicate log err=%v", err)
	}
}

func TestNotificationsAreOptInDeduplicatedFinalityAwareAndRetractable(t *testing.T) {
	n := NewNotifications()
	n.now = func() time.Time { return time.Unix(2_000_000_100, 0) }
	if err := n.Subscribe(Subscription{
		UserRef: "user-1", Topic: "media.published", Channel: "wallet",
		MinimumSeverity: SeverityInfo, MinimumFinality: searchresult.FinalitySafe,
	}); err != nil {
		t.Fatal(err)
	}
	head := build(t, 120, searchresult.FinalityHead, 1)
	if _, err := n.Notify(head, "media.published", SeverityInfo, false); !errors.Is(err, ErrNotSubscribed) {
		t.Fatalf("head notification err=%v", err)
	}
	safe := build(t, 110, searchresult.FinalitySafe, 2)
	first, err := n.Notify(safe, "media.published", SeverityInfo, false)
	if err != nil || len(first) != 1 {
		t.Fatalf("first=%+v err=%v", first, err)
	}
	second, err := n.Notify(safe, "media.published", SeverityInfo, false)
	if err != nil || len(second) != 0 {
		t.Fatalf("dedupe=%+v err=%v", second, err)
	}
	retracted := n.RetractBlock(safe.Provenance.BlockHash)
	if len(retracted) != 1 || !retracted[0].Retracted || retracted[0].SourceResultID != safe.ID {
		t.Fatalf("retracted=%+v", retracted)
	}
	if again := n.RetractBlock(safe.Provenance.BlockHash); len(again) != 0 {
		t.Fatalf("retraction replay=%+v", again)
	}
}

func TestPromotionalNotificationsRequireSeparateOptInAndUnsubscribeIsReversible(t *testing.T) {
	n := NewNotifications()
	if err := n.Subscribe(Subscription{
		UserRef: "user-1", Topic: "media.promo", Channel: "email",
		MinimumSeverity: SeverityInfo, MinimumFinality: searchresult.FinalityFinalized,
		PromotionalOptIn: false,
	}); err != nil {
		t.Fatal(err)
	}
	finalized := build(t, 100, searchresult.FinalityFinalized, 5)
	if _, err := n.Notify(finalized, "media.promo", SeverityInfo, true); !errors.Is(err, ErrNotSubscribed) {
		t.Fatalf("promo err=%v", err)
	}
	if err := n.Subscribe(Subscription{
		UserRef: "user-1", Topic: "media.promo", Channel: "email",
		MinimumSeverity: SeverityInfo, MinimumFinality: searchresult.FinalityFinalized,
		PromotionalOptIn: true,
	}); err != nil {
		t.Fatal(err)
	}
	if got, err := n.Notify(finalized, "media.promo", SeverityInfo, true); err != nil || len(got) != 1 {
		t.Fatalf("promo got=%+v err=%v", got, err)
	}
	n.Unsubscribe("user-1", "media.promo", "email")
	other := finalized
	other.Provenance.TransactionHash = "0xtx2"
	other.Provenance.LogIndex = func() *uint64 { v := uint64(6); return &v }()
	if _, err := n.Notify(other, "media.promo", SeverityInfo, true); !errors.Is(err, ErrNotSubscribed) {
		t.Fatalf("unsubscribe err=%v", err)
	}
}

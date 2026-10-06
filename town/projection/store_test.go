package projection

import (
	"errors"
	"testing"
	"time"

	"github.com/420integrated/420-integrated/town/model"
)

func post(id, community string, visibility model.Visibility, revision uint64) PostDocument {
	return PostDocument{
		ID:            model.ObjectID(id),
		CommunityID:   model.ObjectID(community),
		AuthorID:      "actor:alice",
		Visibility:    visibility,
		ContentRef:    "storage420://object/" + id,
		ContentSHA256: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
		Revision:      revision,
		UpdatedAt:     time.Unix(int64(revision), 0).UTC(),
	}
}

func TestProjectionAppliesBlocksAndPaginatesPublicPosts(t *testing.T) {
	s := NewStore()
	if err := s.ApplyBlock(Block{Height: 1, Hash: "h1", Events: []Event{
		{ID: "e1", Kind: EventPostUpsert, Post: post("post:1", "community:1", model.VisibilityPublic, 1)},
		{ID: "e2", Kind: EventPostUpsert, Post: post("post:2", "community:1", model.VisibilityCommunityOnly, 1)},
		{ID: "e3", Kind: EventPostUpsert, Post: post("post:3", "community:1", model.VisibilityPublic, 1)},
	}}); err != nil {
		t.Fatal(err)
	}

	page, err := s.ListPublicPosts("community:1", "", 1)
	if err != nil {
		t.Fatal(err)
	}
	if len(page.Items) != 1 || page.Items[0].ID != "post:1" || page.NextCursor == "" {
		t.Fatalf("page=%+v", page)
	}

	page2, err := s.ListPublicPosts("community:1", page.NextCursor, 10)
	if err != nil {
		t.Fatal(err)
	}
	if len(page2.Items) != 1 || page2.Items[0].ID != "post:3" {
		t.Fatalf("page2=%+v", page2)
	}
}

func TestReorgRebuildsDerivedStateAndInvalidatesCursor(t *testing.T) {
	s := NewStore()
	if err := s.ApplyBlock(Block{Height: 1, Hash: "h1", Events: []Event{
		{ID: "e1", Kind: EventPostUpsert, Post: post("post:1", "community:1", model.VisibilityPublic, 1)},
	}}); err != nil {
		t.Fatal(err)
	}
	if err := s.ApplyBlock(Block{Height: 2, Hash: "h2", ParentHash: "h1", Events: []Event{
		{ID: "e2", Kind: EventPostUpsert, Post: post("post:2", "community:1", model.VisibilityPublic, 1)},
	}}); err != nil {
		t.Fatal(err)
	}

	page, err := s.ListPublicPosts("community:1", "", 1)
	if err != nil {
		t.Fatal(err)
	}
	oldCursor := page.NextCursor
	if oldCursor == "" {
		t.Fatal("expected cursor")
	}

	if err := s.ApplyBlock(Block{Height: 2, Hash: "h2b", ParentHash: "h1", Events: []Event{
		{ID: "e2b", Kind: EventPostUpsert, Post: post("post:3", "community:1", model.VisibilityPublic, 1)},
	}}); err != nil {
		t.Fatal(err)
	}
	if _, ok := s.GetPost("post:2"); ok {
		t.Fatal("orphaned post survived reorg")
	}
	if _, ok := s.GetPost("post:3"); !ok {
		t.Fatal("replacement post missing")
	}
	if _, err := s.ListPublicPosts("community:1", oldCursor, 10); !errors.Is(err, ErrStaleCursor) {
		t.Fatalf("got %v", err)
	}
}

func TestRecoveryRoundTripAndRejectsBrokenChain(t *testing.T) {
	s := NewStore()
	if err := s.ApplyBlock(Block{Height: 1, Hash: "h1", Events: []Event{
		{ID: "e1", Kind: EventPostUpsert, Post: post("post:1", "community:1", model.VisibilityPublic, 1)},
	}}); err != nil {
		t.Fatal(err)
	}
	if err := s.ApplyBlock(Block{Height: 2, Hash: "h2", ParentHash: "h1", Events: []Event{
		{ID: "e2", Kind: EventPostTombstone, Post: post("post:1", "community:1", model.VisibilityPublic, 2)},
	}}); err != nil {
		t.Fatal(err)
	}

	state := s.SnapshotRecovery()
	restored := NewStore()
	if err := restored.RestoreRecovery(state); err != nil {
		t.Fatal(err)
	}
	p, ok := restored.GetPost("post:1")
	if !ok || p.Active || p.ContentRef != "" {
		t.Fatalf("restored=%+v", p)
	}

	bad := state
	bad.Blocks[1].ParentHash = "wrong"
	if err := restored.RestoreRecovery(bad); !errors.Is(err, ErrInvalidRecovery) {
		t.Fatalf("got %v", err)
	}
}

func TestProjectionRejectsGapDuplicateEventAndBadParent(t *testing.T) {
	s := NewStore()
	if err := s.ApplyBlock(Block{Height: 2, Hash: "h2"}); !errors.Is(err, ErrChainGap) {
		t.Fatalf("gap got %v", err)
	}
	if err := s.ApplyBlock(Block{Height: 1, Hash: "h1", Events: []Event{
		{ID: "e1", Kind: EventPostUpsert, Post: post("post:1", "community:1", model.VisibilityPublic, 1)},
	}}); err != nil {
		t.Fatal(err)
	}
	if err := s.ApplyBlock(Block{Height: 2, Hash: "h2", ParentHash: "wrong"}); !errors.Is(err, ErrParentMismatch) {
		t.Fatalf("parent got %v", err)
	}
	if err := s.ApplyBlock(Block{Height: 2, Hash: "h2", ParentHash: "h1", Events: []Event{
		{ID: "e1", Kind: EventPostUpsert, Post: post("post:2", "community:1", model.VisibilityPublic, 1)},
	}}); !errors.Is(err, ErrInvalidEvent) {
		t.Fatalf("duplicate got %v", err)
	}
}

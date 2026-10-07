package reeferreview

import (
	"context"
	"errors"
	"testing"
)

func TestRR3InitialAndEditedRevisionHistory(t *testing.T) {
	s := testService()
	ctx := context.Background()
	p, err := s.CreateDraft(ctx, "writer.420", CreateDraftRequest{
		IdempotencyKey: "rr3-revision",
		Title: "First title",
		Summary: "first summary",
		Body: "first body",
		Visibility: VisibilityPrivate,
	})
	if err != nil {
		t.Fatal(err)
	}
	if p.Revision != 1 || p.CurrentRevisionID == "" {
		t.Fatalf("missing initial revision: %+v", p)
	}
	updated, warnings, err := s.Update(ctx, "writer.420", p.ID, UpdatePublicationRequest{
		Title: "Second title",
		Summary: "second summary",
		Body: "second body",
		Visibility: VisibilityPublic,
	})
	if err != nil || len(warnings) != 0 {
		t.Fatalf("draft edit failed: %v %v", err, warnings)
	}
	if updated.Revision != 2 || updated.Title != "Second title" || updated.BodyDigest == p.BodyDigest {
		t.Fatalf("revision did not advance: %+v", updated)
	}
	revisions, err := s.ListRevisions(ctx, "writer.420", p.ID)
	if err != nil {
		t.Fatal(err)
	}
	if len(revisions) != 2 || revisions[0].Number != 2 || revisions[1].Number != 1 {
		t.Fatalf("bad revision history: %+v", revisions)
	}
	_, body, err := s.GetForActor(ctx, "writer.420", p.ID)
	if err != nil || string(body) != "second body" {
		t.Fatalf("current body mismatch: %q %v", body, err)
	}
}

func TestRR3PublishedEditRequiresNewRightsClaim(t *testing.T) {
	s := testService()
	ctx := context.Background()
	p, err := s.CreateDraft(ctx, "writer.420", CreateDraftRequest{
		IdempotencyKey: "rr3-published-edit", Title: "Original", Body: "one", Visibility: VisibilityPublic,
	})
	if err != nil {
		t.Fatal(err)
	}
	p, _, err = s.Publish(ctx, "writer.420", p.ID)
	if err != nil {
		t.Fatal(err)
	}
	oldClaim := p.RightsClaim
	p, _, err = s.Update(ctx, "writer.420", p.ID, UpdatePublicationRequest{
		Title: "Updated", Body: "two", Visibility: VisibilityPublic,
	})
	if err != nil {
		t.Fatal(err)
	}
	if p.Revision != 2 || p.RightsClaim == "" || p.RightsClaim == oldClaim {
		t.Fatalf("published edit missing new rights provenance: %+v", p)
	}
	revisions, err := s.ListRevisions(ctx, "writer.420", p.ID)
	if err != nil || len(revisions) != 2 || revisions[0].RightsClaim != p.RightsClaim || revisions[1].RightsClaim != oldClaim {
		t.Fatalf("revision rights history mismatch: %+v %v", revisions, err)
	}
}

func TestRR3UnauthorizedEditRejected(t *testing.T) {
	s := testService()
	ctx := context.Background()
	p, _ := s.CreateDraft(ctx, "writer.420", CreateDraftRequest{
		IdempotencyKey: "rr3-edit-auth", Title: "A", Body: "b", Visibility: VisibilityPrivate,
	})
	_, _, err := s.Update(ctx, "other.420", p.ID, UpdatePublicationRequest{
		Title: "Hijack", Body: "evil", Visibility: VisibilityPublic,
	})
	if !errors.Is(err, ErrUnauthorized) {
		t.Fatalf("want unauthorized, got %v", err)
	}
}

func TestRR3RestrictedReadsFailClosedAndOwnerCanRead(t *testing.T) {
	s := testService()
	ctx := context.Background()
	p, _ := s.CreateDraft(ctx, "writer.420", CreateDraftRequest{
		IdempotencyKey: "rr3-private", Title: "Private", Body: "secret", Visibility: VisibilityPrivate,
	})
	p, _, _ = s.Publish(ctx, "writer.420", p.ID)

	if _, _, err := s.GetForActor(ctx, "", p.ID); !errors.Is(err, ErrNotFound) {
		t.Fatalf("anonymous private read should be not found, got %v", err)
	}
	if _, _, err := s.GetForActor(ctx, "other.420", p.ID); !errors.Is(err, ErrNotFound) {
		t.Fatalf("unprivileged private read should be not found, got %v", err)
	}
	got, body, err := s.GetForActor(ctx, "writer.420", p.ID)
	if err != nil || got.ID != p.ID || string(body) != "secret" {
		t.Fatalf("owner private read failed: %+v %q %v", got, body, err)
	}

	u, _ := s.CreateDraft(ctx, "writer.420", CreateDraftRequest{
		IdempotencyKey: "rr3-unlisted", Title: "Unlisted", Body: "link-only", Visibility: VisibilityUnlisted,
	})
	u, _, _ = s.Publish(ctx, "writer.420", u.ID)
	if _, body, err := s.GetForActor(ctx, "", u.ID); err != nil || string(body) != "link-only" {
		t.Fatalf("unlisted link read failed: %q %v", body, err)
	}
}

func TestRR3TombstoneLifecycleAndAudit(t *testing.T) {
	s := testService()
	ctx := context.Background()
	p, _ := s.CreateDraft(ctx, "writer.420", CreateDraftRequest{
		IdempotencyKey: "rr3-tombstone", Title: "Remove me", Body: "body", Visibility: VisibilityPublic,
	})
	p, _, _ = s.Publish(ctx, "writer.420", p.ID)
	tomb, event, err := s.Tombstone(ctx, "writer.420", p.ID, "author withdrawal")
	if err != nil {
		t.Fatal(err)
	}
	if tomb.Status != StatusTombstoned || event.Action != "TOMBSTONE" || event.Reason != "author withdrawal" {
		t.Fatalf("bad tombstone: %+v %+v", tomb, event)
	}
	if _, _, err := s.GetForActor(ctx, "", p.ID); !errors.Is(err, ErrNotFound) {
		t.Fatalf("tombstone leaked publicly: %v", err)
	}
	_, _, err = s.Update(ctx, "writer.420", p.ID, UpdatePublicationRequest{
		Title: "Return", Body: "body", Visibility: VisibilityPublic,
	})
	if !errors.Is(err, ErrConflict) {
		t.Fatalf("tombstoned edit should conflict: %v", err)
	}
	history, err := s.ListModerationHistory(ctx, "writer.420", p.ID)
	if err != nil || len(history) != 1 || history[0].ID == "" {
		t.Fatalf("missing tombstone audit: %+v %v", history, err)
	}
}

func TestRR3ModerationHistoryPersistsReason(t *testing.T) {
	s := testService()
	ctx := context.Background()
	p, _ := s.CreateDraft(ctx, "writer.420", CreateDraftRequest{
		IdempotencyKey: "rr3-mod", Title: "Moderate", Body: "body", Visibility: VisibilityPublic,
	})
	p, _, _ = s.Publish(ctx, "writer.420", p.ID)
	hidden, hide, err := s.Moderate(ctx, "moderator.420", p.ID, "HIDE", "rule 1")
	if err != nil || hidden.Status != StatusHidden {
		t.Fatalf("hide failed: %+v %v", hidden, err)
	}
	_, restore, err := s.Moderate(ctx, "moderator.420", p.ID, "RESTORE", "appeal accepted")
	if err != nil {
		t.Fatal(err)
	}
	history, err := s.ListModerationHistory(ctx, "moderator.420", p.ID)
	if err != nil || len(history) != 2 {
		t.Fatalf("bad moderation history: %+v %v", history, err)
	}
	if history[0].ID != restore.ID || history[0].Reason != "appeal accepted" || history[1].ID != hide.ID {
		t.Fatalf("moderation ordering/reason mismatch: %+v", history)
	}
}

func TestRR3EditorialListingScopedToAuthorOrModerator(t *testing.T) {
	s := testService()
	ctx := context.Background()
	_, _ = s.CreateDraft(ctx, "writer.420", CreateDraftRequest{IdempotencyKey: "mine", Title: "Mine", Body: "body", Visibility: VisibilityPrivate})
	_, _ = s.CreateDraft(ctx, "other.420", CreateDraftRequest{IdempotencyKey: "other", Title: "Other", Body: "body", Visibility: VisibilityPrivate})

	rows, total, err := s.ListEditorial(ctx, "writer.420", 0, 20)
	if err != nil || total != 1 || len(rows) != 1 || rows[0].Author != "writer.420" {
		t.Fatalf("author listing leaked: %+v %d %v", rows, total, err)
	}
	rows, total, err = s.ListEditorial(ctx, "moderator.420", 0, 20)
	if err != nil || total != 2 || len(rows) != 2 {
		t.Fatalf("moderator listing incomplete: %+v %d %v", rows, total, err)
	}
}

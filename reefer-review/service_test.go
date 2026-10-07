package reeferreview

import (
	"context"
	"errors"
	"testing"
	"time"
)

type failSearch struct{}

func (failSearch) Upsert(context.Context, Publication) error { return errors.New("down") }
func (failSearch) Delete(context.Context, string) error      { return nil }

func testService() Service {
	m := NewMemory()
	return Service{Identity: AllowIdentity{}, Auth: DevAuthorizer{}, Rights: DevRights{}, Blobs: MemoryBlob{M: m}, Store: m, Search: NoopSearch{}, Notifications: NoopNotifications{}, Mail: NoopMail{}, Now: func() time.Time { return time.Date(2026, 10, 7, 6, 0, 0, 0, time.UTC) }}
}
func TestDraftPublishAndBodyOffChain(t *testing.T) {
	s := testService()
	ctx := context.Background()
	p, err := s.CreateDraft(ctx, "writer.420", CreateDraftRequest{IdempotencyKey: "a", Title: "First", Body: "body", Visibility: VisibilityPublic})
	if err != nil {
		t.Fatal(err)
	}
	if p.Status != StatusDraft || p.BodyRef == "" || p.BodyDigest == "" {
		t.Fatalf("bad draft: %+v", p)
	}
	pub, warns, err := s.Publish(ctx, "writer.420", p.ID)
	if err != nil {
		t.Fatal(err)
	}
	if len(warns) != 0 || pub.Status != StatusPublished || pub.RightsClaim == "" {
		t.Fatalf("bad publish %+v %v", pub, warns)
	}
	got, body, err := s.Get(ctx, p.ID)
	if err != nil || string(body) != "body" || got.BodyRef == "" {
		t.Fatalf("bad body retrieval")
	}
}
func TestIdempotencyConflict(t *testing.T) {
	s := testService()
	ctx := context.Background()
	_, err := s.CreateDraft(ctx, "writer.420", CreateDraftRequest{IdempotencyKey: "same", Title: "A", Body: "one", Visibility: VisibilityPrivate})
	if err != nil {
		t.Fatal(err)
	}
	_, err = s.CreateDraft(ctx, "writer.420", CreateDraftRequest{IdempotencyKey: "same", Title: "A", Body: "two", Visibility: VisibilityPrivate})
	if !errors.Is(err, ErrConflict) {
		t.Fatalf("want conflict got %v", err)
	}
}
func TestPublishAuthorization(t *testing.T) {
	s := testService()
	ctx := context.Background()
	p, _ := s.CreateDraft(ctx, "writer.420", CreateDraftRequest{IdempotencyKey: "x", Title: "A", Body: "b", Visibility: VisibilityPublic})
	_, _, err := s.Publish(ctx, "other.420", p.ID)
	if !errors.Is(err, ErrUnauthorized) {
		t.Fatalf("want unauthorized got %v", err)
	}
}
func TestSearchFailureDoesNotRollbackPublication(t *testing.T) {
	s := testService()
	s.Search = failSearch{}
	ctx := context.Background()
	p, _ := s.CreateDraft(ctx, "writer.420", CreateDraftRequest{IdempotencyKey: "z", Title: "A", Body: "b", Visibility: VisibilityPublic})
	pub, warns, err := s.Publish(ctx, "writer.420", p.ID)
	if err != nil || pub.Status != StatusPublished || len(warns) != 1 {
		t.Fatalf("bad result %v %+v %v", err, pub, warns)
	}
}
func TestModerationScope(t *testing.T) {
	s := testService()
	ctx := context.Background()
	p, _ := s.CreateDraft(ctx, "writer.420", CreateDraftRequest{IdempotencyKey: "m", Title: "A", Body: "b", Visibility: VisibilityPublic})
	p, _, _ = s.Publish(ctx, "writer.420", p.ID)
	_, err := s.Moderate(ctx, "writer.420", p.ID, "HIDE")
	if !errors.Is(err, ErrUnauthorized) {
		t.Fatalf("want unauthorized")
	}
	hidden, err := s.Moderate(ctx, "moderator.420", p.ID, "HIDE")
	if err != nil || hidden.Status != StatusHidden {
		t.Fatalf("hide failed")
	}
}

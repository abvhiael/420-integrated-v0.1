package repository

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/420integrated/420-integrated/reputation/model"
)

func sampleReview() model.Review {
	now := time.Date(2026, 9, 18, 2, 0, 0, 0, time.UTC)
	return model.Review{
		ID:      "review-1",
		Domain:  model.DomainClassifieds,
		Subject: model.SubjectRef{Type: "PROFILE", ID: "seller-1"},
		Author:  model.SubjectRef{Type: "PROFILE", ID: "buyer-1"},
		Rating:  5,
		BodyRef: "storage://review-body-1",
		AttachmentRefs: []string{
			"storage://photo-1",
		},
		Verification:           model.VerificationUnverified,
		Status:                 model.ReviewActive,
		Version:                1,
		CreatedAt:              now,
		UpdatedAt:              now,
	}
}

func TestFileStorePersistsAcrossReopen(t *testing.T) {
	path := filepath.Join(t.TempDir(), "reviews.json")
	store, err := OpenFileStore(path)
	if err != nil {
		t.Fatal(err)
	}
	if err := store.Ready(context.Background()); err != nil {
		t.Fatal(err)
	}
	if _, err := store.Create(sampleReview()); err != nil {
		t.Fatal(err)
	}

	reopened, err := OpenFileStore(path)
	if err != nil {
		t.Fatal(err)
	}
	got, err := reopened.Get("review-1")
	if err != nil {
		t.Fatal(err)
	}
	if got.Rating != 5 || got.BodyRef != "storage://review-body-1" || reopened.Count() != 1 {
		t.Fatalf("unexpected persisted review: %+v count=%d", got, reopened.Count())
	}
}

func TestFileStoreRejectsDuplicateAndVersionConflict(t *testing.T) {
	store, err := OpenFileStore(filepath.Join(t.TempDir(), "reviews.json"))
	if err != nil {
		t.Fatal(err)
	}
	review := sampleReview()
	if _, err := store.Create(review); err != nil {
		t.Fatal(err)
	}
	if _, err := store.Create(review); !errors.Is(err, ErrExists) {
		t.Fatalf("expected ErrExists, got %v", err)
	}

	review.Rating = 4
	review.Version = 2
	review.UpdatedAt = review.UpdatedAt.Add(time.Minute)
	if _, err := store.Update(review, 0); !errors.Is(err, ErrVersion) {
		t.Fatalf("expected version conflict, got %v", err)
	}
	updated, err := store.Update(review, 1)
	if err != nil {
		t.Fatal(err)
	}
	if updated.Version != 2 || updated.Rating != 4 {
		t.Fatalf("unexpected update: %+v", updated)
	}
}

func TestFileStoreRollsBackFailedPersist(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "reviews.json")
	store, err := OpenFileStore(path)
	if err != nil {
		t.Fatal(err)
	}
	if err := os.Chmod(dir, 0o500); err != nil {
		t.Fatal(err)
	}
	defer os.Chmod(dir, 0o700)

	_, err = store.Create(sampleReview())
	if err == nil {
		t.Skip("filesystem permits writes despite directory mode; rollback path cannot be forced on this platform")
	}
	if store.Count() != 0 {
		t.Fatal("failed create must not remain in memory")
	}
}

func TestListBySubjectIsDomainScopedAndReturnsClones(t *testing.T) {
	store, err := OpenFileStore(filepath.Join(t.TempDir(), "reviews.json"))
	if err != nil {
		t.Fatal(err)
	}
	first := sampleReview()
	if _, err := store.Create(first); err != nil {
		t.Fatal(err)
	}
	second := first
	second.ID = "review-2"
	second.Domain = model.DomainTravel
	second.Subject = model.SubjectRef{Type: "PLACE", ID: "place-1"}
	second.Author = model.SubjectRef{Type: "PROFILE", ID: "traveller-1"}
	if _, err := store.Create(second); err != nil {
		t.Fatal(err)
	}

	got := store.ListBySubject(model.DomainClassifieds, first.Subject)
	if len(got) != 1 || got[0].ID != "review-1" {
		t.Fatalf("unexpected scoped list: %+v", got)
	}
	got[0].AttachmentRefs[0] = "mutated"
	again, err := store.Get("review-1")
	if err != nil {
		t.Fatal(err)
	}
	if again.AttachmentRefs[0] == "mutated" {
		t.Fatal("repository returned mutable internal slice")
	}
}

func TestOpenRejectsCorruptOrUnsupportedSnapshot(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "reviews.json")
	if err := os.WriteFile(path, []byte("{not-json"), 0o600); err != nil {
		t.Fatal(err)
	}
	if _, err := OpenFileStore(path); err == nil {
		t.Fatal("expected corrupt snapshot rejection")
	}

	if err := os.WriteFile(path, []byte(`{"schema":"future","reviews":[]}`), 0o600); err != nil {
		t.Fatal(err)
	}
	if _, err := OpenFileStore(path); err == nil {
		t.Fatal("expected unsupported schema rejection")
	}
}


func TestResponsePersistsAndVersions(t *testing.T) {
	path := filepath.Join(t.TempDir(), "reviews.json")
	store, err := OpenFileStore(path)
	if err != nil { t.Fatal(err) }
	if _, err := store.Create(sampleReview()); err != nil { t.Fatal(err) }
	now := time.Date(2026, 9, 18, 4, 0, 0, 0, time.UTC)
	response := model.Response{
		ReviewID:"review-1",
		Subject:model.SubjectRef{Type:"PROFILE", ID:"seller-1"},
		Actor:model.SubjectRef{Type:"PROFILE", ID:"seller-1"},
		BodyRef:"storage://response-1",
		Version:1, CreatedAt:now, UpdatedAt:now,
	}
	if _, err := store.CreateResponse(response); err != nil { t.Fatal(err) }
	if _, err := store.CreateResponse(response); !errors.Is(err, ErrExists) { t.Fatalf("expected one response per review, got %v", err) }
	response.BodyRef = "storage://response-2"
	response.Version = 2
	response.UpdatedAt = now.Add(time.Minute)
	if _, err := store.UpdateResponse(response, 1); err != nil { t.Fatal(err) }
	reopened, err := OpenFileStore(path)
	if err != nil { t.Fatal(err) }
	got, err := reopened.GetResponse("review-1")
	if err != nil { t.Fatal(err) }
	if got.Version != 2 || got.BodyRef != "storage://response-2" { t.Fatalf("unexpected response: %+v", got) }
}


func TestModerationAuditPersists(t *testing.T) {
	path := filepath.Join(t.TempDir(), "reviews.json")
	store, err := OpenFileStore(path)
	if err != nil { t.Fatal(err) }
	if _, err := store.Create(sampleReview()); err != nil { t.Fatal(err) }
	now := time.Date(2026, 9, 18, 5, 0, 0, 0, time.UTC)
	record := model.ModerationRecord{
		ID:"mod-1", ReviewID:"review-1", Action:model.ModerationReport, Reason:model.ReasonSpam,
		Actor:model.SubjectRef{Type:"PROFILE", ID:"reporter-1"}, PreviousState:model.ReviewActive,
		ResultState:model.ReviewActive, State:model.ModerationOpen, Version:1, CreatedAt:now,
	}
	if _, err := store.CreateModeration(record); err != nil { t.Fatal(err) }
	if _, err := store.CreateModeration(record); !errors.Is(err, ErrExists) { t.Fatalf("expected duplicate moderation rejection, got %v", err) }
	reopened, err := OpenFileStore(path)
	if err != nil { t.Fatal(err) }
	got := reopened.ListModeration("review-1")
	if len(got) != 1 || got[0].ID != "mod-1" { t.Fatalf("unexpected moderation audit: %+v", got) }
}


func TestAntiSybilRepositoryQueries(t *testing.T) {
	path := filepath.Join(t.TempDir(), "reviews.json")
	store, err := OpenFileStore(path)
	if err != nil { t.Fatal(err) }
	review := sampleReview()
	review.Verification = model.VerificationVerified
	review.InteractionKind = "P2P_TRANSACTION"
	review.VerifiedInteractionRef = "evidence-unique-1"
	review.VerificationIssuerID = "420Pay"
	review.VerifiedOccurredAt = review.CreatedAt.Add(-time.Hour)
	if _, err := store.Create(review); err != nil { t.Fatal(err) }

	got, ok := store.FindByVerifiedInteraction("evidence-unique-1")
	if !ok || got.ID != review.ID { t.Fatalf("evidence lookup failed: ok=%v review=%+v",ok,got) }
	if _, ok := store.FindByVerifiedInteraction("missing"); ok { t.Fatal("unexpected evidence match") }

	if n := store.CountByAuthorSince(review.Author, review.CreatedAt.Add(-time.Minute)); n != 1 {
		t.Fatalf("author count=%d want=1",n)
	}
	if n := store.CountByAuthorSince(review.Author, review.CreatedAt.Add(time.Minute)); n != 0 {
		t.Fatalf("future author count=%d want=0",n)
	}
}

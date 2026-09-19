package interactions

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/420integrated/420-integrated/reputation/model"
)

type fakeRecords struct {
	record Record
	err    error
}

func (f fakeRecords) Lookup(context.Context, string) (Record, error) {
	return f.record, f.err
}

func testRecord(kind Kind) Record {
	return Record{
		Kind: kind,
		EvidenceRef: "evidence-1",
		IssuerID: "420/service/pay/v1",
		Reviewer: "buyer-1",
		ReviewerType: "PROFILE",
		Subject: "seller-1",
		SubjectType: "PROFILE",
		OccurredAtUnix: time.Date(2026, 9, 18, 2, 30, 0, 0, time.UTC).Unix(),
		Final: true,
	}
}

func adapterFor(t *testing.T, kind Kind, record Record) *Adapter {
	t.Helper()
	adapter, err := NewAdapter("420Pay", kind, fakeRecords{record: record})
	if err != nil { t.Fatal(err) }
	return adapter
}

func TestVerifierAcceptsMatchingFinalEvidence(t *testing.T) {
	source := adapterFor(t, KindP2PTransaction, testRecord(KindP2PTransaction))
	verifier, err := NewVerifier(map[Kind]Source{KindP2PTransaction: source})
	if err != nil { t.Fatal(err) }

	got, err := verifier.Verify(
		context.Background(),
		model.DomainClassifieds,
		KindP2PTransaction,
		"evidence-1",
		model.SubjectRef{Type: "PROFILE", ID: "buyer-1"},
		model.SubjectRef{Type: "PROFILE", ID: "seller-1"},
	)
	if err != nil { t.Fatal(err) }
	if got.Source != "420Pay" || !got.Final || got.IssuerID == "" {
		t.Fatalf("unexpected evidence: %+v", got)
	}
}

func TestVerifierRejectsCrossDomainKind(t *testing.T) {
	source := adapterFor(t, KindCourseCompletion, testRecord(KindCourseCompletion))
	verifier, err := NewVerifier(map[Kind]Source{KindCourseCompletion: source})
	if err != nil { t.Fatal(err) }
	_, err = verifier.Verify(
		context.Background(),
		model.DomainClassifieds,
		KindCourseCompletion,
		"evidence-1",
		model.SubjectRef{Type: "PROFILE", ID: "buyer-1"},
		model.SubjectRef{Type: "PROFILE", ID: "seller-1"},
	)
	if err == nil {
		t.Fatal("expected domain/kind mismatch rejection")
	}
}

func TestVerifierRejectsParticipantMismatch(t *testing.T) {
	source := adapterFor(t, KindContribution, testRecord(KindContribution))
	verifier, err := NewVerifier(map[Kind]Source{KindContribution: source})
	if err != nil { t.Fatal(err) }
	_, err = verifier.Verify(
		context.Background(),
		model.DomainCrowdfunding,
		KindContribution,
		"evidence-1",
		model.SubjectRef{Type: "PROFILE", ID: "other"},
		model.SubjectRef{Type: "PROFILE", ID: "seller-1"},
	)
	if err == nil {
		t.Fatal("expected participant mismatch rejection")
	}
}

func TestAdapterRejectsNonFinalEvidence(t *testing.T) {
	record := testRecord(KindBooking)
	record.Final = false
	adapter := adapterFor(t, KindBooking, record)
	if _, err := adapter.Verify(context.Background(), "evidence-1"); err == nil {
		t.Fatal("expected non-final evidence rejection")
	}
}

func TestAdapterRejectsSourceMismatch(t *testing.T) {
	record := testRecord(KindEnrollment)
	record.EvidenceRef = "different"
	adapter := adapterFor(t, KindEnrollment, record)
	if _, err := adapter.Verify(context.Background(), "evidence-1"); err == nil {
		t.Fatal("expected evidence source mismatch rejection")
	}
}

func TestVerifierPropagatesSourceFailure(t *testing.T) {
	want := errors.New("source unavailable")
	adapter, err := NewAdapter("420Travel", KindStay, fakeRecords{err: want})
	if err != nil { t.Fatal(err) }
	verifier, err := NewVerifier(map[Kind]Source{KindStay: adapter})
	if err != nil { t.Fatal(err) }
	_, err = verifier.Verify(
		context.Background(),
		model.DomainTravel,
		KindStay,
		"evidence-1",
		model.SubjectRef{Type: "PROFILE", ID: "buyer-1"},
		model.SubjectRef{Type: "PROFILE", ID: "seller-1"},
	)
	if !errors.Is(err, want) {
		t.Fatalf("expected source failure, got %v", err)
	}
}

func TestEveryGenesisDomainHasKinds(t *testing.T) {
	for _, domain := range model.GenesisDomains {
		if len(genesisDomainKinds()[domain]) == 0 {
			t.Fatalf("domain %s has no verified interaction kinds", domain)
		}
	}
}

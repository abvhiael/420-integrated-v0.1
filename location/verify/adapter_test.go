package verify

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/420integrated/420-integrated/location/model"
)

type fakeReader struct {
	evidence Evidence
	err      error
	reads    int
	askedID  string
}

func (f *fakeReader) Ready(context.Context) error { return f.err }
func (f *fakeReader) LatestForPlace(_ context.Context, placeID string) (Evidence,error) {
	f.reads++
	f.askedID=placeID
	return f.evidence,f.err
}

func testPlace() model.Place {
	now:=time.Date(2026,9,19,4,0,0,0,time.UTC)
	lat,lon:=50.4452,-104.6189
	return model.Place{
		ID:"place-420",Name:"Verified Venue",Category:model.CategoryVenue,
		Visibility:model.VisibilityPublic,Precision:model.PrecisionExactPublic,
		Source:"420location",Owner:model.SubjectRef{Type:"ORGANIZATION",ID:"org-420"},
		OrganizationID:"org-420",RegistryRecordID:"registry-1",
		Country:"CA",Region:"SK",City:"Regina",Latitude:&lat,Longitude:&lon,
		Version:1,CreatedAt:now,UpdatedAt:now,
	}
}

func validEvidence() Evidence {
	return Evidence{
		RecordID:"verify-record-1",
		PlaceID:"place-420",
		Status:StatusVerified,
		VerifiedAt:time.Date(2026,9,19,4,5,0,0,time.UTC),
		Source:"420Verify",
		EvidenceURI:"ipfs://verification-evidence",
		EvidenceHash:"sha256:abc123",
		ObservedAt:time.Date(2026,9,19,4,6,0,0,time.UTC),
	}
}

func TestResolvePreservesCanonicalPlaceIdentityAndEvidenceProvenance(t *testing.T) {
	reader:=&fakeReader{evidence:validEvidence()}
	adapter,err:=New(reader)
	if err!=nil { t.Fatal(err) }
	p:=testPlace()
	got,err:=adapter.Resolve(context.Background(),p)
	if err!=nil { t.Fatal(err) }

	if reader.askedID!=p.ID || got.PlaceID!=p.ID { t.Fatalf("canonical place id mismatch: asked=%s got=%s",reader.askedID,got.PlaceID) }
	if got.RecordID!="verify-record-1" || got.Source!="420Verify" || got.EvidenceHash!="sha256:abc123" {
		t.Fatalf("provenance=%+v",got)
	}
	if got.Status!=StatusVerified || got.VerifiedAt.IsZero() { t.Fatalf("status=%+v",got) }
}

func TestVerificationCannotBecomeRatingEndorsementReputationSafetyOrAudit(t *testing.T) {
	reader:=&fakeReader{evidence:validEvidence()}
	adapter,_:=New(reader)
	got,err:=adapter.Resolve(context.Background(),testPlace())
	if err!=nil { t.Fatal(err) }
	if got.IsRating || got.IsEndorsement || got.IsReputation || got.IsSafetyClaim || got.IsAudit {
		t.Fatalf("verification evidence crossed semantic boundary: %+v",got)
	}
}

func TestResolveRejectsVerificationForDifferentPlace(t *testing.T) {
	e:=validEvidence()
	e.PlaceID="different-place"
	reader:=&fakeReader{evidence:e}
	adapter,_:=New(reader)
	_,err:=adapter.Resolve(context.Background(),testPlace())
	if !errors.Is(err,ErrSubjectMismatch) { t.Fatalf("err=%v",err) }
}

func TestVerifiedEvidenceRequiresVerifiedAt(t *testing.T) {
	e:=validEvidence()
	e.VerifiedAt=time.Time{}
	reader:=&fakeReader{evidence:e}
	adapter,_:=New(reader)
	_,err:=adapter.Resolve(context.Background(),testPlace())
	if !errors.Is(err,ErrInvalidEvidence) { t.Fatalf("err=%v",err) }
}

func TestEvidenceCannotClaimVerificationFromFutureObservation(t *testing.T) {
	e:=validEvidence()
	e.VerifiedAt=e.ObservedAt.Add(time.Minute)
	reader:=&fakeReader{evidence:e}
	adapter,_:=New(reader)
	_,err:=adapter.Resolve(context.Background(),testPlace())
	if !errors.Is(err,ErrInvalidEvidence) { t.Fatalf("err=%v",err) }
}

func TestReaderInterfaceIsReadOnly(t *testing.T) {
	// Compile-time boundary: Location receives readiness + evidence lookup only.
	// No Verify submission, mutation, publication, or scoring authority is exposed.
	var _ Reader = (*fakeReader)(nil)
}

func TestUnverifiedEvidenceRetainsSourceWithoutVerifiedTimestamp(t *testing.T) {
	e:=validEvidence()
	e.Status=StatusUnverified
	e.VerifiedAt=time.Time{}
	reader:=&fakeReader{evidence:e}
	adapter,_:=New(reader)
	got,err:=adapter.Resolve(context.Background(),testPlace())
	if err!=nil { t.Fatal(err) }
	if got.Status!=StatusUnverified || got.Source!="420Verify" || !got.VerifiedAt.IsZero() {
		t.Fatalf("projection=%+v",got)
	}
}

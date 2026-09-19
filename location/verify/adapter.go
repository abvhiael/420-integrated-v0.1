package verify

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/420integrated/420-integrated/location/model"
)

var (
	ErrVerificationNotFound = errors.New("verification evidence not found")
	ErrSubjectMismatch       = errors.New("verification subject does not match canonical place")
	ErrInvalidEvidence       = errors.New("verification evidence is invalid")
)

type Status string

const (
	StatusVerified     Status = "VERIFIED"
	StatusUnverified   Status = "UNVERIFIED"
	StatusIndeterminate Status = "INDETERMINATE"
)

func validStatus(status Status) bool {
	switch status {
	case StatusVerified, StatusUnverified, StatusIndeterminate:
		return true
	default:
		return false
	}
}

// Evidence is a provider/source-scoped observation. It is not a score,
// endorsement, audit, safety statement, Registry legitimacy claim, or reputation.
type Evidence struct {
	RecordID       string
	PlaceID        string
	Status         Status
	VerifiedAt     time.Time
	Source         string
	EvidenceURI    string
	EvidenceHash   string
	ObservedAt     time.Time
}

func (e Evidence) Validate() error {
	if strings.TrimSpace(e.RecordID) == "" ||
		strings.TrimSpace(e.PlaceID) == "" ||
		strings.TrimSpace(e.Source) == "" ||
		!validStatus(e.Status) {
		return ErrInvalidEvidence
	}
	if e.ObservedAt.IsZero() {
		return ErrInvalidEvidence
	}
	if e.Status == StatusVerified && e.VerifiedAt.IsZero() {
		return ErrInvalidEvidence
	}
	if !e.VerifiedAt.IsZero() && e.VerifiedAt.After(e.ObservedAt) {
		return ErrInvalidEvidence
	}
	return nil
}

type Reader interface {
	Ready(context.Context) error
	LatestForPlace(context.Context, string) (Evidence, error)
}

type Projection struct {
	PlaceID      string
	RecordID     string
	Status       Status
	VerifiedAt   time.Time
	Source       string
	EvidenceURI  string
	EvidenceHash string
	ObservedAt   time.Time

	// Explicit semantic guards for consumers/UI.
	IsRating      bool
	IsEndorsement bool
	IsReputation  bool
	IsSafetyClaim bool
	IsAudit       bool
}

type Adapter struct {
	reader Reader
}

func New(reader Reader) (*Adapter, error) {
	if reader == nil {
		return nil, errors.New("420Verify reader is required")
	}
	return &Adapter{reader: reader}, nil
}

func (a *Adapter) Ready(ctx context.Context) error {
	return a.reader.Ready(ctx)
}

// Resolve reads verification evidence for a canonical Location Place. The
// canonical Place is never mutated and 420Verify cannot create Location state.
func (a *Adapter) Resolve(ctx context.Context, place model.Place) (Projection, error) {
	if err := place.Validate(); err != nil {
		return Projection{}, err
	}
	evidence, err := a.reader.LatestForPlace(ctx, place.ID)
	if err != nil {
		return Projection{}, err
	}
	if err := evidence.Validate(); err != nil {
		return Projection{}, err
	}
	if !strings.EqualFold(strings.TrimSpace(evidence.PlaceID), strings.TrimSpace(place.ID)) {
		return Projection{}, ErrSubjectMismatch
	}
	return Projection{
		PlaceID:      place.ID,
		RecordID:     evidence.RecordID,
		Status:       evidence.Status,
		VerifiedAt:   evidence.VerifiedAt,
		Source:       evidence.Source,
		EvidenceURI:  evidence.EvidenceURI,
		EvidenceHash: evidence.EvidenceHash,
		ObservedAt:   evidence.ObservedAt,
		IsRating:      false,
		IsEndorsement: false,
		IsReputation:  false,
		IsSafetyClaim: false,
		IsAudit:       false,
	}, nil
}

package model

import (
	"errors"
	"strings"
	"time"
)

type ReviewStatus string
type VerificationState string

const (
	ReviewActive  ReviewStatus = "ACTIVE"
	ReviewHidden  ReviewStatus = "HIDDEN"
	ReviewRemoved ReviewStatus = "REMOVED"

	VerificationVerified   VerificationState = "VERIFIED_INTERACTION"
	VerificationUnverified VerificationState = "UNVERIFIED_OPINION"
)

type Review struct {
	ID                     string
	Domain                 Domain
	Subject                SubjectRef
	Author                 SubjectRef
	Rating                 uint8
	BodyRef                string
	AttachmentRefs         []string
	Verification           VerificationState
	InteractionKind        string
	VerifiedInteractionRef string
	VerificationIssuerID   string
	VerifiedOccurredAt     time.Time
	Status                 ReviewStatus
	Version                uint32
	CreatedAt              time.Time
	UpdatedAt              time.Time
}

func (r Review) Validate() error {
	if strings.TrimSpace(r.ID) == "" {
		return errors.New("review id is required")
	}
	if !ValidDomain(r.Domain) {
		return errors.New("review domain is invalid")
	}
	if err := r.Subject.Validate(); err != nil {
		return err
	}
	if err := r.Author.Validate(); err != nil {
		return err
	}
	if r.Subject.Type == r.Author.Type && r.Subject.ID == r.Author.ID {
		return errors.New("self-review is not allowed")
	}
	if r.Rating < 1 || r.Rating > 5 {
		return errors.New("review rating must be between 1 and 5")
	}
	switch r.Verification {
	case VerificationVerified:
		if strings.TrimSpace(r.InteractionKind) == "" ||
			strings.TrimSpace(r.VerifiedInteractionRef) == "" ||
			strings.TrimSpace(r.VerificationIssuerID) == "" ||
			r.VerifiedOccurredAt.IsZero() {
			return errors.New("verified review requires interaction provenance")
		}
	case VerificationUnverified:
		if r.InteractionKind != "" || r.VerifiedInteractionRef != "" || r.VerificationIssuerID != "" || !r.VerifiedOccurredAt.IsZero() {
			return errors.New("unverified opinion cannot carry verified interaction provenance")
		}
	default:
		return errors.New("review verification state is invalid")
	}
	if r.Status != ReviewActive && r.Status != ReviewHidden && r.Status != ReviewRemoved {
		return errors.New("review status is invalid")
	}
	if r.Version == 0 {
		return errors.New("review version is required")
	}
	if r.CreatedAt.IsZero() || r.UpdatedAt.IsZero() {
		return errors.New("review timestamps are required")
	}
	if r.UpdatedAt.Before(r.CreatedAt) {
		return errors.New("review updated time cannot precede created time")
	}
	return nil
}

func CloneReview(in Review) Review {
	out := in
	out.AttachmentRefs = append([]string(nil), in.AttachmentRefs...)
	return out
}

func AllowsUnverifiedOpinion(domain Domain) bool {
	switch domain {
	case DomainMarketplace, DomainClassifieds, DomainTravel, DomainEmployer,
		DomainCreator, DomainCrowdfunding, DomainEducation:
		return true
	default:
		return false
	}
}

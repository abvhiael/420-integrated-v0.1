package service

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/420integrated/420-integrated/reputation/interactions"
	"github.com/420integrated/420-integrated/reputation/model"
)

type CreateReviewInput struct {
	ID              string
	Domain          model.Domain
	Subject         model.SubjectRef
	Author          model.SubjectRef
	Rating          uint8
	BodyRef         string
	AttachmentRefs  []string
	Verification    model.VerificationState
	InteractionKind interactions.Kind
	EvidenceRef     string
}

type UpdateReviewInput struct {
	ReviewID        string
	ExpectedVersion uint32
	Actor           model.SubjectRef
	Rating          uint8
	BodyRef         string
	AttachmentRefs  []string
}

func (s *Service) CreateReview(ctx context.Context, in CreateReviewInput, now time.Time) (model.Review, error) {
	if now.IsZero() {
		return model.Review{}, errors.New("review creation time is required")
	}
	if err := s.ValidateSubject(ctx, in.Author); err != nil {
		return model.Review{}, err
	}
	if err := s.ValidateSubject(ctx, in.Subject); err != nil {
		return model.Review{}, err
	}

	review := model.Review{
		ID:             strings.TrimSpace(in.ID),
		Domain:         in.Domain,
		Subject:        in.Subject,
		Author:         in.Author,
		Rating:         in.Rating,
		BodyRef:        strings.TrimSpace(in.BodyRef),
		AttachmentRefs: append([]string(nil), in.AttachmentRefs...),
		Verification:   in.Verification,
		Status:         model.ReviewActive,
		Version:        1,
		CreatedAt:      now.UTC(),
		UpdatedAt:      now.UTC(),
	}

	switch in.Verification {
	case model.VerificationVerified:
		evidence, err := s.VerifyInteraction(ctx, in.Domain, in.InteractionKind, in.EvidenceRef, in.Author, in.Subject)
		if err != nil {
			return model.Review{}, err
		}
		review.InteractionKind = string(evidence.Kind)
		review.VerifiedInteractionRef = evidence.EvidenceRef
		review.VerificationIssuerID = evidence.IssuerID
		review.VerifiedOccurredAt = evidence.OccurredAt.UTC()
	case model.VerificationUnverified:
		if !model.AllowsUnverifiedOpinion(in.Domain) {
			return model.Review{}, errors.New("unverified opinion is not allowed for this reputation domain")
		}
	default:
		return model.Review{}, errors.New("review verification state is invalid")
	}

	if err := review.Validate(); err != nil {
		return model.Review{}, err
	}
	return s.reviews.Create(review)
}

func (s *Service) GetReview(_ context.Context, id string) (model.Review, error) {
	return s.reviews.Get(strings.TrimSpace(id))
}

func (s *Service) ListReviews(_ context.Context, domain model.Domain, subject model.SubjectRef) ([]model.Review, error) {
	if !model.ValidDomain(domain) {
		return nil, errors.New("review domain is invalid")
	}
	if err := subject.Validate(); err != nil {
		return nil, err
	}
	return s.reviews.ListBySubject(domain, subject), nil
}

func (s *Service) UpdateReview(ctx context.Context, in UpdateReviewInput, now time.Time) (model.Review, error) {
	if now.IsZero() {
		return model.Review{}, errors.New("review update time is required")
	}
	if err := s.ValidateSubject(ctx, in.Actor); err != nil {
		return model.Review{}, err
	}
	current, err := s.reviews.Get(strings.TrimSpace(in.ReviewID))
	if err != nil {
		return model.Review{}, err
	}
	if current.Author != in.Actor {
		return model.Review{}, errors.New("only review author may edit review")
	}
	current.Rating = in.Rating
	current.BodyRef = strings.TrimSpace(in.BodyRef)
	current.AttachmentRefs = append([]string(nil), in.AttachmentRefs...)
	current.Version = in.ExpectedVersion + 1
	current.UpdatedAt = now.UTC()
	if err := current.Validate(); err != nil {
		return model.Review{}, err
	}
	return s.reviews.Update(current, in.ExpectedVersion)
}

package projection

import (
	"errors"

	"github.com/420integrated/420-integrated/reputation/model"
)

type Projector struct{}

func (Projector) FromSummary(summary model.ReputationSummary) (Document, error) {
	id, err := StableID(summary.Domain, summary.Subject)
	if err != nil {
		return Document{}, err
	}
	if summary.PolicyVersion == "" {
		return Document{}, errors.New("summary policy version is required")
	}
	doc := Document{
		Schema: SchemaVersion,
		ID: id,
		Domain: summary.Domain,
		Subject: summary.Subject,
		PolicyVersion: summary.PolicyVersion,
		VisibleReviewCount: summary.VisibleReviewCount,
		VerifiedReviewCount: summary.VerifiedReviewCount,
		UnverifiedReviewCount: summary.UnverifiedReviewCount,
		ResponseCount: summary.ResponseCount,
		ModeratedReviewCount: summary.ModeratedReviewCount,
		RatingDistribution: summary.RatingDistribution,
		AverageRating: summary.AverageRating(),
		UpdatedAt: summary.UpdatedAt,
		Source: "420Reputation derived public projection",
		Authoritative: false,
	}
	if err := doc.Validate(); err != nil {
		return Document{}, err
	}
	return doc, nil
}

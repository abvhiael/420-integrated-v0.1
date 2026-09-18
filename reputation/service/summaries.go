package service

import (
	"context"
	"errors"
	"sort"
	"time"

	"github.com/420integrated/420-integrated/reputation/model"
)

func (s *Service) ReputationSummary(ctx context.Context, domain model.Domain, subject model.SubjectRef) (model.ReputationSummary, error) {
	if !model.ValidDomain(domain) {
		return model.ReputationSummary{}, errors.New("reputation summary domain is invalid")
	}
	if err := s.ValidateSubject(ctx, subject); err != nil {
		return model.ReputationSummary{}, err
	}

	reviews := s.reviews.ListBySubject(domain, subject)
	out := model.ReputationSummary{
		Domain: domain,
		Subject: subject,
		PolicyVersion: model.ReputationPolicyVersion,
		History: make([]model.SummaryHistoryEntry, 0, len(reviews)),
	}

	for _, review := range reviews {
		entry := model.SummaryHistoryEntry{
			ReviewID: review.ID,
			Rating: review.Rating,
			Verification: review.Verification,
			Status: review.Status,
			CreatedAt: review.CreatedAt,
			UpdatedAt: review.UpdatedAt,
		}
		if review.UpdatedAt.After(out.UpdatedAt) {
			out.UpdatedAt = review.UpdatedAt
		}
		if response, err := s.reviews.GetResponse(review.ID); err == nil {
			entry.HasResponse = true
			out.ResponseCount++
			if response.UpdatedAt.After(out.UpdatedAt) {
				out.UpdatedAt = response.UpdatedAt
			}
		}
		moderation := s.reviews.ListModeration(review.ID)
		entry.ModerationCount = uint64(len(moderation))
		if len(moderation) > 0 {
			out.ModeratedReviewCount++
			for _, record := range moderation {
				if record.CreatedAt.After(out.UpdatedAt) {
					out.UpdatedAt = record.CreatedAt
				}
			}
		}
		out.History = append(out.History, entry)

		switch review.Status {
		case model.ReviewHidden:
			out.HiddenReviewCount++
			continue
		case model.ReviewRemoved:
			out.RemovedReviewCount++
			continue
		case model.ReviewActive:
			out.VisibleReviewCount++
		}

		switch review.Verification {
		case model.VerificationVerified:
			out.VerifiedReviewCount++
		case model.VerificationUnverified:
			out.UnverifiedReviewCount++
		}

		switch review.Rating {
		case 1:
			out.RatingDistribution.One++
		case 2:
			out.RatingDistribution.Two++
		case 3:
			out.RatingDistribution.Three++
		case 4:
			out.RatingDistribution.Four++
		case 5:
			out.RatingDistribution.Five++
		}
	}

	sort.Slice(out.History, func(i,j int) bool {
		if !out.History[i].CreatedAt.Equal(out.History[j].CreatedAt) {
			return out.History[i].CreatedAt.After(out.History[j].CreatedAt)
		}
		return out.History[i].ReviewID < out.History[j].ReviewID
	})
	if out.UpdatedAt.IsZero() {
		out.UpdatedAt = time.Time{}
	}
	return out, nil
}

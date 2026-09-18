package model

import "time"

const ReputationPolicyVersion = "420-reputation-genesis-v1"

type RatingDistribution struct {
	One   uint64
	Two   uint64
	Three uint64
	Four  uint64
	Five  uint64
}

type SummaryHistoryEntry struct {
	ReviewID      string
	Rating        uint8
	Verification  VerificationState
	Status        ReviewStatus
	HasResponse   bool
	ModerationCount uint64
	CreatedAt     time.Time
	UpdatedAt     time.Time
}

type ReputationSummary struct {
	Domain                Domain
	Subject               SubjectRef
	PolicyVersion         string
	VisibleReviewCount    uint64
	HiddenReviewCount     uint64
	RemovedReviewCount    uint64
	VerifiedReviewCount   uint64
	UnverifiedReviewCount uint64
	ResponseCount         uint64
	ModeratedReviewCount  uint64
	RatingDistribution    RatingDistribution
	History               []SummaryHistoryEntry
	UpdatedAt             time.Time
}

func (s ReputationSummary) AverageRating() float64 {
	total := s.RatingDistribution.One +
		2*s.RatingDistribution.Two +
		3*s.RatingDistribution.Three +
		4*s.RatingDistribution.Four +
		5*s.RatingDistribution.Five
	if s.VisibleReviewCount == 0 {
		return 0
	}
	return float64(total) / float64(s.VisibleReviewCount)
}

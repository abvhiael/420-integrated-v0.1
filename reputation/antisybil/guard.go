package antisybil

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/420integrated/420-integrated/reputation/model"
)

var (
	ErrDuplicateEvidence = errors.New("verified interaction already has a review")
	ErrRateLimited       = errors.New("review creation rate limit exceeded")
	ErrConflict          = errors.New("reviewer conflict of interest detected")
)

type Repository interface {
	FindByVerifiedInteraction(string) (model.Review, bool)
	CountByAuthorSince(model.SubjectRef, time.Time) uint64
}

type ConflictSource interface {
	HasConflict(context.Context, model.SubjectRef, model.SubjectRef, model.Domain) (bool, error)
}

type Config struct {
	HourlyLimit uint64
	DailyLimit  uint64
}

type Guard struct {
	repo      Repository
	conflicts ConflictSource
	config    Config
}

func New(repo Repository, conflicts ConflictSource, config Config) (*Guard, error) {
	if repo == nil {
		return nil, errors.New("anti-Sybil repository is required")
	}
	if conflicts == nil {
		return nil, errors.New("anti-Sybil conflict source is required")
	}
	if config.HourlyLimit == 0 || config.DailyLimit == 0 || config.HourlyLimit > config.DailyLimit {
		return nil, errors.New("anti-Sybil rate limits are invalid")
	}
	return &Guard{repo:repo, conflicts:conflicts, config:config}, nil
}

func (g *Guard) CheckCreate(ctx context.Context, review model.Review, now time.Time) error {
	if err := review.Validate(); err != nil {
		return err
	}
	if now.IsZero() {
		return errors.New("anti-Sybil check time is required")
	}
	if review.Author == review.Subject {
		return errors.New("self-review is not allowed")
	}
	if review.Verification == model.VerificationVerified {
		ref := strings.TrimSpace(review.VerifiedInteractionRef)
		if ref == "" {
			return errors.New("verified interaction reference is required")
		}
		if _, exists := g.repo.FindByVerifiedInteraction(ref); exists {
			return ErrDuplicateEvidence
		}
	}
	if g.repo.CountByAuthorSince(review.Author, now.Add(-time.Hour)) >= g.config.HourlyLimit {
		return ErrRateLimited
	}
	if g.repo.CountByAuthorSince(review.Author, now.Add(-24*time.Hour)) >= g.config.DailyLimit {
		return ErrRateLimited
	}
	conflict, err := g.conflicts.HasConflict(ctx, review.Author, review.Subject, review.Domain)
	if err != nil {
		return err
	}
	if conflict {
		return ErrConflict
	}
	return nil
}

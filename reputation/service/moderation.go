package service

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/420integrated/420-integrated/reputation/model"
)

type ModeratorAuthorizer interface {
	CanModerate(context.Context, model.SubjectRef, model.Domain) (bool, error)
}

type ReportReviewInput struct {
	ID       string
	ReviewID string
	Actor    model.SubjectRef
	Reason   model.ModerationReason
	BodyRef  string
}

type ModerateReviewInput struct {
	ID       string
	ReviewID string
	Actor    model.SubjectRef
	Action   model.ModerationAction
	Reason   model.ModerationReason
	BodyRef  string
	ParentID string
}

func (s *Service) ReportReview(ctx context.Context, in ReportReviewInput, now time.Time) (model.ModerationRecord, error) {
	if now.IsZero() { return model.ModerationRecord{}, errors.New("moderation time is required") }
	if err := s.ValidateSubject(ctx, in.Actor); err != nil { return model.ModerationRecord{}, err }
	review, err := s.reviews.Get(strings.TrimSpace(in.ReviewID)); if err != nil { return model.ModerationRecord{}, err }
	record := model.ModerationRecord{
		ID:strings.TrimSpace(in.ID), ReviewID:review.ID, Action:model.ModerationReport, Reason:in.Reason,
		Actor:in.Actor, BodyRef:strings.TrimSpace(in.BodyRef), PreviousState:review.Status, ResultState:review.Status,
		State:model.ModerationOpen, Version:1, CreatedAt:now.UTC(),
	}
	if err := record.Validate(); err != nil { return model.ModerationRecord{}, err }
	return s.reviews.CreateModeration(record)
}

func (s *Service) ModerateReview(ctx context.Context, in ModerateReviewInput, now time.Time) (model.ModerationRecord, error) {
	if now.IsZero() { return model.ModerationRecord{}, errors.New("moderation time is required") }
	if err := s.ValidateSubject(ctx, in.Actor); err != nil { return model.ModerationRecord{}, err }
	review, err := s.reviews.Get(strings.TrimSpace(in.ReviewID)); if err != nil { return model.ModerationRecord{}, err }

	switch in.Action {
	case model.ModerationAppeal:
		if in.Actor != review.Author && in.Actor != review.Subject {
			return model.ModerationRecord{}, errors.New("only review author or reviewed subject may appeal")
		}
	case model.ModerationHide, model.ModerationRestore, model.ModerationLock, model.ModerationDecision:
		ok, err := s.moderators.CanModerate(ctx, in.Actor, review.Domain)
		if err != nil { return model.ModerationRecord{}, err }
		if !ok { return model.ModerationRecord{}, errors.New("actor is not authorized to moderate this domain") }
	default:
		return model.ModerationRecord{}, errors.New("unsupported moderation action")
	}

	resultStatus := review.Status
	state := model.ModerationResolved
	switch in.Action {
	case model.ModerationHide:
		resultStatus = model.ReviewHidden
		state = model.ModerationHidden
	case model.ModerationRestore:
		resultStatus = model.ReviewActive
		state = model.ModerationVisible
	case model.ModerationLock:
		state = model.ModerationLocked
	case model.ModerationAppeal:
		state = model.ModerationAppealed
	case model.ModerationDecision:
		state = model.ModerationResolved
	}

	record := model.ModerationRecord{
		ID:strings.TrimSpace(in.ID), ReviewID:review.ID, Action:in.Action, Reason:in.Reason,
		Actor:in.Actor, BodyRef:strings.TrimSpace(in.BodyRef), PreviousState:review.Status,
		ResultState:resultStatus, State:state, ParentID:strings.TrimSpace(in.ParentID),
		Version:1, CreatedAt:now.UTC(),
	}
	if err := record.Validate(); err != nil { return model.ModerationRecord{}, err }
	if in.Action == model.ModerationHide || in.Action == model.ModerationRestore {
		before := review
		review.Status = resultStatus
		review.Version++
		review.UpdatedAt = now.UTC()
		if err := review.Validate(); err != nil { return model.ModerationRecord{}, err }
		if _, err := s.reviews.Update(review, before.Version); err != nil { return model.ModerationRecord{}, err }
	}
	return s.reviews.CreateModeration(record)
}

func (s *Service) ListModeration(_ context.Context, reviewID string) ([]model.ModerationRecord, error) {
	if strings.TrimSpace(reviewID) == "" { return nil, errors.New("review id is required") }
	return s.reviews.ListModeration(strings.TrimSpace(reviewID)), nil
}

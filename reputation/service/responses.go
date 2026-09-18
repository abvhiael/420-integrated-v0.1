package service

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/420integrated/420-integrated/reputation/model"
)

type DelegationAuthorizer interface {
	CanActFor(context.Context, model.SubjectRef, model.SubjectRef) (bool, error)
}

type CreateResponseInput struct {
	ReviewID string
	Actor    model.SubjectRef
	BodyRef  string
}

type UpdateResponseInput struct {
	ReviewID        string
	Actor           model.SubjectRef
	BodyRef         string
	ExpectedVersion uint32
}

func (s *Service) CreateResponse(ctx context.Context, in CreateResponseInput, now time.Time) (model.Response, error) {
	if now.IsZero() {
		return model.Response{}, errors.New("response creation time is required")
	}
	if err := s.ValidateSubject(ctx, in.Actor); err != nil {
		return model.Response{}, err
	}
	review, err := s.reviews.Get(strings.TrimSpace(in.ReviewID))
	if err != nil {
		return model.Response{}, err
	}
	if err := s.authorizeResponseActor(ctx, in.Actor, review.Subject); err != nil {
		return model.Response{}, err
	}
	response := model.Response{
		ReviewID: review.ID,
		Subject: review.Subject,
		Actor: in.Actor,
		BodyRef: strings.TrimSpace(in.BodyRef),
		Version: 1,
		CreatedAt: now.UTC(),
		UpdatedAt: now.UTC(),
	}
	if err := response.Validate(); err != nil {
		return model.Response{}, err
	}
	return s.reviews.CreateResponse(response)
}

func (s *Service) GetResponse(_ context.Context, reviewID string) (model.Response, error) {
	return s.reviews.GetResponse(strings.TrimSpace(reviewID))
}

func (s *Service) UpdateResponse(ctx context.Context, in UpdateResponseInput, now time.Time) (model.Response, error) {
	if now.IsZero() {
		return model.Response{}, errors.New("response update time is required")
	}
	if err := s.ValidateSubject(ctx, in.Actor); err != nil {
		return model.Response{}, err
	}
	review, err := s.reviews.Get(strings.TrimSpace(in.ReviewID))
	if err != nil {
		return model.Response{}, err
	}
	if err := s.authorizeResponseActor(ctx, in.Actor, review.Subject); err != nil {
		return model.Response{}, err
	}
	current, err := s.reviews.GetResponse(review.ID)
	if err != nil {
		return model.Response{}, err
	}
	current.Actor = in.Actor
	current.BodyRef = strings.TrimSpace(in.BodyRef)
	current.Version = in.ExpectedVersion + 1
	current.UpdatedAt = now.UTC()
	if err := current.Validate(); err != nil {
		return model.Response{}, err
	}
	return s.reviews.UpdateResponse(current, in.ExpectedVersion)
}

func (s *Service) authorizeResponseActor(ctx context.Context, actor, subject model.SubjectRef) error {
	if actor == subject {
		return nil
	}
	ok, err := s.delegations.CanActFor(ctx, actor, subject)
	if err != nil {
		return err
	}
	if !ok {
		return errors.New("actor is not authorized to respond for reviewed subject")
	}
	return nil
}

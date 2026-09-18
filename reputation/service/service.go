package service

import (
	"context"
	"errors"

	"github.com/420integrated/420-integrated/reputation/model"
)

type SubjectBinder interface {
	ValidateSubject(ctx context.Context, subject model.SubjectRef) error
}

type TrustReader interface {
	ReadMetric(ctx context.Context, subject model.SubjectRef, metricID string) (model.TrustMetricRef, error)
}

type ReviewRepository interface {
	Ready(ctx context.Context) error
}

type Dependencies struct {
	Subjects SubjectBinder
	Trust    TrustReader
	Reviews  ReviewRepository
}

type Service struct {
	subjects SubjectBinder
	trust    TrustReader
	reviews  ReviewRepository
}

func New(deps Dependencies) (*Service, error) {
	if deps.Subjects == nil {
		return nil, errors.New("reputation service requires subject binder")
	}
	if deps.Trust == nil {
		return nil, errors.New("reputation service requires 420Trust reader")
	}
	if deps.Reviews == nil {
		return nil, errors.New("reputation service requires review repository")
	}
	return &Service{
		subjects: deps.Subjects,
		trust:    deps.Trust,
		reviews:  deps.Reviews,
	}, nil
}

func (s *Service) ServiceID() string {
	return model.ServiceID
}

func (s *Service) APIVersion() string {
	return model.APIVersion
}

func (s *Service) Boundary() model.ServiceBoundary {
	return model.GenesisBoundary()
}

func (s *Service) Domains() []model.Domain {
	out := make([]model.Domain, len(model.GenesisDomains))
	copy(out, model.GenesisDomains)
	return out
}

func (s *Service) Ready(ctx context.Context) error {
	return s.reviews.Ready(ctx)
}

func (s *Service) ValidateSubject(ctx context.Context, subject model.SubjectRef) error {
	if err := subject.Validate(); err != nil {
		return err
	}
	return s.subjects.ValidateSubject(ctx, subject)
}

func (s *Service) ReadTrustMetric(ctx context.Context, subject model.SubjectRef, metricID string) (model.TrustMetricRef, error) {
	if err := s.ValidateSubject(ctx, subject); err != nil {
		return model.TrustMetricRef{}, err
	}
	if metricID == "" {
		return model.TrustMetricRef{}, errors.New("reputation trust metric id is required")
	}
	metric, err := s.trust.ReadMetric(ctx, subject, metricID)
	if err != nil {
		return model.TrustMetricRef{}, err
	}
	if err := metric.Validate(); err != nil {
		return model.TrustMetricRef{}, err
	}
	return metric, nil
}

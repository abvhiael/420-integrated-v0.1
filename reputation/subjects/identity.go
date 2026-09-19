package subjects

import (
	"context"
	"errors"
	"strings"

	"github.com/420integrated/420-integrated/reputation/model"
)

type IdentityProfile struct {
	ID         string
	Controller string
	Active     bool
}

type IdentitySource interface {
	Profile(context.Context, string) (IdentityProfile, error)
}

type IdentityAdapter struct {
	source IdentitySource
}

func NewIdentityAdapter(source IdentitySource) (*IdentityAdapter, error) {
	if source == nil {
		return nil, errors.New("420Identity subject source is required")
	}
	return &IdentityAdapter{source: source}, nil
}

func (a *IdentityAdapter) Validate(ctx context.Context, subject model.SubjectRef) error {
	if normalizeType(subject.Type) != SubjectProfile {
		return ErrUnsupportedSubject
	}
	profile, err := a.source.Profile(ctx, strings.TrimSpace(subject.ID))
	if err != nil {
		return err
	}
	if strings.TrimSpace(profile.ID) == "" || !strings.EqualFold(profile.ID, subject.ID) {
		return ErrSubjectNotFound
	}
	if !profile.Active || strings.TrimSpace(profile.Controller) == "" {
		return ErrSubjectInactive
	}
	return nil
}

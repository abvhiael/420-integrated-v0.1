package subjects

import (
	"context"
	"errors"
	"strings"

	"github.com/420integrated/420-integrated/reputation/model"
)

type ApplicationSubjectSource interface {
	Exists(context.Context, string) (bool, error)
}

type ApplicationAdapter struct {
	kind   string
	source ApplicationSubjectSource
}

func NewApplicationAdapter(kind string, source ApplicationSubjectSource) (*ApplicationAdapter, error) {
	kind = normalizeType(kind)
	switch kind {
	case SubjectPlace, SubjectListing, SubjectCampaign, SubjectCourse, SubjectCommunity:
	default:
		return nil, errors.New("unsupported application subject adapter kind")
	}
	if source == nil {
		return nil, errors.New("application subject source is required")
	}
	return &ApplicationAdapter{kind: kind, source: source}, nil
}

func (a *ApplicationAdapter) Validate(ctx context.Context, subject model.SubjectRef) error {
	if normalizeType(subject.Type) != a.kind {
		return ErrUnsupportedSubject
	}
	exists, err := a.source.Exists(ctx, strings.TrimSpace(subject.ID))
	if err != nil {
		return err
	}
	if !exists {
		return ErrSubjectNotFound
	}
	return nil
}

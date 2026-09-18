package subjects

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/420integrated/420-integrated/reputation/model"
)

const (
	SubjectProfile      = "PROFILE"
	SubjectOrganization = "ORGANIZATION"
	SubjectService      = "SERVICE"
	SubjectPlace        = "PLACE"
	SubjectListing      = "LISTING"
	SubjectCampaign     = "CAMPAIGN"
	SubjectCourse       = "COURSE"
	SubjectCommunity    = "COMMUNITY"
)

var GenesisSubjectTypes = []string{
	SubjectProfile,
	SubjectOrganization,
	SubjectService,
	SubjectPlace,
	SubjectListing,
	SubjectCampaign,
	SubjectCourse,
	SubjectCommunity,
}

var (
	ErrUnsupportedSubject = errors.New("unsupported reputation subject type")
	ErrSubjectNotFound     = errors.New("reputation subject not found")
	ErrSubjectInactive     = errors.New("reputation subject inactive")
)

type Adapter interface {
	Validate(context.Context, model.SubjectRef) error
}

type Binder struct {
	adapters map[string]Adapter
}

func NewBinder(adapters map[string]Adapter) (*Binder, error) {
	if len(adapters) == 0 {
		return nil, errors.New("reputation subject adapters are required")
	}
	out := make(map[string]Adapter, len(adapters))
	for kind, adapter := range adapters {
		kind = normalizeType(kind)
		if !validSubjectType(kind) {
			return nil, fmt.Errorf("%w: %s", ErrUnsupportedSubject, kind)
		}
		if adapter == nil {
			return nil, fmt.Errorf("reputation subject adapter %s is nil", kind)
		}
		if _, exists := out[kind]; exists {
			return nil, fmt.Errorf("duplicate reputation subject adapter %s", kind)
		}
		out[kind] = adapter
	}
	return &Binder{adapters: out}, nil
}

func (b *Binder) ValidateSubject(ctx context.Context, subject model.SubjectRef) error {
	if err := subject.Validate(); err != nil {
		return err
	}
	kind := normalizeType(subject.Type)
	adapter, ok := b.adapters[kind]
	if !ok {
		return fmt.Errorf("%w: %s", ErrUnsupportedSubject, kind)
	}
	subject.Type = kind
	return adapter.Validate(ctx, subject)
}

func normalizeType(v string) string {
	return strings.ToUpper(strings.TrimSpace(v))
}

func validSubjectType(v string) bool {
	for _, candidate := range GenesisSubjectTypes {
		if v == candidate {
			return true
		}
	}
	return false
}

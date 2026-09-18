package subjects

import (
	"context"
	"errors"
	"strings"

	"github.com/420integrated/420-integrated/reputation/model"
)

type RegistryRecord struct {
	ID     string
	Kind   string
	Active bool
}

type RegistrySource interface {
	Record(context.Context, string, string) (RegistryRecord, error)
}

type RegistryAdapter struct {
	source RegistrySource
	kind   string
}

func NewRegistryAdapter(kind string, source RegistrySource) (*RegistryAdapter, error) {
	kind = normalizeType(kind)
	if kind != SubjectOrganization && kind != SubjectService {
		return nil, errors.New("registry adapter only supports ORGANIZATION or SERVICE")
	}
	if source == nil {
		return nil, errors.New("420Registry subject source is required")
	}
	return &RegistryAdapter{source: source, kind: kind}, nil
}

func (a *RegistryAdapter) Validate(ctx context.Context, subject model.SubjectRef) error {
	if normalizeType(subject.Type) != a.kind {
		return ErrUnsupportedSubject
	}
	record, err := a.source.Record(ctx, a.kind, strings.TrimSpace(subject.ID))
	if err != nil {
		return err
	}
	if strings.TrimSpace(record.ID) == "" || !strings.EqualFold(record.ID, subject.ID) || normalizeType(record.Kind) != a.kind {
		return ErrSubjectNotFound
	}
	if !record.Active {
		return ErrSubjectInactive
	}
	return nil
}

package interactions

import (
	"context"
	"errors"
	"strings"
)

type Record struct {
	Kind        Kind
	EvidenceRef string
	IssuerID    string
	Reviewer    string
	ReviewerType string
	Subject     string
	SubjectType string
	OccurredAtUnix int64
	Final       bool
}

type RecordSource interface {
	Lookup(context.Context, string) (Record, error)
}

type Adapter struct {
	sourceName string
	kind       Kind
	source     RecordSource
}

func NewAdapter(sourceName string, kind Kind, source RecordSource) (*Adapter, error) {
	sourceName = strings.TrimSpace(sourceName)
	if sourceName == "" {
		return nil, errors.New("interaction source name is required")
	}
	if !knownKind(kind) {
		return nil, errors.New("interaction kind is invalid")
	}
	if source == nil {
		return nil, errors.New("interaction record source is required")
	}
	return &Adapter{sourceName: sourceName, kind: kind, source: source}, nil
}

func (a *Adapter) Verify(ctx context.Context, evidenceRef string) (Evidence, error) {
	evidenceRef = strings.TrimSpace(evidenceRef)
	if evidenceRef == "" {
		return Evidence{}, errors.New("interaction evidence ref is required")
	}
	record, err := a.source.Lookup(ctx, evidenceRef)
	if err != nil {
		return Evidence{}, err
	}
	if record.Kind != a.kind || strings.TrimSpace(record.EvidenceRef) != evidenceRef {
		return Evidence{}, errors.New("interaction record does not match requested evidence")
	}
	evidence := Evidence{
		Kind:        record.Kind,
		EvidenceRef: record.EvidenceRef,
		IssuerID:    strings.TrimSpace(record.IssuerID),
		Reviewer:    subject(record.ReviewerType, record.Reviewer),
		Subject:     subject(record.SubjectType, record.Subject),
		OccurredAt:  unix(record.OccurredAtUnix),
		Source:      a.sourceName,
		Final:       record.Final,
	}
	if err := evidence.Validate(); err != nil {
		return Evidence{}, err
	}
	return evidence, nil
}

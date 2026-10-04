package processor

import (
	"context"
	"errors"
	"fmt"

	"github.com/420integrated/420-integrated/verify/compiler"
	"github.com/420integrated/420-integrated/verify/evidence"
	"github.com/420integrated/420-integrated/verify/matcher"
	"github.com/420integrated/420-integrated/verify/store"
	"github.com/420integrated/420-integrated/verify/submission"
)

type DeploymentSource interface {
	Acquire(context.Context, string, uint64) (evidence.DeploymentEvidence, error)
}

type Builder interface {
	Compile(context.Context, submission.Submission) (compiler.BuildEvidence, error)
}

type EvidenceStore interface {
	Append(evidence.DeploymentEvidence, submission.Submission, compiler.BuildEvidence, matcher.Result) (store.Record, error)
}

type Service struct {
	chain DeploymentSource
	builder Builder
	store EvidenceStore
}

func New(chain DeploymentSource, builder Builder, evidenceStore EvidenceStore) (*Service, error) {
	if chain == nil {
		return nil, errors.New("deployment evidence source is required")
	}
	if builder == nil {
		return nil, errors.New("compiler worker is required")
	}
	if evidenceStore == nil {
		return nil, errors.New("evidence store is required")
	}
	return &Service{chain: chain, builder: builder, store: evidenceStore}, nil
}

func (s *Service) Verify(ctx context.Context, chainID uint64, address string, submitted submission.Submission) (store.Record, error) {
	if chainID == 0 {
		return store.Record{}, errors.New("chain id is required")
	}
	if err := submitted.ValidateCommitment(); err != nil {
		return store.Record{}, fmt.Errorf("submission: %w", err)
	}

	deployment, err := s.chain.Acquire(ctx, address, chainID)
	if err != nil {
		return store.Record{}, fmt.Errorf("canonical deployment evidence: %w", err)
	}
	build, err := s.builder.Compile(ctx, submitted)
	if err != nil {
		return store.Record{}, fmt.Errorf("reproducible build: %w", err)
	}
	result := matcher.Classify(deployment, build, submitted, false)
	return s.store.Append(deployment, submitted, build, result)
}

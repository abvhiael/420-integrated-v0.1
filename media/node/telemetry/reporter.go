package telemetry

import (
	"context"
	"errors"
)

var ErrReporterUnavailable = errors.New("420media telemetry: reporter unavailable")

// SLAReporter is implemented by the secure signer/contract adapter. Telemetry never
// receives private keys; it supplies only the canonical job id, local outcome, and
// deterministic evidence hash.
type SLAReporter interface {
	Report(ctx context.Context, jobID [32]byte, outcome Outcome, evidenceHash [32]byte) error
}

func ReportEvidence(ctx context.Context, reporter SLAReporter, evidence Evidence) error {
	if reporter == nil { return ErrReporterUnavailable }
	hash, err := evidence.Hash()
	if err != nil { return err }
	if hash == ([32]byte{}) || evidence.Outcome == OutcomeUnknown { return ErrInvalidEvidence }
	return reporter.Report(ctx, evidence.JobID, evidence.Outcome, hash)
}

package ethadapter

import (
	"context"
	"errors"
	"fmt"
	"time"

	medianode "github.com/420integrated/420-integrated/media/node"
)

var (
	ErrUnknownJobStatus = errors.New("420media ethadapter: unknown job status")
	ErrInvalidJob       = errors.New("420media ethadapter: invalid job")
)

// ContractJob is the minimal representation returned by a MediaJobMarket420 binding.
// Status is the raw Solidity enum ordinal and MUST be translated here before worker use.
type ContractJob struct {
	ID           [32]byte
	Requester    string
	StreamID     [32]byte
	Kind         [32]byte
	CapabilityID [32]byte
	SLAID        [32]byte
	InputRef     [32]byte
	OperatorID   [32]byte
	MaxSpend     uint64
	FundedAmount uint64
	DeadlineUnix uint64
	Status       uint8
}

// Backend is intentionally narrower than an Ethereum client. A production binding may
// implement it with generated ABI bindings plus an RPC client/signer. This package owns
// the translation from contract representation into the node runtime model.
type Backend interface {
	ListPendingJobs(ctx context.Context) ([]ContractJob, error)
	Job(ctx context.Context, jobID [32]byte) (ContractJob, error)
	AcceptJob(ctx context.Context, jobID [32]byte) error
	MarkRunning(ctx context.Context, jobID [32]byte) error
	CommitResult(ctx context.Context, jobID [32]byte, outputRef [32]byte) error
}

type Adapter struct {
	backend Backend
}

func New(backend Backend) (*Adapter, error) {
	if backend == nil {
		return nil, errors.New("420media ethadapter: nil backend")
	}
	return &Adapter{backend: backend}, nil
}

func (a *Adapter) PendingJobs(ctx context.Context) ([]medianode.Job, error) {
	raw, err := a.backend.ListPendingJobs(ctx)
	if err != nil {
		return nil, err
	}
	jobs := make([]medianode.Job, 0, len(raw))
	for _, item := range raw {
		job, err := normalize(item)
		if err != nil {
			return nil, err
		}
		jobs = append(jobs, job)
	}
	return jobs, nil
}

func (a *Adapter) AcceptJob(ctx context.Context, jobID [32]byte) error {
	return a.backend.AcceptJob(ctx, jobID)
}

func (a *Adapter) RefreshJob(ctx context.Context, jobID [32]byte) (medianode.Job, error) {
	raw, err := a.backend.Job(ctx, jobID)
	if err != nil {
		return medianode.Job{}, err
	}
	return normalize(raw)
}

func (a *Adapter) MarkRunning(ctx context.Context, jobID [32]byte) error {
	return a.backend.MarkRunning(ctx, jobID)
}

func (a *Adapter) CommitResult(ctx context.Context, jobID [32]byte, outputRef [32]byte) error {
	if outputRef == ([32]byte{}) {
		return medianode.ErrInvalidResult
	}
	return a.backend.CommitResult(ctx, jobID, outputRef)
}

func normalize(raw ContractJob) (medianode.Job, error) {
	if raw.ID == ([32]byte{}) || raw.CapabilityID == ([32]byte{}) {
		return medianode.Job{}, ErrInvalidJob
	}
	status, err := translateStatus(raw.Status)
	if err != nil {
		return medianode.Job{}, err
	}
	var deadline time.Time
	if raw.DeadlineUnix != 0 {
		deadline = time.Unix(int64(raw.DeadlineUnix), 0).UTC()
	}
	return medianode.Job{
		ID:           raw.ID,
		Requester:    raw.Requester,
		StreamID:     raw.StreamID,
		Kind:         raw.Kind,
		CapabilityID: raw.CapabilityID,
		SLAID:        raw.SLAID,
		InputRef:     raw.InputRef,
		OperatorID:   raw.OperatorID,
		MaxSpend:     raw.MaxSpend,
		FundedAmount: raw.FundedAmount,
		Deadline:     deadline,
		Status:       status,
	}, nil
}

// MediaJobMarket420.Status ordering is isolated here. If the Solidity enum changes,
// only this translation table and its tests need to change; worker logic remains stable.
func translateStatus(status uint8) (medianode.JobStatus, error) {
	switch status {
	case 1:
		return medianode.JobCreated, nil
	case 2:
		return medianode.JobAccepted, nil
	case 3:
		return medianode.JobFunded, nil
	case 4:
		return medianode.JobRunning, nil
	case 5:
		return medianode.JobResultCommitted, nil
	case 6:
		return medianode.JobVerified, nil
	case 7:
		return medianode.JobFailed, nil
	case 8:
		return medianode.JobSettled, nil
	case 9:
		return medianode.JobCancelled, nil
	case 10:
		return medianode.JobExpired, nil
	case 11:
		return medianode.JobRefunded, nil
	default:
		return "", fmt.Errorf("%w: %d", ErrUnknownJobStatus, status)
	}
}

var _ medianode.ChainAdapter = (*Adapter)(nil)

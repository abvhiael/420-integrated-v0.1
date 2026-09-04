package node

import (
	"errors"
	"time"
)

// JobStatus mirrors the subset of MediaJobMarket420 states needed by an off-chain worker.
// Numeric values are deliberately not tied to Solidity enum ordinals; adapters must translate.
type JobStatus string

const (
	JobCreated         JobStatus = "created"
	JobAccepted        JobStatus = "accepted"
	JobFunded          JobStatus = "funded"
	JobRunning         JobStatus = "running"
	JobResultCommitted JobStatus = "result_committed"
	JobVerified        JobStatus = "verified"
	JobFailed          JobStatus = "failed"
	JobSettled         JobStatus = "settled"
	JobCancelled       JobStatus = "cancelled"
	JobExpired         JobStatus = "expired"
	JobRefunded        JobStatus = "refunded"
)

var (
	ErrUnsupportedCapability = errors.New("420media: unsupported capability")
	ErrOperatorMismatch      = errors.New("420media: operator mismatch")
	ErrJobNotFunded          = errors.New("420media: job is not funded")
	ErrLeaseLost             = errors.New("420media: execution lease lost")
	ErrDeadlineExceeded      = errors.New("420media: job deadline exceeded")
	ErrInvalidResult         = errors.New("420media: invalid processor result")
)

// Job is the normalized chain-facing workload consumed by the node runtime.
type Job struct {
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
	Deadline     time.Time
	Status       JobStatus
}

// Result contains references only. Raw media never enters the protocol runtime state.
type Result struct {
	OutputRef    [32]byte
	EvidenceHash [32]byte
	StartedAt    time.Time
	FinishedAt   time.Time
}

// OperatorConfig is local configuration for one registered MediaOperatorRegistry420 identity.
type OperatorConfig struct {
	OperatorID   [32]byte
	Capabilities map[[32]byte]struct{}
	PollInterval time.Duration
	LeaseTTL     time.Duration
	MaxParallel  int
}

func (c OperatorConfig) Supports(capability [32]byte) bool {
	_, ok := c.Capabilities[capability]
	return ok
}

func (c OperatorConfig) normalized() OperatorConfig {
	if c.PollInterval <= 0 {
		c.PollInterval = 2 * time.Second
	}
	if c.LeaseTTL <= 0 {
		c.LeaseTTL = 30 * time.Second
	}
	if c.MaxParallel <= 0 {
		c.MaxParallel = 1
	}
	return c
}

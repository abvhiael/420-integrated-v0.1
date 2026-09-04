package telemetry

import (
	"context"
	"crypto/sha256"
	"encoding/binary"
	"errors"
	"sync"
	"time"

	medianode "github.com/420integrated/420-integrated/media/node"
)

var (
	ErrInvalidEvidence = errors.New("420media telemetry: invalid evidence")
	ErrInvalidPolicy   = errors.New("420media telemetry: invalid SLA policy")
)

// Outcome is the local evaluation result. The reporter adapter maps this to the
// canonical MediaIds420.SLA_PASS / SLA_FAIL bytes32 identifiers.
type Outcome uint8

const (
	OutcomeUnknown Outcome = iota
	OutcomePass
	OutcomeFail
)

// Policy mirrors the SLA fields required for local evaluation. Raw metadata remains
// outside this package and is not included in evidence unless separately committed.
type Policy struct {
	MaxStartDelay   time.Duration
	MaxProcessing   time.Duration
	MinAvailability uint16 // basis points, 0..10000
}

func (p Policy) Valid() bool {
	return p.MaxStartDelay >= 0 && p.MaxProcessing >= 0 && p.MinAvailability <= 10_000
}

// Evidence is the versioned, non-secret record whose canonical encoding is hashed for
// MediaSLA420.report(). It intentionally contains references and timing only, never raw
// media, endpoint credentials, source URLs, SDP, or process command lines.
type Evidence struct {
	Version         uint16
	JobID           [32]byte
	OperatorID      [32]byte
	CapabilityID    [32]byte
	SLAID           [32]byte
	OutputRef       [32]byte
	AcceptedAt      time.Time
	StartedAt       time.Time
	FinishedAt      time.Time
	AvailabilityBps uint16
	Outcome         Outcome
}

func (e Evidence) Validate() error {
	if e.Version == 0 || e.JobID == ([32]byte{}) || e.OperatorID == ([32]byte{}) || e.CapabilityID == ([32]byte{}) {
		return ErrInvalidEvidence
	}
	if e.AvailabilityBps > 10_000 || e.Outcome == OutcomeUnknown {
		return ErrInvalidEvidence
	}
	if e.AcceptedAt.IsZero() || e.StartedAt.IsZero() || e.FinishedAt.IsZero() {
		return ErrInvalidEvidence
	}
	if e.StartedAt.Before(e.AcceptedAt) || e.FinishedAt.Before(e.StartedAt) {
		return ErrInvalidEvidence
	}
	return nil
}

// Hash returns SHA-256 over a fixed-width canonical representation. SHA-256 is used as
// an evidence commitment only; MediaSLA420 accepts an opaque non-zero bytes32 hash.
func (e Evidence) Hash() ([32]byte, error) {
	if err := e.Validate(); err != nil {
		return [32]byte{}, err
	}
	buf := make([]byte, 0, 32*5+2+8*3+2+1)
	var u16 [2]byte
	var u64 [8]byte
	binary.BigEndian.PutUint16(u16[:], e.Version)
	buf = append(buf, u16[:]...)
	buf = append(buf, e.JobID[:]...)
	buf = append(buf, e.OperatorID[:]...)
	buf = append(buf, e.CapabilityID[:]...)
	buf = append(buf, e.SLAID[:]...)
	buf = append(buf, e.OutputRef[:]...)
	for _, t := range []time.Time{e.AcceptedAt, e.StartedAt, e.FinishedAt} {
		binary.BigEndian.PutUint64(u64[:], uint64(t.UTC().UnixMilli()))
		buf = append(buf, u64[:]...)
	}
	binary.BigEndian.PutUint16(u16[:], e.AvailabilityBps)
	buf = append(buf, u16[:]...)
	buf = append(buf, byte(e.Outcome))
	return sha256.Sum256(buf), nil
}

func Evaluate(policy Policy, acceptedAt, startedAt, finishedAt time.Time, availabilityBps uint16) (Outcome, error) {
	if !policy.Valid() || acceptedAt.IsZero() || startedAt.IsZero() || finishedAt.IsZero() || availabilityBps > 10_000 {
		return OutcomeUnknown, ErrInvalidPolicy
	}
	if startedAt.Before(acceptedAt) || finishedAt.Before(startedAt) {
		return OutcomeUnknown, ErrInvalidEvidence
	}
	if policy.MaxStartDelay > 0 && startedAt.Sub(acceptedAt) > policy.MaxStartDelay {
		return OutcomeFail, nil
	}
	if policy.MaxProcessing > 0 && finishedAt.Sub(startedAt) > policy.MaxProcessing {
		return OutcomeFail, nil
	}
	if availabilityBps < policy.MinAvailability {
		return OutcomeFail, nil
	}
	return OutcomePass, nil
}

// HealthSnapshot is safe for operator/UI consumption and contains no secrets.
type HealthSnapshot struct {
	StartedAt       time.Time
	LastChainOK     time.Time
	LastChainError  time.Time
	LastJobOK       time.Time
	LastJobError    time.Time
	ActiveJobs      uint64
	CompletedJobs   uint64
	FailedJobs      uint64
	LeaseLosses     uint64
	Healthy         bool
}

type Health struct {
	mu sync.RWMutex
	s  HealthSnapshot
}

func NewHealth(now time.Time) *Health {
	if now.IsZero() { now = time.Now() }
	return &Health{s: HealthSnapshot{StartedAt: now.UTC(), Healthy: true}}
}

func (h *Health) ChainOK(now time.Time) { h.mu.Lock(); h.s.LastChainOK = now.UTC(); h.s.Healthy = true; h.mu.Unlock() }
func (h *Health) ChainError(now time.Time) { h.mu.Lock(); h.s.LastChainError = now.UTC(); h.s.Healthy = false; h.mu.Unlock() }
func (h *Health) JobStarted() { h.mu.Lock(); h.s.ActiveJobs++; h.mu.Unlock() }
func (h *Health) JobOK(now time.Time) { h.mu.Lock(); if h.s.ActiveJobs > 0 { h.s.ActiveJobs-- }; h.s.CompletedJobs++; h.s.LastJobOK = now.UTC(); h.mu.Unlock() }
func (h *Health) JobError(now time.Time) { h.mu.Lock(); if h.s.ActiveJobs > 0 { h.s.ActiveJobs-- }; h.s.FailedJobs++; h.s.LastJobError = now.UTC(); h.mu.Unlock() }
func (h *Health) LeaseLost(now time.Time) { h.mu.Lock(); h.s.LeaseLosses++; h.s.LastJobError = now.UTC(); h.mu.Unlock() }
func (h *Health) Snapshot() HealthSnapshot { h.mu.RLock(); defer h.mu.RUnlock(); return h.s }

// InstrumentedProcessor wraps any node Processor and records safe job health metrics.
type InstrumentedProcessor struct {
	Next medianode.Processor
	Health *Health
	Now func() time.Time
}

func (p InstrumentedProcessor) Process(ctx context.Context, job medianode.Job) (medianode.Result, error) {
	if p.Next == nil || p.Health == nil { return medianode.Result{}, errors.New("420media telemetry: missing processor dependency") }
	now := p.Now; if now == nil { now = time.Now }
	p.Health.JobStarted()
	result, err := p.Next.Process(ctx, job)
	if err != nil { p.Health.JobError(now()); return result, err }
	p.Health.JobOK(now())
	return result, nil
}

var _ medianode.Processor = InstrumentedProcessor{}

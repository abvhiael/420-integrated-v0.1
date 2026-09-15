package discovery

import (
	"context"
	"errors"
)

var (
	ErrInvalidRequest = errors.New("420media discovery: invalid request")
	ErrNoProviders    = errors.New("420media discovery: no eligible providers")
)

// Provider is an off-chain discovery projection of canonical MediaOperatorRegistry420
// state plus operator-published service metadata. Chain state remains authoritative for
// identity, activation and capability eligibility.
type Provider struct {
	OperatorID      [32]byte
	MetadataHash    [32]byte
	Revision        uint32
	Active          bool
	Capabilities    map[[32]byte]struct{}
	PricePerUnit    uint64
	LatencyMS       uint32
	Geography       string
	AvailableSlots  uint32
	ReliabilityBPS  uint32
}

func (p Provider) Supports(capabilityID [32]byte) bool {
	_, ok := p.Capabilities[capabilityID]
	return ok
}

// Request describes one provider-selection query. Zero-valued maxima disable that
// bound; zero Min* values impose no minimum. Reliability is expressed in basis points.
type Request struct {
	CapabilityID       [32]byte
	MaxPricePerUnit    uint64
	MaxLatencyMS       uint32
	AllowedGeographies map[string]struct{}
	MinAvailableSlots  uint32
	MinReliabilityBPS  uint32
	Limit              int
}

// Weights controls deterministic ranking among already-eligible providers.
// Values are relative; they do not need to sum to a fixed total.
type Weights struct {
	Price       uint32
	Latency     uint32
	Reliability uint32
	Capacity    uint32
}

func DefaultWeights() Weights {
	return Weights{Price: 30, Latency: 25, Reliability: 35, Capacity: 10}
}

// Source supplies the discovery projection. Production implementations are expected
// to maintain an event index and revalidate canonical operator/capability state before
// returning candidates.
type Source interface {
	Candidates(ctx context.Context, capabilityID [32]byte) ([]Provider, error)
}

// Selection records the chosen provider and its deterministic score.
type Selection struct {
	Provider Provider
	Score    uint64
}

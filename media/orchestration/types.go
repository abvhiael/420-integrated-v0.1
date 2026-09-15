package orchestration

import (
	"context"
	"errors"

	"github.com/420integrated/420-integrated/media/controlplane"
)

var (
	ErrInvalidPlan     = errors.New("420media orchestration: invalid plan request")
	ErrNoAssignment   = errors.New("420media orchestration: no provider assignment")
	ErrInvalidGraph    = errors.New("420media orchestration: invalid job graph")
)

type Role string

const (
	RoleIngress    Role = "ingress"
	RoleTranscoder Role = "transcoder"
	RoleRelay      Role = "relay"
)

type Discovery interface {
	Providers(ctx context.Context, req controlplane.DiscoveryRequest) ([]controlplane.ProviderView, error)
}

type CapabilitySet struct {
	Ingress    [32]byte
	Transcoder [32]byte
	Relay      [32]byte
}

type Constraints struct {
	MaxPricePerUnit   uint64
	MaxLatencyMS      uint32
	Geographies       []string
	MinAvailableSlots uint32
	MinReliabilityBPS uint32
}

type PlanRequest struct {
	StreamID      [32]byte
	Capabilities  CapabilitySet
	Constraints   Constraints
	Renditions    []string
	RelayCount    int
}

type Assignment struct {
	Role       Role
	OperatorID [32]byte
	Revision   uint32
	Score      uint64
}

type JobNode struct {
	ID         string
	Role       Role
	OperatorID [32]byte
	DependsOn  []string
	Rendition  string
}

type Plan struct {
	StreamID    [32]byte
	Assignments []Assignment
	Jobs        []JobNode
}

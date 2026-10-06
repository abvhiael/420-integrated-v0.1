package controlplane

import (
	"context"
	"errors"

	"github.com/420integrated/420-integrated/media/discovery"
)

var ErrInvalidDiscoveryRequest = errors.New("420media controlplane: invalid discovery request")

// DiscoveryRequest is the service-network-facing provider query. It intentionally
// contains selection constraints only; raw endpoints, credentials and media references
// are not part of the discovery control plane.
type DiscoveryRequest struct {
	CapabilityID      [32]byte
	MaxPricePerUnit   uint64
	MaxLatencyMS      uint32
	Geographies       []string
	MinAvailableSlots uint32
	MinReliabilityBPS uint32
	Limit             int
}

// ProviderView is the bounded discovery response exposed to orchestration callers.
// Canonical identity plus non-secret service metrics are returned; registry internals
// and operator metadata payloads remain behind the discovery layer.
type ProviderView struct {
	OperatorID     [32]byte
	Score          uint64
	PricePerUnit   uint64
	LatencyMS      uint32
	Geography      string
	AvailableSlots uint32
	ReliabilityBPS uint32
	Revision       uint32
}

type DiscoveryService struct {
	selector *discovery.Selector
}

func NewDiscoveryService(selector *discovery.Selector) *DiscoveryService {
	return &DiscoveryService{selector: selector}
}

func (s *DiscoveryService) Providers(ctx context.Context, req DiscoveryRequest) ([]ProviderView, error) {
	if s == nil || s.selector == nil || req.CapabilityID == ([32]byte{}) || req.Limit < 0 || req.MinReliabilityBPS > 10_000 {
		return nil, ErrInvalidDiscoveryRequest
	}
	allowed := make(map[string]struct{}, len(req.Geographies))
	for _, geography := range req.Geographies {
		if geography == "" {
			return nil, ErrInvalidDiscoveryRequest
		}
		allowed[geography] = struct{}{}
	}
	selected, err := s.selector.Select(ctx, discovery.Request{
		CapabilityID: req.CapabilityID,
		MaxPricePerUnit: req.MaxPricePerUnit,
		MaxLatencyMS: req.MaxLatencyMS,
		AllowedGeographies: allowed,
		MinAvailableSlots: req.MinAvailableSlots,
		MinReliabilityBPS: req.MinReliabilityBPS,
		Limit: req.Limit,
	})
	if err != nil {
		return nil, err
	}
	out := make([]ProviderView, 0, len(selected))
	for _, item := range selected {
		p := item.Provider
		out = append(out, ProviderView{
			OperatorID: p.OperatorID,
			Score: item.Score,
			PricePerUnit: p.PricePerUnit,
			LatencyMS: p.LatencyMS,
			Geography: p.Geography,
			AvailableSlots: p.AvailableSlots,
			ReliabilityBPS: p.ReliabilityBPS,
			Revision: p.Revision,
		})
	}
	return out, nil
}

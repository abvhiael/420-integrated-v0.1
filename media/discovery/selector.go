package discovery

import (
	"bytes"
	"context"
	"sort"
)

type Selector struct {
	source  Source
	weights Weights
}

func NewSelector(source Source, weights Weights) *Selector {
	if weights == (Weights{}) {
		weights = DefaultWeights()
	}
	return &Selector{source: source, weights: weights}
}

func (s *Selector) Select(ctx context.Context, req Request) ([]Selection, error) {
	if s == nil || s.source == nil || req.CapabilityID == ([32]byte{}) || req.Limit < 0 || req.MinReliabilityBPS > 10_000 {
		return nil, ErrInvalidRequest
	}
	providers, err := s.source.Candidates(ctx, req.CapabilityID)
	if err != nil {
		return nil, err
	}
	out := make([]Selection, 0, len(providers))
	for _, p := range providers {
		if !eligible(p, req) {
			continue
		}
		out = append(out, Selection{Provider: p, Score: score(p, req, s.weights)})
	}
	if len(out) == 0 {
		return nil, ErrNoProviders
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].Score != out[j].Score {
			return out[i].Score > out[j].Score
		}
		if out[i].Provider.PricePerUnit != out[j].Provider.PricePerUnit {
			return out[i].Provider.PricePerUnit < out[j].Provider.PricePerUnit
		}
		if out[i].Provider.LatencyMS != out[j].Provider.LatencyMS {
			return out[i].Provider.LatencyMS < out[j].Provider.LatencyMS
		}
		return bytes.Compare(out[i].Provider.OperatorID[:], out[j].Provider.OperatorID[:]) < 0
	})
	if req.Limit > 0 && len(out) > req.Limit {
		out = out[:req.Limit]
	}
	return out, nil
}

func eligible(p Provider, req Request) bool {
	if p.OperatorID == ([32]byte{}) || !p.Active || !p.Supports(req.CapabilityID) {
		return false
	}
	if p.ReliabilityBPS > 10_000 || p.ReliabilityBPS < req.MinReliabilityBPS {
		return false
	}
	if req.MaxPricePerUnit > 0 && p.PricePerUnit > req.MaxPricePerUnit {
		return false
	}
	if req.MaxLatencyMS > 0 && p.LatencyMS > req.MaxLatencyMS {
		return false
	}
	if p.AvailableSlots < req.MinAvailableSlots {
		return false
	}
	if len(req.AllowedGeographies) > 0 {
		if _, ok := req.AllowedGeographies[p.Geography]; !ok {
			return false
		}
	}
	return true
}

func score(p Provider, req Request, w Weights) uint64 {
	price := inverseBoundScore(p.PricePerUnit, req.MaxPricePerUnit)
	latency := inverseBoundScore(uint64(p.LatencyMS), uint64(req.MaxLatencyMS))
	reliability := uint64(p.ReliabilityBPS)
	capacity := capacityScore(p.AvailableSlots, req.MinAvailableSlots)
	return uint64(w.Price)*price + uint64(w.Latency)*latency + uint64(w.Reliability)*reliability + uint64(w.Capacity)*capacity
}

func inverseBoundScore(value, max uint64) uint64 {
	if max == 0 {
		return 5_000
	}
	if value >= max {
		return 0
	}
	return ((max - value) * 10_000) / max
}

func capacityScore(available, minimum uint32) uint64 {
	if minimum == 0 {
		if available >= 100 {
			return 10_000
		}
		return uint64(available) * 100
	}
	capAt := uint64(minimum) * 4
	if capAt == 0 || uint64(available) >= capAt {
		return 10_000
	}
	return (uint64(available) * 10_000) / capAt
}

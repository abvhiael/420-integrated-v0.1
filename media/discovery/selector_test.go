package discovery

import (
	"context"
	"errors"
	"testing"
)

type staticSource struct {
	providers []Provider
	err       error
}

func (s staticSource) Candidates(context.Context, [32]byte) ([]Provider, error) {
	return s.providers, s.err
}

func did(b byte) [32]byte { var v [32]byte; v[31] = b; return v }

func provider(id byte, cap [32]byte, price uint64, latency uint32, reliability uint32, slots uint32, geo string) Provider {
	return Provider{OperatorID: did(id), Active: true, Capabilities: map[[32]byte]struct{}{cap: {}}, PricePerUnit: price, LatencyMS: latency, ReliabilityBPS: reliability, AvailableSlots: slots, Geography: geo}
}

func TestSelectorFiltersIneligibleProviders(t *testing.T) {
	cap := did(1)
	providers := []Provider{
		provider(1, cap, 40, 50, 9900, 8, "ca-central"),
		provider(2, cap, 120, 50, 9900, 8, "ca-central"),
		provider(3, cap, 40, 500, 9900, 8, "ca-central"),
		provider(4, cap, 40, 50, 8000, 8, "ca-central"),
		provider(5, cap, 40, 50, 9900, 1, "ca-central"),
		provider(6, cap, 40, 50, 9900, 8, "eu-west"),
	}
	providers[0].Active = false
	providers = append(providers, provider(7, cap, 50, 60, 9950, 10, "ca-central"))

	sel := NewSelector(staticSource{providers: providers}, DefaultWeights())
	got, err := sel.Select(context.Background(), Request{CapabilityID: cap, MaxPricePerUnit: 100, MaxLatencyMS: 100, MinReliabilityBPS: 9000, MinAvailableSlots: 2, AllowedGeographies: map[string]struct{}{"ca-central": {}}, Limit: 1})
	if err != nil { t.Fatal(err) }
	if len(got) != 1 || got[0].Provider.OperatorID != did(7) {
		t.Fatalf("unexpected selection: %+v", got)
	}
}

func TestSelectorRanksDeterministically(t *testing.T) {
	cap := did(1)
	providers := []Provider{
		provider(3, cap, 50, 50, 9900, 8, "ca-central"),
		provider(2, cap, 50, 50, 9900, 8, "ca-central"),
	}
	sel := NewSelector(staticSource{providers: providers}, DefaultWeights())
	got, err := sel.Select(context.Background(), Request{CapabilityID: cap, MaxPricePerUnit: 100, MaxLatencyMS: 100})
	if err != nil { t.Fatal(err) }
	if len(got) != 2 || got[0].Provider.OperatorID != did(2) || got[1].Provider.OperatorID != did(3) {
		t.Fatalf("tie break must be stable by operator id: %+v", got)
	}
}

func TestSelectorPrefersHigherReliabilityWhenOtherInputsEqual(t *testing.T) {
	cap := did(1)
	sel := NewSelector(staticSource{providers: []Provider{
		provider(1, cap, 50, 50, 9500, 8, "ca-central"),
		provider(2, cap, 50, 50, 9990, 8, "ca-central"),
	}}, DefaultWeights())
	got, err := sel.Select(context.Background(), Request{CapabilityID: cap, MaxPricePerUnit: 100, MaxLatencyMS: 100})
	if err != nil { t.Fatal(err) }
	if got[0].Provider.OperatorID != did(2) { t.Fatalf("unexpected winner: %+v", got[0]) }
}

func TestSelectorRejectsInvalidRequestAndEmptySet(t *testing.T) {
	sel := NewSelector(staticSource{}, DefaultWeights())
	if _, err := sel.Select(context.Background(), Request{}); !errors.Is(err, ErrInvalidRequest) {
		t.Fatalf("expected invalid request, got %v", err)
	}
	if _, err := sel.Select(context.Background(), Request{CapabilityID: did(1)}); !errors.Is(err, ErrNoProviders) {
		t.Fatalf("expected no providers, got %v", err)
	}
}

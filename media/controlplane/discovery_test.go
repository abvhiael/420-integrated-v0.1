package controlplane

import (
	"context"
	"errors"
	"testing"

	"github.com/420integrated/420-integrated/media/discovery"
)

type fakeSource struct {
	providers []discovery.Provider
	err       error
}

func (f fakeSource) Candidates(context.Context, [32]byte) ([]discovery.Provider, error) {
	if f.err != nil { return nil, f.err }
	return f.providers, nil
}

func cpID(b byte) [32]byte { var v [32]byte; v[31] = b; return v }

func TestProvidersReturnsBoundedProviderView(t *testing.T) {
	capID := cpID(1)
	p1 := discovery.Provider{OperatorID: cpID(2), MetadataHash: cpID(90), Revision: 4, Active: true, Capabilities: map[[32]byte]struct{}{capID: {}}, PricePerUnit: 25, LatencyMS: 30, Geography: "ca-central", AvailableSlots: 8, ReliabilityBPS: 9950}
	p2 := discovery.Provider{OperatorID: cpID(3), MetadataHash: cpID(91), Revision: 2, Active: true, Capabilities: map[[32]byte]struct{}{capID: {}}, PricePerUnit: 10, LatencyMS: 120, Geography: "us-east", AvailableSlots: 2, ReliabilityBPS: 9800}
	service := NewDiscoveryService(discovery.NewSelector(fakeSource{providers: []discovery.Provider{p1, p2}}, discovery.DefaultWeights()))

	views, err := service.Providers(context.Background(), DiscoveryRequest{CapabilityID: capID, Geographies: []string{"ca-central"}, MinAvailableSlots: 4, MinReliabilityBPS: 9900, Limit: 1})
	if err != nil { t.Fatal(err) }
	if len(views) != 1 || views[0].OperatorID != p1.OperatorID { t.Fatalf("views=%+v", views) }
	if views[0].Revision != 4 || views[0].Score == 0 { t.Fatalf("view=%+v", views[0]) }
}

func TestProvidersRejectsMalformedRequest(t *testing.T) {
	service := NewDiscoveryService(discovery.NewSelector(fakeSource{}, discovery.DefaultWeights()))
	if _, err := service.Providers(context.Background(), DiscoveryRequest{}); !errors.Is(err, ErrInvalidDiscoveryRequest) {
		t.Fatalf("expected ErrInvalidDiscoveryRequest, got %v", err)
	}
	if _, err := service.Providers(context.Background(), DiscoveryRequest{CapabilityID: cpID(1), Geographies: []string{""}}); !errors.Is(err, ErrInvalidDiscoveryRequest) {
		t.Fatalf("expected blank geography rejection, got %v", err)
	}
}

func TestProvidersPropagatesFailClosedDiscoveryError(t *testing.T) {
	boom := errors.New("rpc unavailable")
	service := NewDiscoveryService(discovery.NewSelector(fakeSource{err: boom}, discovery.DefaultWeights()))
	if _, err := service.Providers(context.Background(), DiscoveryRequest{CapabilityID: cpID(1)}); !errors.Is(err, boom) {
		t.Fatalf("expected canonical discovery error, got %v", err)
	}
}

func TestProviderViewDoesNotExposeMetadataHashOrCapabilities(t *testing.T) {
	capID := cpID(1)
	p := discovery.Provider{OperatorID: cpID(2), MetadataHash: cpID(99), Revision: 1, Active: true, Capabilities: map[[32]byte]struct{}{capID: {}}, ReliabilityBPS: 10000, AvailableSlots: 1}
	service := NewDiscoveryService(discovery.NewSelector(fakeSource{providers: []discovery.Provider{p}}, discovery.DefaultWeights()))
	views, err := service.Providers(context.Background(), DiscoveryRequest{CapabilityID: capID})
	if err != nil { t.Fatal(err) }
	if len(views) != 1 { t.Fatalf("views=%+v", views) }
	// Compile-time shape is the security property: ProviderView intentionally has no
	// MetadataHash, Capabilities, endpoint, credential or media-reference fields.
}

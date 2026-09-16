package storage

import (
	"context"
	"errors"
	"testing"
	"time"
)

type developerDirectoryDiscoveryStub struct {
	endpoints []ResourceEndpoint
	err       error
	last      ResourceDiscoveryRequest
}

func (s *developerDirectoryDiscoveryStub) DiscoverResources(_ context.Context, req ResourceDiscoveryRequest) ([]ResourceEndpoint, error) {
	s.last = req
	if s.err != nil {
		return nil, s.err
	}
	return append([]ResourceEndpoint(nil), s.endpoints...), nil
}

func TestDeveloperResourceDirectoryDiscoveryIsDeterministicAndNonAuthoritative(t *testing.T) {
	stub := &developerDirectoryDiscoveryStub{endpoints: []ResourceEndpoint{
		{ProviderID: "provider-b", NodeID: "node-b", ServiceID: "store-b", Capability: ResourceCapabilityStore, Priority: 2, Endpoint: "https://b.invalid", State: ResourceServiceRunning},
		{ProviderID: "provider-a", NodeID: "node-a", ServiceID: "store-a", Capability: ResourceCapabilityStore, Priority: 1, Endpoint: "https://a.invalid", State: ResourceServiceRunning},
	}}
	directory := DeveloperResourceDirectory{Discovery: stub}
	result, err := directory.Discover(context.Background(), DeveloperDiscoveryRequest{Capabilities: []ResourceCapability{ResourceCapabilityStore}})
	if err != nil {
		t.Fatal(err)
	}
	if result.Version != DeveloperAPIVersion || result.Authoritative {
		t.Fatalf("unexpected discovery envelope %#v", result)
	}
	if len(result.Resources) != 2 || result.Resources[0].ServiceID != "store-a" || result.Resources[1].ServiceID != "store-b" {
		t.Fatalf("unexpected deterministic ordering %#v", result.Resources)
	}
	for _, resource := range result.Resources {
		if resource.Authoritative {
			t.Fatalf("resource incorrectly marked authoritative %#v", resource)
		}
	}
}

func TestDeveloperResourceDirectoryNormalizesCapabilityRequest(t *testing.T) {
	stub := &developerDirectoryDiscoveryStub{}
	directory := DeveloperResourceDirectory{Discovery: stub}
	_, err := directory.Discover(context.Background(), DeveloperDiscoveryRequest{Capabilities: []ResourceCapability{" STORE ", ResourceCapabilityStore}})
	if err != nil {
		t.Fatal(err)
	}
	if len(stub.last.Capabilities) != 1 || stub.last.Capabilities[0] != ResourceCapabilityStore {
		t.Fatalf("unexpected normalized capabilities %#v", stub.last.Capabilities)
	}
}

func TestDeveloperResourceDirectoryRejectsInvalidCapabilityAndVersion(t *testing.T) {
	directory := DeveloperResourceDirectory{Discovery: &developerDirectoryDiscoveryStub{}}
	if _, err := directory.Discover(context.Background(), DeveloperDiscoveryRequest{Version: "v2", Capabilities: []ResourceCapability{ResourceCapabilityStore}}); !errors.Is(err, ErrDeveloperDiscovery) {
		t.Fatalf("expected version rejection, got %v", err)
	}
	if _, err := directory.Discover(context.Background(), DeveloperDiscoveryRequest{Capabilities: []ResourceCapability{"secret-admin"}}); !errors.Is(err, ErrDeveloperDiscovery) {
		t.Fatalf("expected capability rejection, got %v", err)
	}
}

func TestDeveloperResourceDirectoryBoundsResults(t *testing.T) {
	stub := &developerDirectoryDiscoveryStub{endpoints: []ResourceEndpoint{
		{ProviderID: "provider-a", NodeID: "node-a", ServiceID: "store-a", Capability: ResourceCapabilityStore, Priority: 1, State: ResourceServiceRunning},
		{ProviderID: "provider-b", NodeID: "node-b", ServiceID: "store-b", Capability: ResourceCapabilityStore, Priority: 2, State: ResourceServiceRunning},
	}}
	directory := DeveloperResourceDirectory{Discovery: stub}
	result, err := directory.Discover(context.Background(), DeveloperDiscoveryRequest{Capabilities: []ResourceCapability{ResourceCapabilityStore}, MaxResults: 1})
	if err != nil {
		t.Fatal(err)
	}
	if len(result.Resources) != 1 || result.Resources[0].ServiceID != "store-a" {
		t.Fatalf("unexpected bounded result %#v", result.Resources)
	}
	if _, err := directory.Discover(context.Background(), DeveloperDiscoveryRequest{Capabilities: []ResourceCapability{ResourceCapabilityStore}, MaxResults: DefaultDeveloperDiscoveryMaxResults + 1}); !errors.Is(err, ErrDeveloperDiscovery) {
		t.Fatalf("expected oversized request rejection, got %v", err)
	}
}

func TestDeveloperResourceDirectoryDegradedFiltering(t *testing.T) {
	stub := &developerDirectoryDiscoveryStub{endpoints: []ResourceEndpoint{
		{ProviderID: "provider-a", NodeID: "node-a", ServiceID: "store-a", Capability: ResourceCapabilityStore, Priority: 1, State: ResourceServiceRunning},
		{ProviderID: "provider-b", NodeID: "node-b", ServiceID: "store-b", Capability: ResourceCapabilityStore, Priority: 2, State: ResourceServiceDegraded},
	}}
	directory := DeveloperResourceDirectory{Discovery: stub}
	without, err := directory.Discover(context.Background(), DeveloperDiscoveryRequest{Capabilities: []ResourceCapability{ResourceCapabilityStore}})
	if err != nil {
		t.Fatal(err)
	}
	if len(without.Resources) != 1 || without.Resources[0].ServiceID != "store-a" {
		t.Fatalf("degraded resource leaked into default discovery %#v", without.Resources)
	}
	with, err := directory.Discover(context.Background(), DeveloperDiscoveryRequest{Capabilities: []ResourceCapability{ResourceCapabilityStore}, IncludeDegraded: true})
	if err != nil {
		t.Fatal(err)
	}
	if len(with.Resources) != 2 || with.Resources[1].Health != ResourceHealthDegraded {
		t.Fatalf("unexpected degraded discovery %#v", with.Resources)
	}
}

func TestDeveloperResourceDirectoryRejectsNonServingStateFromDiscovery(t *testing.T) {
	stub := &developerDirectoryDiscoveryStub{endpoints: []ResourceEndpoint{{ProviderID: "provider-a", NodeID: "node-a", ServiceID: "store-a", Capability: ResourceCapabilityStore, State: ResourceServiceFailed}}}
	directory := DeveloperResourceDirectory{Discovery: stub}
	if _, err := directory.Discover(context.Background(), DeveloperDiscoveryRequest{Capabilities: []ResourceCapability{ResourceCapabilityStore}, IncludeDegraded: true}); !errors.Is(err, ErrDeveloperDiscovery) {
		t.Fatalf("expected invalid state rejection, got %v", err)
	}
}

func TestDeveloperResourceDirectoryStatusProjectsRuntimeWithoutAuthority(t *testing.T) {
	runtime, err := NewResourceNetworkRuntime("provider-1", "node-1")
	if err != nil {
		t.Fatal(err)
	}
	if err := runtime.Register(ResourceServiceDescriptor{ProviderID: "provider-1", NodeID: "node-1", ServiceID: "store-a", Capabilities: []ResourceCapability{ResourceCapabilityStore}}); err != nil {
		t.Fatal(err)
	}
	if err := runtime.Transition("store-a", ResourceServiceStarting); err != nil {
		t.Fatal(err)
	}
	if err := runtime.Transition("store-a", ResourceServiceRunning); err != nil {
		t.Fatal(err)
	}
	observed := time.Date(2026, 9, 15, 20, 30, 0, 0, time.UTC)
	status, err := (DeveloperResourceDirectory{Runtime: runtime}).Status(observed)
	if err != nil {
		t.Fatal(err)
	}
	if status.Authoritative || status.ProviderID != "provider-1" || status.NodeID != "node-1" || !status.Ready || status.Degraded {
		t.Fatalf("unexpected status %#v", status)
	}
	if !status.ObservedAt.Equal(observed) || len(status.Services) != 1 || status.Services[0].Health != ResourceHealthHealthy {
		t.Fatalf("unexpected service status %#v", status)
	}
	status.Services[0].Capabilities[0] = ResourceCapabilityRelay
	fresh, err := (DeveloperResourceDirectory{Runtime: runtime}).Status(observed)
	if err != nil {
		t.Fatal(err)
	}
	if fresh.Services[0].Capabilities[0] != ResourceCapabilityStore {
		t.Fatal("developer status aliases runtime capability storage")
	}
}

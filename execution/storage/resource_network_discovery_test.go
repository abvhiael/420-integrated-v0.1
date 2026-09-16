package storage

import (
	"context"
	"errors"
	"testing"
)

type resourceDiscoverySourceStub struct{ id string }
func (s resourceDiscoverySourceStub) FetchGatewayObject(context.Context, GatewayRequest) ([]byte, error) { return []byte(s.id), nil }

func TestRuntimeResourceDiscoveryFiltersByLifecycleAndCapability(t *testing.T) {
	runtime, err := NewResourceNetworkRuntime("provider-1", "node-1")
	if err != nil { t.Fatal(err) }
	services := []ResourceServiceDescriptor{
		{ProviderID:"provider-1", NodeID:"node-1", ServiceID:"cache-b", Capabilities:[]ResourceCapability{ResourceCapabilityCache}},
		{ProviderID:"provider-1", NodeID:"node-1", ServiceID:"store-a", Capabilities:[]ResourceCapability{ResourceCapabilityStore}},
		{ProviderID:"provider-1", NodeID:"node-1", ServiceID:"repair-a", Capabilities:[]ResourceCapability{ResourceCapabilityRepair}},
	}
	for _, service := range services { if err := runtime.Register(service); err != nil { t.Fatal(err) } }
	for _, id := range []string{"cache-b","store-a"} {
		if err := runtime.Transition(id, ResourceServiceStarting); err != nil { t.Fatal(err) }
		if err := runtime.Transition(id, ResourceServiceRunning); err != nil { t.Fatal(err) }
	}
	if err := runtime.Transition("repair-a", ResourceServiceStarting); err != nil { t.Fatal(err) }
	discovery, err := NewRuntimeResourceDiscovery(runtime)
	if err != nil { t.Fatal(err) }
	if err := discovery.Bind("cache-b", ResourceCapabilityCache, 20, "https://cache-b", resourceDiscoverySourceStub{id:"cache"}); err != nil { t.Fatal(err) }
	if err := discovery.Bind("store-a", ResourceCapabilityStore, 10, "https://store-a", resourceDiscoverySourceStub{id:"store"}); err != nil { t.Fatal(err) }
	if err := discovery.Bind("repair-a", ResourceCapabilityRepair, 5, "https://repair-a", resourceDiscoverySourceStub{id:"repair"}); err != nil { t.Fatal(err) }

	got, err := discovery.DiscoverResources(context.Background(), ResourceDiscoveryRequest{Capabilities:[]ResourceCapability{ResourceCapabilityStore, ResourceCapabilityCache, ResourceCapabilityRepair}})
	if err != nil { t.Fatal(err) }
	if len(got) != 2 { t.Fatalf("endpoints=%d", len(got)) }
	if got[0].Capability != ResourceCapabilityCache || got[0].ServiceID != "cache-b" { t.Fatalf("first=%+v", got[0]) }
	if got[1].Capability != ResourceCapabilityStore || got[1].ServiceID != "store-a" { t.Fatalf("second=%+v", got[1]) }
}

func TestRuntimeResourceDiscoveryDeterministicPriorityOrdering(t *testing.T) {
	runtime, err := NewResourceNetworkRuntime("provider-1", "node-1")
	if err != nil { t.Fatal(err) }
	for _, id := range []string{"cache-z","cache-a","cache-m"} {
		if err := runtime.Register(ResourceServiceDescriptor{ProviderID:"provider-1",NodeID:"node-1",ServiceID:id,Capabilities:[]ResourceCapability{ResourceCapabilityCache}}); err != nil { t.Fatal(err) }
		if err := runtime.Transition(id, ResourceServiceStarting); err != nil { t.Fatal(err) }
		if err := runtime.Transition(id, ResourceServiceRunning); err != nil { t.Fatal(err) }
	}
	discovery, _ := NewRuntimeResourceDiscovery(runtime)
	if err := discovery.Bind("cache-z", ResourceCapabilityCache, 20, "z", resourceDiscoverySourceStub{id:"z"}); err != nil { t.Fatal(err) }
	if err := discovery.Bind("cache-a", ResourceCapabilityCache, 10, "a", resourceDiscoverySourceStub{id:"a"}); err != nil { t.Fatal(err) }
	if err := discovery.Bind("cache-m", ResourceCapabilityCache, 10, "m", resourceDiscoverySourceStub{id:"m"}); err != nil { t.Fatal(err) }
	got, err := discovery.DiscoverResources(context.Background(), ResourceDiscoveryRequest{Capabilities:[]ResourceCapability{ResourceCapabilityCache}})
	if err != nil { t.Fatal(err) }
	if len(got) != 3 || got[0].ServiceID != "cache-a" || got[1].ServiceID != "cache-m" || got[2].ServiceID != "cache-z" { t.Fatalf("order=%v", []string{got[0].ServiceID,got[1].ServiceID,got[2].ServiceID}) }
}

func TestRuntimeResourceDiscoveryRejectsInvalidBindingsAndRequests(t *testing.T) {
	runtime, _ := NewResourceNetworkRuntime("provider-1", "node-1")
	if err := runtime.Register(ResourceServiceDescriptor{ProviderID:"provider-1",NodeID:"node-1",ServiceID:"store-a",Capabilities:[]ResourceCapability{ResourceCapabilityStore}}); err != nil { t.Fatal(err) }
	discovery, _ := NewRuntimeResourceDiscovery(runtime)
	if err := discovery.Bind("store-a", ResourceCapabilityCache, 0, "x", resourceDiscoverySourceStub{}); !errors.Is(err, ErrResourceDiscovery) { t.Fatalf("wrong capability err=%v", err) }
	if err := discovery.Bind("missing", ResourceCapabilityStore, 0, "x", resourceDiscoverySourceStub{}); !errors.Is(err, ErrResourceDiscovery) { t.Fatalf("missing service err=%v", err) }
	if _, err := discovery.DiscoverResources(context.Background(), ResourceDiscoveryRequest{}); !errors.Is(err, ErrResourceDiscovery) { t.Fatalf("empty request err=%v", err) }
	if _, err := discovery.DiscoverResources(context.Background(), ResourceDiscoveryRequest{Capabilities:[]ResourceCapability{"mystery"}}); !errors.Is(err, ErrResourceDiscovery) { t.Fatalf("unknown capability err=%v", err) }
}

func TestRuntimeResourceDiscoveryDegradedIsExplicitOptIn(t *testing.T) {
	runtime, _ := NewResourceNetworkRuntime("provider-1", "node-1")
	if err := runtime.Register(ResourceServiceDescriptor{ProviderID:"provider-1",NodeID:"node-1",ServiceID:"cache-a",Capabilities:[]ResourceCapability{ResourceCapabilityCache}}); err != nil { t.Fatal(err) }
	if err := runtime.Transition("cache-a", ResourceServiceStarting); err != nil { t.Fatal(err) }
	if err := runtime.Transition("cache-a", ResourceServiceRunning); err != nil { t.Fatal(err) }
	if err := runtime.Transition("cache-a", ResourceServiceDegraded); err != nil { t.Fatal(err) }
	discovery, _ := NewRuntimeResourceDiscovery(runtime)
	if err := discovery.Bind("cache-a", ResourceCapabilityCache, 0, "cache", resourceDiscoverySourceStub{}); err != nil { t.Fatal(err) }
	got, err := discovery.DiscoverResources(context.Background(), ResourceDiscoveryRequest{Capabilities:[]ResourceCapability{ResourceCapabilityCache}})
	if err != nil { t.Fatal(err) }
	if len(got) != 0 { t.Fatalf("unexpected degraded endpoint: %+v", got) }
	got, err = discovery.DiscoverResources(context.Background(), ResourceDiscoveryRequest{Capabilities:[]ResourceCapability{ResourceCapabilityCache}, IncludeDegraded:true})
	if err != nil { t.Fatal(err) }
	if len(got) != 1 || got[0].State != ResourceServiceDegraded { t.Fatalf("degraded endpoints=%+v", got) }
}

func TestResourceGatewayDiscoveryAdaptsOnlyRunningCacheAndStoreSources(t *testing.T) {
	runtime, _ := NewResourceNetworkRuntime("provider-1", "node-1")
	for _, descriptor := range []ResourceServiceDescriptor{
		{ProviderID:"provider-1",NodeID:"node-1",ServiceID:"cache-a",Capabilities:[]ResourceCapability{ResourceCapabilityCache}},
		{ProviderID:"provider-1",NodeID:"node-1",ServiceID:"store-a",Capabilities:[]ResourceCapability{ResourceCapabilityStore}},
		{ProviderID:"provider-1",NodeID:"node-1",ServiceID:"relay-a",Capabilities:[]ResourceCapability{ResourceCapabilityRelay}},
	} {
		if err := runtime.Register(descriptor); err != nil { t.Fatal(err) }
		if err := runtime.Transition(descriptor.ServiceID, ResourceServiceStarting); err != nil { t.Fatal(err) }
		if err := runtime.Transition(descriptor.ServiceID, ResourceServiceRunning); err != nil { t.Fatal(err) }
	}
	discovery, _ := NewRuntimeResourceDiscovery(runtime)
	if err := discovery.Bind("cache-a", ResourceCapabilityCache, 1, "cache", resourceDiscoverySourceStub{id:"cache"}); err != nil { t.Fatal(err) }
	if err := discovery.Bind("store-a", ResourceCapabilityStore, 2, "store", resourceDiscoverySourceStub{id:"store"}); err != nil { t.Fatal(err) }
	if err := discovery.Bind("relay-a", ResourceCapabilityRelay, 0, "relay", resourceDiscoverySourceStub{id:"relay"}); err != nil { t.Fatal(err) }
	adapter := ResourceGatewayDiscovery{Discovery: discovery}
	got, err := adapter.DiscoverGatewaySources(context.Background(), GatewayRequest{})
	if err != nil { t.Fatal(err) }
	if len(got) != 2 { t.Fatalf("candidates=%d", len(got)) }
	if got[0].Capability != GatewayCapabilityCache || got[0].ProviderID != "provider-1" || !got[0].Active { t.Fatalf("cache=%+v", got[0]) }
	if got[1].Capability != GatewayCapabilityStore || got[1].ProviderID != "provider-1" || !got[1].Active { t.Fatalf("store=%+v", got[1]) }
}

func TestRuntimeResourceDiscoveryHonorsCancellation(t *testing.T) {
	runtime, _ := NewResourceNetworkRuntime("provider-1", "node-1")
	discovery, _ := NewRuntimeResourceDiscovery(runtime)
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	_, err := discovery.DiscoverResources(ctx, ResourceDiscoveryRequest{Capabilities:[]ResourceCapability{ResourceCapabilityStore}})
	if !errors.Is(err, context.Canceled) { t.Fatalf("err=%v", err) }
}

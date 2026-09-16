package storage

import "testing"

func TestResourceNetworkRegisterNormalizesCapabilities(t *testing.T) {
	runtime, err := NewResourceNetworkRuntime("provider-1", "node-1")
	if err != nil {
		t.Fatal(err)
	}
	if err := runtime.Register(ResourceServiceDescriptor{
		ProviderID: " provider-1 ",
		NodeID:     "node-1",
		ServiceID:  "gateway-a",
		Capabilities: []ResourceCapability{
			ResourceCapabilityGateway,
			ResourceCapabilityCache,
			ResourceCapabilityGateway,
		},
	}); err != nil {
		t.Fatal(err)
	}
	snapshot := runtime.Snapshot()
	if len(snapshot) != 1 {
		t.Fatalf("services=%d", len(snapshot))
	}
	got := snapshot[0]
	if got.State != ResourceServiceRegistered {
		t.Fatalf("state=%s", got.State)
	}
	if len(got.Descriptor.Capabilities) != 2 || got.Descriptor.Capabilities[0] != ResourceCapabilityCache || got.Descriptor.Capabilities[1] != ResourceCapabilityGateway {
		t.Fatalf("capabilities=%v", got.Descriptor.Capabilities)
	}
}

func TestResourceNetworkRejectsDuplicateAndForeignIdentity(t *testing.T) {
	runtime, err := NewResourceNetworkRuntime("provider-1", "node-1")
	if err != nil {
		t.Fatal(err)
	}
	descriptor := ResourceServiceDescriptor{
		ProviderID: "provider-1",
		NodeID:     "node-1",
		ServiceID:  "store-a",
		Capabilities: []ResourceCapability{ResourceCapabilityStore},
	}
	if err := runtime.Register(descriptor); err != nil {
		t.Fatal(err)
	}
	if err := runtime.Register(descriptor); err == nil {
		t.Fatal("expected duplicate registration rejection")
	}
	foreign := descriptor
	foreign.ServiceID = "store-b"
	foreign.ProviderID = "provider-2"
	if err := runtime.Register(foreign); err == nil {
		t.Fatal("expected foreign provider rejection")
	}
}

func TestResourceNetworkRejectsUnknownCapability(t *testing.T) {
	runtime, err := NewResourceNetworkRuntime("provider-1", "node-1")
	if err != nil {
		t.Fatal(err)
	}
	if err := runtime.Register(ResourceServiceDescriptor{
		ProviderID:   "provider-1",
		NodeID:       "node-1",
		ServiceID:    "mystery",
		Capabilities: []ResourceCapability{"unknown"},
	}); err == nil {
		t.Fatal("expected unknown capability rejection")
	}
}

func TestResourceNetworkLifecycleTransitions(t *testing.T) {
	runtime, err := NewResourceNetworkRuntime("provider-1", "node-1")
	if err != nil {
		t.Fatal(err)
	}
	if err := runtime.Register(ResourceServiceDescriptor{
		ProviderID: "provider-1",
		NodeID:     "node-1",
		ServiceID:  "cache-a",
		Capabilities: []ResourceCapability{ResourceCapabilityCache},
	}); err != nil {
		t.Fatal(err)
	}
	if err := runtime.Transition("cache-a", ResourceServiceRunning); err == nil {
		t.Fatal("expected registered-to-running transition rejection")
	}
	for _, state := range []ResourceServiceState{ResourceServiceStarting, ResourceServiceRunning, ResourceServiceDegraded, ResourceServiceRunning, ResourceServiceStopped, ResourceServiceStarting, ResourceServiceFailed} {
		if err := runtime.Transition("cache-a", state); err != nil {
			t.Fatalf("transition to %s: %v", state, err)
		}
	}
}

func TestResourceNetworkSnapshotAndCapabilityLookupAreDeterministic(t *testing.T) {
	runtime, err := NewResourceNetworkRuntime("provider-1", "node-1")
	if err != nil {
		t.Fatal(err)
	}
	for _, descriptor := range []ResourceServiceDescriptor{
		{ProviderID: "provider-1", NodeID: "node-1", ServiceID: "store-z", Capabilities: []ResourceCapability{ResourceCapabilityStore}},
		{ProviderID: "provider-1", NodeID: "node-1", ServiceID: "cache-a", Capabilities: []ResourceCapability{ResourceCapabilityCache, ResourceCapabilityGateway}},
		{ProviderID: "provider-1", NodeID: "node-1", ServiceID: "gateway-m", Capabilities: []ResourceCapability{ResourceCapabilityGateway}},
	} {
		if err := runtime.Register(descriptor); err != nil {
			t.Fatal(err)
		}
	}
	snapshot := runtime.Snapshot()
	if len(snapshot) != 3 || snapshot[0].Descriptor.ServiceID != "cache-a" || snapshot[1].Descriptor.ServiceID != "gateway-m" || snapshot[2].Descriptor.ServiceID != "store-z" {
		t.Fatalf("snapshot order=%v", []string{snapshot[0].Descriptor.ServiceID, snapshot[1].Descriptor.ServiceID, snapshot[2].Descriptor.ServiceID})
	}
	gateways := runtime.ServicesFor(ResourceCapabilityGateway)
	if len(gateways) != 2 || gateways[0].Descriptor.ServiceID != "cache-a" || gateways[1].Descriptor.ServiceID != "gateway-m" {
		t.Fatalf("gateway services=%v", gateways)
	}
}

func TestResourceNetworkSnapshotDoesNotLeakMutableCapabilities(t *testing.T) {
	runtime, err := NewResourceNetworkRuntime("provider-1", "node-1")
	if err != nil {
		t.Fatal(err)
	}
	if err := runtime.Register(ResourceServiceDescriptor{
		ProviderID: "provider-1",
		NodeID: "node-1",
		ServiceID: "relay-a",
		Capabilities: []ResourceCapability{ResourceCapabilityRelay},
	}); err != nil {
		t.Fatal(err)
	}
	first := runtime.Snapshot()
	first[0].Descriptor.Capabilities[0] = ResourceCapabilityStore
	second := runtime.Snapshot()
	if second[0].Descriptor.Capabilities[0] != ResourceCapabilityRelay {
		t.Fatalf("runtime state mutated through snapshot: %v", second[0].Descriptor.Capabilities)
	}
}

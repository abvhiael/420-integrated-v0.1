package storage

import (
	"context"
	"testing"
	"time"
)

func TestResourceNetworkStatusSummarizesLifecycleAndCapabilities(t *testing.T) {
	runtime, err := NewResourceNetworkRuntime("provider-1", "node-1")
	if err != nil { t.Fatal(err) }
	for _, descriptor := range []ResourceServiceDescriptor{
		{ProviderID:"provider-1",NodeID:"node-1",ServiceID:"store-a",Capabilities:[]ResourceCapability{ResourceCapabilityStore}},
		{ProviderID:"provider-1",NodeID:"node-1",ServiceID:"cache-a",Capabilities:[]ResourceCapability{ResourceCapabilityCache}},
		{ProviderID:"provider-1",NodeID:"node-1",ServiceID:"gateway-a",Capabilities:[]ResourceCapability{ResourceCapabilityGateway}},
	} {
		if err := runtime.Register(descriptor); err != nil { t.Fatal(err) }
	}
	if err := runtime.Transition("store-a", ResourceServiceStarting); err != nil { t.Fatal(err) }
	if err := runtime.Transition("store-a", ResourceServiceRunning); err != nil { t.Fatal(err) }
	if err := runtime.Transition("cache-a", ResourceServiceStarting); err != nil { t.Fatal(err) }
	if err := runtime.Transition("cache-a", ResourceServiceRunning); err != nil { t.Fatal(err) }
	if err := runtime.Transition("cache-a", ResourceServiceDegraded); err != nil { t.Fatal(err) }
	if err := runtime.Transition("gateway-a", ResourceServiceStarting); err != nil { t.Fatal(err) }
	if err := runtime.Transition("gateway-a", ResourceServiceFailed); err != nil { t.Fatal(err) }

	now := time.Date(2026,9,15,22,0,0,0,time.UTC)
	status := runtime.Status(now)
	if status.ProviderID != "provider-1" || status.NodeID != "node-1" { t.Fatalf("identity=%+v", status) }
	if status.Ready { t.Fatal("expected failed service to make aggregate not ready") }
	if !status.Degraded { t.Fatal("expected degraded aggregate") }
	if !status.ObservedAt.Equal(now) { t.Fatalf("observed_at=%s", status.ObservedAt) }
	if len(status.Services) != 3 { t.Fatalf("services=%d", len(status.Services)) }
	if status.Services[0].ServiceID != "cache-a" || status.Services[1].ServiceID != "gateway-a" || status.Services[2].ServiceID != "store-a" {
		t.Fatalf("order=%v", []string{status.Services[0].ServiceID,status.Services[1].ServiceID,status.Services[2].ServiceID})
	}
	if status.Services[0].Health != ResourceHealthDegraded || status.Services[1].Health != ResourceHealthFailed || status.Services[2].Health != ResourceHealthHealthy {
		t.Fatalf("health=%v %v %v", status.Services[0].Health,status.Services[1].Health,status.Services[2].Health)
	}
}

func TestResourceNetworkStatusCapabilityCounts(t *testing.T) {
	runtime, _ := NewResourceNetworkRuntime("provider-1", "node-1")
	for _, d := range []ResourceServiceDescriptor{
		{ProviderID:"provider-1",NodeID:"node-1",ServiceID:"multi-a",Capabilities:[]ResourceCapability{ResourceCapabilityStore,ResourceCapabilityRelay}},
		{ProviderID:"provider-1",NodeID:"node-1",ServiceID:"relay-b",Capabilities:[]ResourceCapability{ResourceCapabilityRelay}},
	} {
		if err := runtime.Register(d); err != nil { t.Fatal(err) }
	}
	if err := runtime.Transition("multi-a", ResourceServiceStarting); err != nil { t.Fatal(err) }
	if err := runtime.Transition("multi-a", ResourceServiceRunning); err != nil { t.Fatal(err) }
	status := runtime.Status(time.Now())
	if len(status.Capabilities) != 2 { t.Fatalf("capabilities=%v", status.Capabilities) }
	if status.Capabilities[0].Capability != ResourceCapabilityStore || status.Capabilities[0].Running != 1 { t.Fatalf("store=%+v", status.Capabilities[0]) }
	if status.Capabilities[1].Capability != ResourceCapabilityRelay || status.Capabilities[1].Running != 1 || status.Capabilities[1].Unavailable != 1 { t.Fatalf("relay=%+v", status.Capabilities[1]) }
}

func TestResourceMetricsArePerServiceAndIgnoreInvalidObservations(t *testing.T) {
	metrics := NewResourceMetrics()
	ctx := context.Background()
	metrics.ObserveResource(ctx, ResourceObservation{ServiceID:"store-a",Capability:ResourceCapabilityStore,Kind:ResourceObservationRequest})
	metrics.ObserveResource(ctx, ResourceObservation{ServiceID:"STORE-A",Capability:ResourceCapabilityStore,Kind:ResourceObservationSuccess,Duration:25*time.Millisecond,Bytes:420})
	metrics.ObserveResource(ctx, ResourceObservation{ServiceID:"store-a",Capability:ResourceCapabilityStore,Kind:ResourceObservationFailure,Duration:5*time.Millisecond})
	metrics.ObserveResource(ctx, ResourceObservation{ServiceID:"",Capability:ResourceCapabilityStore,Kind:ResourceObservationRequest})
	metrics.ObserveResource(ctx, ResourceObservation{ServiceID:"store-a",Capability:"unknown",Kind:ResourceObservationRequest})
	metrics.ObserveResource(ctx, ResourceObservation{ServiceID:"store-a",Capability:ResourceCapabilityStore,Kind:"unknown"})

	snapshot := metrics.Snapshot()
	got := snapshot["store-a"]
	if got.Requests != 1 || got.Successes != 1 || got.Failures != 1 || got.ResponseBytes != 420 {
		t.Fatalf("metrics=%+v", got)
	}
	if got.CumulativeNanos != uint64(30*time.Millisecond) { t.Fatalf("nanos=%d", got.CumulativeNanos) }
}

func TestResourceMetricsSnapshotIsCopySafe(t *testing.T) {
	metrics := NewResourceMetrics()
	metrics.ObserveResource(context.Background(), ResourceObservation{ServiceID:"cache-a",Capability:ResourceCapabilityCache,Kind:ResourceObservationRequest})
	first := metrics.Snapshot()
	first["cache-a"] = ResourceObservationMetrics{Requests:99}
	second := metrics.Snapshot()
	if second["cache-a"].Requests != 1 { t.Fatalf("metrics mutated: %+v", second["cache-a"]) }
}

func TestResourceStatusDoesNotMutateRuntimeCapabilities(t *testing.T) {
	runtime, _ := NewResourceNetworkRuntime("provider-1", "node-1")
	if err := runtime.Register(ResourceServiceDescriptor{ProviderID:"provider-1",NodeID:"node-1",ServiceID:"relay-a",Capabilities:[]ResourceCapability{ResourceCapabilityRelay}}); err != nil { t.Fatal(err) }
	status := runtime.Status(time.Now())
	status.Services[0].Capabilities[0] = ResourceCapabilityStore
	services := runtime.ServicesFor(ResourceCapabilityRelay)
	if len(services) != 1 { t.Fatalf("relay services=%d", len(services)) }
}

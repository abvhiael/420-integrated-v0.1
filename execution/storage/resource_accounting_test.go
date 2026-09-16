package storage

import (
	"context"
	"errors"
	"testing"
)

type resourceAccountingReaderStub struct {
	snapshot ResourceAccountingSnapshot
	err      error
	calls    int
}

func (s *resourceAccountingReaderStub) ReadResourceAccounting(ctx context.Context, query ResourceAccountingQuery) (ResourceAccountingSnapshot, error) {
	s.calls++
	if err := ctx.Err(); err != nil {
		return ResourceAccountingSnapshot{}, err
	}
	if s.err != nil {
		return ResourceAccountingSnapshot{}, s.err
	}
	return s.snapshot, nil
}

func newAccountingRuntime(t *testing.T, capability ResourceCapability, state ResourceServiceState) *ResourceNetworkRuntime {
	t.Helper()
	runtime, err := NewResourceNetworkRuntime("provider-1", "node-1")
	if err != nil {
		t.Fatal(err)
	}
	if err := runtime.Register(ResourceServiceDescriptor{
		ProviderID:   "provider-1",
		NodeID:       "node-1",
		ServiceID:    "service-a",
		Capabilities: []ResourceCapability{capability},
	}); err != nil {
		t.Fatal(err)
	}
	if state != ResourceServiceRegistered {
		if err := runtime.Transition("service-a", ResourceServiceStarting); err != nil {
			t.Fatal(err)
		}
		if state == ResourceServiceRunning {
			if err := runtime.Transition("service-a", ResourceServiceRunning); err != nil {
				t.Fatal(err)
			}
		} else if state == ResourceServiceDegraded {
			if err := runtime.Transition("service-a", ResourceServiceRunning); err != nil {
				t.Fatal(err)
			}
			if err := runtime.Transition("service-a", ResourceServiceDegraded); err != nil {
				t.Fatal(err)
			}
		}
	}
	return runtime
}

func TestResourceAccountingReadValidatesCanonicalIdentity(t *testing.T) {
	runtime := newAccountingRuntime(t, ResourceCapabilityStore, ResourceServiceRunning)
	reader := &resourceAccountingReaderStub{snapshot: ResourceAccountingSnapshot{
		ProviderID:   "provider-1",
		NodeID:       "node-1",
		ServiceID:    "service-a",
		Capability:   ResourceCapabilityStore,
		ReferenceID:  "agreement-1",
		SettlementID: "settlement-1",
		State:        ResourceEconomicSettled,
		Amount420:    "420",
	}}
	adapter := ResourceAccountingAdapter{Runtime: runtime, Reader: reader}
	snapshot, err := adapter.Read(context.Background(), ResourceAccountingQuery{ServiceID: "service-a", Capability: ResourceCapabilityStore, ReferenceID: "agreement-1"})
	if err != nil {
		t.Fatal(err)
	}
	if snapshot.SettlementID != "settlement-1" || reader.calls != 1 {
		t.Fatalf("snapshot=%+v calls=%d", snapshot, reader.calls)
	}
}

func TestResourceAccountingRejectsGatewayEconomicAuthority(t *testing.T) {
	runtime := newAccountingRuntime(t, ResourceCapabilityGateway, ResourceServiceRunning)
	reader := &resourceAccountingReaderStub{}
	adapter := ResourceAccountingAdapter{Runtime: runtime, Reader: reader}
	_, err := adapter.Read(context.Background(), ResourceAccountingQuery{ServiceID: "service-a", Capability: ResourceCapabilityGateway, ReferenceID: "object-1"})
	if !errors.Is(err, ErrResourceAccounting) {
		t.Fatalf("err=%v", err)
	}
	if reader.calls != 0 {
		t.Fatalf("reader calls=%d", reader.calls)
	}
}

func TestResourceAccountingRejectsInactiveService(t *testing.T) {
	runtime := newAccountingRuntime(t, ResourceCapabilityStore, ResourceServiceRegistered)
	reader := &resourceAccountingReaderStub{}
	adapter := ResourceAccountingAdapter{Runtime: runtime, Reader: reader}
	_, err := adapter.Read(context.Background(), ResourceAccountingQuery{ServiceID: "service-a", Capability: ResourceCapabilityStore, ReferenceID: "agreement-1"})
	if !errors.Is(err, ErrResourceAccounting) {
		t.Fatalf("err=%v", err)
	}
	if reader.calls != 0 {
		t.Fatalf("reader calls=%d", reader.calls)
	}
}

func TestResourceAccountingAllowsDegradedReadOnlyProjection(t *testing.T) {
	runtime := newAccountingRuntime(t, ResourceCapabilityCache, ResourceServiceDegraded)
	reader := &resourceAccountingReaderStub{snapshot: ResourceAccountingSnapshot{
		ProviderID:  "provider-1",
		NodeID:      "node-1",
		ServiceID:   "service-a",
		Capability:  ResourceCapabilityCache,
		ReferenceID: "cache-1",
		State:       ResourceEconomicPending,
	}}
	adapter := ResourceAccountingAdapter{Runtime: runtime, Reader: reader}
	if _, err := adapter.Read(context.Background(), ResourceAccountingQuery{ServiceID: "service-a", Capability: ResourceCapabilityCache, ReferenceID: "cache-1"}); err != nil {
		t.Fatal(err)
	}
}

func TestResourceAccountingRejectsMismatchedReaderSnapshot(t *testing.T) {
	runtime := newAccountingRuntime(t, ResourceCapabilityRepair, ResourceServiceRunning)
	reader := &resourceAccountingReaderStub{snapshot: ResourceAccountingSnapshot{
		ProviderID:  "provider-2",
		NodeID:      "node-1",
		ServiceID:   "service-a",
		Capability:  ResourceCapabilityRepair,
		ReferenceID: "repair-1",
		State:       ResourceEconomicPending,
	}}
	adapter := ResourceAccountingAdapter{Runtime: runtime, Reader: reader}
	_, err := adapter.Read(context.Background(), ResourceAccountingQuery{ServiceID: "service-a", Capability: ResourceCapabilityRepair, ReferenceID: "repair-1"})
	if !errors.Is(err, ErrResourceAccounting) {
		t.Fatalf("err=%v", err)
	}
}

func TestResourceAccountingSettledRequiresSettlementID(t *testing.T) {
	runtime := newAccountingRuntime(t, ResourceCapabilityRelay, ResourceServiceRunning)
	reader := &resourceAccountingReaderStub{snapshot: ResourceAccountingSnapshot{
		ProviderID:  "provider-1",
		NodeID:      "node-1",
		ServiceID:   "service-a",
		Capability:  ResourceCapabilityRelay,
		ReferenceID: "relay-1",
		State:       ResourceEconomicSettled,
	}}
	adapter := ResourceAccountingAdapter{Runtime: runtime, Reader: reader}
	_, err := adapter.Read(context.Background(), ResourceAccountingQuery{ServiceID: "service-a", Capability: ResourceCapabilityRelay, ReferenceID: "relay-1"})
	if !errors.Is(err, ErrResourceAccounting) {
		t.Fatalf("err=%v", err)
	}
}

func TestResourceAccountingBatchIsDeterministic(t *testing.T) {
	runtime, err := NewResourceNetworkRuntime("provider-1", "node-1")
	if err != nil {
		t.Fatal(err)
	}
	for _, d := range []ResourceServiceDescriptor{
		{ProviderID: "provider-1", NodeID: "node-1", ServiceID: "store-z", Capabilities: []ResourceCapability{ResourceCapabilityStore}},
		{ProviderID: "provider-1", NodeID: "node-1", ServiceID: "cache-a", Capabilities: []ResourceCapability{ResourceCapabilityCache}},
	} {
		if err := runtime.Register(d); err != nil {
			t.Fatal(err)
		}
		if err := runtime.Transition(d.ServiceID, ResourceServiceStarting); err != nil {
			t.Fatal(err)
		}
		if err := runtime.Transition(d.ServiceID, ResourceServiceRunning); err != nil {
			t.Fatal(err)
		}
	}
	reader := ResourceAccountingReaderFunc(func(ctx context.Context, query ResourceAccountingQuery) (ResourceAccountingSnapshot, error) {
		return ResourceAccountingSnapshot{ProviderID: "provider-1", NodeID: "node-1", ServiceID: query.ServiceID, Capability: query.Capability, ReferenceID: query.ReferenceID, State: ResourceEconomicPending}, nil
	})
	batch := ResourceAccountingBatchAdapter{Adapter: ResourceAccountingAdapter{Runtime: runtime, Reader: reader}}
	out, err := batch.ReadAll(context.Background(), []ResourceAccountingQuery{
		{ServiceID: "store-z", Capability: ResourceCapabilityStore, ReferenceID: "b"},
		{ServiceID: "cache-a", Capability: ResourceCapabilityCache, ReferenceID: "a"},
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(out) != 2 || out[0].Capability != ResourceCapabilityCache || out[1].Capability != ResourceCapabilityStore {
		t.Fatalf("out=%+v", out)
	}
}

type ResourceAccountingReaderFunc func(context.Context, ResourceAccountingQuery) (ResourceAccountingSnapshot, error)

func (f ResourceAccountingReaderFunc) ReadResourceAccounting(ctx context.Context, query ResourceAccountingQuery) (ResourceAccountingSnapshot, error) {
	return f(ctx, query)
}

func TestResourceAccountingCancellationStopsBeforeReader(t *testing.T) {
	runtime := newAccountingRuntime(t, ResourceCapabilityStore, ResourceServiceRunning)
	reader := &resourceAccountingReaderStub{}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	_, err := (ResourceAccountingAdapter{Runtime: runtime, Reader: reader}).Read(ctx, ResourceAccountingQuery{ServiceID: "service-a", Capability: ResourceCapabilityStore, ReferenceID: "agreement-1"})
	if !errors.Is(err, context.Canceled) {
		t.Fatalf("err=%v", err)
	}
	if reader.calls != 0 {
		t.Fatalf("reader calls=%d", reader.calls)
	}
}

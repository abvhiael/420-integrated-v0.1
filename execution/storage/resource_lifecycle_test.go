package storage

import (
	"context"
	"errors"
	"reflect"
	"testing"
)

type lifecycleControllerStub struct {
	id        string
	events    *[]string
	startErr  error
	stopErr   error
	startSeen int
	stopSeen  int
}

func (s *lifecycleControllerStub) Start(context.Context) error {
	s.startSeen++
	if s.events != nil {
		*s.events = append(*s.events, "start:"+s.id)
	}
	return s.startErr
}

func (s *lifecycleControllerStub) Stop(context.Context) error {
	s.stopSeen++
	if s.events != nil {
		*s.events = append(*s.events, "stop:"+s.id)
	}
	return s.stopErr
}

func newLifecycleRuntime(t *testing.T) *ResourceNetworkRuntime {
	t.Helper()
	runtime, err := NewResourceNetworkRuntime("provider-1", "node-1")
	if err != nil {
		t.Fatal(err)
	}
	for _, descriptor := range []ResourceServiceDescriptor{
		{ProviderID: "provider-1", NodeID: "node-1", ServiceID: "store", Capabilities: []ResourceCapability{ResourceCapabilityStore}},
		{ProviderID: "provider-1", NodeID: "node-1", ServiceID: "cache", Capabilities: []ResourceCapability{ResourceCapabilityCache}},
		{ProviderID: "provider-1", NodeID: "node-1", ServiceID: "gateway", Capabilities: []ResourceCapability{ResourceCapabilityGateway}},
	} {
		if err := runtime.Register(descriptor); err != nil {
			t.Fatal(err)
		}
	}
	return runtime
}

func TestResourceLifecycleDeterministicDependencyOrderAndReverseShutdown(t *testing.T) {
	runtime := newLifecycleRuntime(t)
	coordinator, err := NewResourceLifecycleCoordinator(runtime)
	if err != nil {
		t.Fatal(err)
	}
	events := []string{}
	controllers := map[string]*lifecycleControllerStub{
		"store":   {id: "store", events: &events},
		"cache":   {id: "cache", events: &events},
		"gateway": {id: "gateway", events: &events},
	}
	for _, binding := range []ResourceLifecycleBinding{
		{ServiceID: "gateway", DependsOn: []string{"cache"}, Controller: controllers["gateway"]},
		{ServiceID: "store", Controller: controllers["store"]},
		{ServiceID: "cache", DependsOn: []string{"store"}, Controller: controllers["cache"]},
	} {
		if err := coordinator.Bind(binding); err != nil {
			t.Fatal(err)
		}
	}
	order, err := coordinator.StartOrder()
	if err != nil {
		t.Fatal(err)
	}
	if want := []string{"store", "cache", "gateway"}; !reflect.DeepEqual(order, want) {
		t.Fatalf("order=%v want=%v", order, want)
	}
	if err := coordinator.StartAll(context.Background()); err != nil {
		t.Fatal(err)
	}
	if err := coordinator.StopAll(context.Background()); err != nil {
		t.Fatal(err)
	}
	wantEvents := []string{"start:store", "start:cache", "start:gateway", "stop:gateway", "stop:cache", "stop:store"}
	if !reflect.DeepEqual(events, wantEvents) {
		t.Fatalf("events=%v want=%v", events, wantEvents)
	}
	for _, snapshot := range runtime.Snapshot() {
		if snapshot.State != ResourceServiceStopped {
			t.Fatalf("%s state=%s", snapshot.Descriptor.ServiceID, snapshot.State)
		}
	}
}

func TestResourceLifecycleRejectsMissingBindingAndCycle(t *testing.T) {
	runtime := newLifecycleRuntime(t)
	coordinator, err := NewResourceLifecycleCoordinator(runtime)
	if err != nil {
		t.Fatal(err)
	}
	if err := coordinator.Bind(ResourceLifecycleBinding{ServiceID: "cache", DependsOn: []string{"store"}, Controller: &lifecycleControllerStub{id: "cache"}}); err != nil {
		t.Fatal(err)
	}
	if _, err := coordinator.StartOrder(); err == nil {
		t.Fatal("expected missing dependency binding rejection")
	}

	coordinator, err = NewResourceLifecycleCoordinator(runtime)
	if err != nil {
		t.Fatal(err)
	}
	if err := coordinator.Bind(ResourceLifecycleBinding{ServiceID: "store", DependsOn: []string{"gateway"}, Controller: &lifecycleControllerStub{id: "store"}}); err != nil {
		t.Fatal(err)
	}
	if err := coordinator.Bind(ResourceLifecycleBinding{ServiceID: "gateway", DependsOn: []string{"store"}, Controller: &lifecycleControllerStub{id: "gateway"}}); err != nil {
		t.Fatal(err)
	}
	if _, err := coordinator.StartOrder(); err == nil {
		t.Fatal("expected dependency cycle rejection")
	}
}

func TestResourceLifecycleStartupFailureRollsBackStartedServices(t *testing.T) {
	runtime := newLifecycleRuntime(t)
	coordinator, err := NewResourceLifecycleCoordinator(runtime)
	if err != nil {
		t.Fatal(err)
	}
	events := []string{}
	store := &lifecycleControllerStub{id: "store", events: &events}
	cache := &lifecycleControllerStub{id: "cache", events: &events, startErr: errors.New("boom")}
	if err := coordinator.Bind(ResourceLifecycleBinding{ServiceID: "store", Controller: store}); err != nil {
		t.Fatal(err)
	}
	if err := coordinator.Bind(ResourceLifecycleBinding{ServiceID: "cache", DependsOn: []string{"store"}, Controller: cache}); err != nil {
		t.Fatal(err)
	}
	if err := coordinator.StartAll(context.Background()); err == nil {
		t.Fatal("expected startup failure")
	}
	wantEvents := []string{"start:store", "start:cache", "stop:store"}
	if !reflect.DeepEqual(events, wantEvents) {
		t.Fatalf("events=%v want=%v", events, wantEvents)
	}
	states := map[string]ResourceServiceState{}
	for _, snapshot := range runtime.Snapshot() {
		states[snapshot.Descriptor.ServiceID] = snapshot.State
	}
	if states["store"] != ResourceServiceStopped || states["cache"] != ResourceServiceFailed {
		t.Fatalf("states=%v", states)
	}
}

func TestResourceLifecycleCancellationStopsBeforeNextStart(t *testing.T) {
	runtime := newLifecycleRuntime(t)
	coordinator, err := NewResourceLifecycleCoordinator(runtime)
	if err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	events := []string{}
	store := &lifecycleControllerStub{id: "store", events: &events}
	cache := &lifecycleControllerStub{id: "cache", events: &events}
	store.events = &events
	if err := coordinator.Bind(ResourceLifecycleBinding{ServiceID: "store", Controller: ResourceServiceControllerFunc{
		StartFunc: func(context.Context) error { events = append(events, "start:store"); cancel(); return nil },
		StopFunc:  func(context.Context) error { events = append(events, "stop:store"); return nil },
	}}); err != nil {
		t.Fatal(err)
	}
	if err := coordinator.Bind(ResourceLifecycleBinding{ServiceID: "cache", DependsOn: []string{"store"}, Controller: cache}); err != nil {
		t.Fatal(err)
	}
	if err := coordinator.StartAll(ctx); !errors.Is(err, context.Canceled) {
		t.Fatalf("err=%v", err)
	}
	if want := []string{"start:store", "stop:store"}; !reflect.DeepEqual(events, want) {
		t.Fatalf("events=%v want=%v", events, want)
	}
}

type ResourceServiceControllerFunc struct {
	StartFunc func(context.Context) error
	StopFunc  func(context.Context) error
}

func (f ResourceServiceControllerFunc) Start(ctx context.Context) error {
	return f.StartFunc(ctx)
}

func (f ResourceServiceControllerFunc) Stop(ctx context.Context) error {
	return f.StopFunc(ctx)
}

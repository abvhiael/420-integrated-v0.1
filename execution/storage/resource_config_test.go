package storage

import "testing"

func newConfigTestRuntime(t *testing.T) *ResourceNetworkRuntime {
	t.Helper()
	runtime, err := NewResourceNetworkRuntime("provider-1", "node-1")
	if err != nil { t.Fatal(err) }
	for _, serviceID := range []string{"store-a", "gateway-a"} {
		capability := ResourceCapabilityStore
		if serviceID == "gateway-a" { capability = ResourceCapabilityGateway }
		if err := runtime.Register(ResourceServiceDescriptor{ProviderID:"provider-1", NodeID:"node-1", ServiceID:serviceID, Capabilities:[]ResourceCapability{capability}}); err != nil { t.Fatal(err) }
	}
	return runtime
}

func TestResourceConfigSharedAndServiceIsolation(t *testing.T) {
	store, err := NewResourceConfigStore(newConfigTestRuntime(t))
	if err != nil { t.Fatal(err) }
	if err := store.Set(ResourceConfigEntry{Key:"rpc.url", Value:"http://rpc", Scope:ResourceConfigShared}); err != nil { t.Fatal(err) }
	if err := store.Set(ResourceConfigEntry{Key:"auth.token", Value:"store-secret", Scope:ResourceConfigService, ServiceID:"store-a", Secret:true}); err != nil { t.Fatal(err) }
	if err := store.Set(ResourceConfigEntry{Key:"auth.token", Value:"gateway-secret", Scope:ResourceConfigService, ServiceID:"gateway-a", Secret:true}); err != nil { t.Fatal(err) }
	storeView, err := store.View("store-a")
	if err != nil { t.Fatal(err) }
	if storeView.Shared["rpc.url"] != "http://rpc" || storeView.Service["auth.token"] != "store-secret" { t.Fatalf("store view=%v", storeView) }
	if storeView.Service["auth.token"] == "gateway-secret" { t.Fatal("gateway secret leaked into store view") }
	gatewayView, err := store.View("gateway-a")
	if err != nil { t.Fatal(err) }
	if gatewayView.Service["auth.token"] != "gateway-secret" { t.Fatalf("gateway view=%v", gatewayView) }
}

func TestResourceConfigRejectsSharedSecretsAndUnknownServices(t *testing.T) {
	store, err := NewResourceConfigStore(newConfigTestRuntime(t))
	if err != nil { t.Fatal(err) }
	if err := store.Set(ResourceConfigEntry{Key:"token", Value:"x", Scope:ResourceConfigShared, Secret:true}); err == nil { t.Fatal("expected shared secret rejection") }
	if err := store.Set(ResourceConfigEntry{Key:"token", Value:"x", Scope:ResourceConfigService, ServiceID:"missing", Secret:true}); err == nil { t.Fatal("expected unknown service rejection") }
	if _, err := store.View("missing"); err == nil { t.Fatal("expected unknown service view rejection") }
}

func TestResourceConfigSnapshotRedactsSecretsAndSorts(t *testing.T) {
	store, err := NewResourceConfigStore(newConfigTestRuntime(t))
	if err != nil { t.Fatal(err) }
	entries := []ResourceConfigEntry{
		{Key:"z", Value:"public-z", Scope:ResourceConfigShared},
		{Key:"a", Value:"secret-a", Scope:ResourceConfigService, ServiceID:"store-a", Secret:true},
		{Key:"b", Value:"public-b", Scope:ResourceConfigShared},
	}
	for _, entry := range entries { if err := store.Set(entry); err != nil { t.Fatal(err) } }
	snapshot := store.Snapshot()
	if len(snapshot) != 3 { t.Fatalf("snapshot=%v", snapshot) }
	for _, entry := range snapshot {
		if entry.Secret && entry.Value != "" { t.Fatalf("secret exposed in snapshot: %v", entry) }
	}
	if snapshot[0].Key != "b" || snapshot[1].Key != "z" || snapshot[2].Key != "a" { t.Fatalf("order=%v", snapshot) }
}

func TestResourceConfigReplacementRemainsScoped(t *testing.T) {
	store, err := NewResourceConfigStore(newConfigTestRuntime(t))
	if err != nil { t.Fatal(err) }
	if err := store.Set(ResourceConfigEntry{Key:"endpoint", Value:"v1", Scope:ResourceConfigService, ServiceID:"store-a"}); err != nil { t.Fatal(err) }
	if err := store.Set(ResourceConfigEntry{Key:"endpoint", Value:"v2", Scope:ResourceConfigService, ServiceID:"store-a"}); err != nil { t.Fatal(err) }
	view, err := store.View("store-a")
	if err != nil { t.Fatal(err) }
	if view.Service["endpoint"] != "v2" { t.Fatalf("view=%v", view) }
}

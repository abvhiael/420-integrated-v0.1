package storage

import "testing"

func newTrustTestRuntime(t *testing.T) *ResourceNetworkRuntime {
	t.Helper()
	runtime, err := NewResourceNetworkRuntime("provider-1", "node-1")
	if err != nil { t.Fatal(err) }
	services := []ResourceServiceDescriptor{
		{ProviderID:"provider-1", NodeID:"node-1", ServiceID:"store-a", Capabilities:[]ResourceCapability{ResourceCapabilityStore}},
		{ProviderID:"provider-1", NodeID:"node-1", ServiceID:"gateway-a", Capabilities:[]ResourceCapability{ResourceCapabilityGateway}},
		{ProviderID:"provider-1", NodeID:"node-1", ServiceID:"relay-a", Capabilities:[]ResourceCapability{ResourceCapabilityRelay}},
	}
	for _, service := range services {
		if err := runtime.Register(service); err != nil { t.Fatal(err) }
	}
	return runtime
}

func TestResourceTrustRejectsCrossDomainAuthority(t *testing.T) {
	registry, err := NewResourceTrustRegistry(newTrustTestRuntime(t))
	if err != nil { t.Fatal(err) }
	if err := registry.Grant(ResourceTrustGrant{ServiceID:"gateway-a", Domain:ResourceTrustDelivery, Authorities:[]ResourceAuthority{ResourceAuthoritySettlementRead}}); err == nil {
		t.Fatal("expected delivery/economic authority separation")
	}
	if err := registry.Grant(ResourceTrustGrant{ServiceID:"store-a", Domain:ResourceTrustStorage, Authorities:[]ResourceAuthority{ResourceAuthorityCredentialRead}}); err == nil {
		t.Fatal("expected storage/control authority separation")
	}
}

func TestResourceTrustRejectsUnknownServiceAndDuplicateGrant(t *testing.T) {
	registry, err := NewResourceTrustRegistry(newTrustTestRuntime(t))
	if err != nil { t.Fatal(err) }
	if err := registry.Grant(ResourceTrustGrant{ServiceID:"missing", Domain:ResourceTrustStorage, Authorities:[]ResourceAuthority{ResourceAuthorityDataRead}}); err == nil {
		t.Fatal("expected unknown service rejection")
	}
	grant := ResourceTrustGrant{ServiceID:"store-a", Domain:ResourceTrustStorage, Authorities:[]ResourceAuthority{ResourceAuthorityDataRead}}
	if err := registry.Grant(grant); err != nil { t.Fatal(err) }
	if err := registry.Grant(grant); err == nil { t.Fatal("expected duplicate grant rejection") }
}

func TestResourceTrustAuthorizedIsExactAndFailClosed(t *testing.T) {
	registry, err := NewResourceTrustRegistry(newTrustTestRuntime(t))
	if err != nil { t.Fatal(err) }
	if err := registry.Grant(ResourceTrustGrant{ServiceID:"gateway-a", Domain:ResourceTrustDelivery, Authorities:[]ResourceAuthority{ResourceAuthorityServe, ResourceAuthorityDiscover, ResourceAuthorityServe}}); err != nil { t.Fatal(err) }
	if !registry.Authorized("GATEWAY-A", ResourceAuthorityServe) { t.Fatal("expected exact granted authority") }
	if registry.Authorized("gateway-a", ResourceAuthoritySettlementRead) { t.Fatal("cross-domain authority leaked") }
	if registry.Authorized("missing", ResourceAuthorityServe) { t.Fatal("unknown service authorized") }
	if registry.Authorized("gateway-a", ResourceAuthority("bogus")) { t.Fatal("unknown authority authorized") }
}

func TestResourceTrustSnapshotDeterministicAndCopySafe(t *testing.T) {
	registry, err := NewResourceTrustRegistry(newTrustTestRuntime(t))
	if err != nil { t.Fatal(err) }
	grants := []ResourceTrustGrant{
		{ServiceID:"store-a", Domain:ResourceTrustStorage, Authorities:[]ResourceAuthority{ResourceAuthorityDataWrite, ResourceAuthorityDataRead}},
		{ServiceID:"relay-a", Domain:ResourceTrustEconomic, Authorities:[]ResourceAuthority{ResourceAuthoritySettlementRead}},
		{ServiceID:"gateway-a", Domain:ResourceTrustDelivery, Authorities:[]ResourceAuthority{ResourceAuthorityServe, ResourceAuthorityDataRead, ResourceAuthorityDiscover}},
	}
	for _, grant := range grants { if err := registry.Grant(grant); err != nil { t.Fatal(err) } }
	snapshot := registry.Snapshot()
	if len(snapshot) != 3 { t.Fatalf("snapshot=%v", snapshot) }
	if snapshot[0].Domain != ResourceTrustDelivery || snapshot[1].Domain != ResourceTrustEconomic || snapshot[2].Domain != ResourceTrustStorage {
		t.Fatalf("order=%v", snapshot)
	}
	if len(snapshot[0].Authorities) != 3 || snapshot[0].Authorities[0] != ResourceAuthorityDataRead || snapshot[0].Authorities[1] != ResourceAuthorityDiscover || snapshot[0].Authorities[2] != ResourceAuthorityServe {
		t.Fatalf("authorities=%v", snapshot[0].Authorities)
	}
	snapshot[0].Authorities[0] = ResourceAuthoritySettlementRead
	if !registry.Authorized("gateway-a", ResourceAuthorityDataRead) || registry.Authorized("gateway-a", ResourceAuthoritySettlementRead) {
		t.Fatal("snapshot mutation changed registry authority")
	}
}

func TestResourceTrustControlCredentialAuthorityIsExplicit(t *testing.T) {
	registry, err := NewResourceTrustRegistry(newTrustTestRuntime(t))
	if err != nil { t.Fatal(err) }
	if err := registry.Grant(ResourceTrustGrant{ServiceID:"store-a", Domain:ResourceTrustControl, Authorities:[]ResourceAuthority{ResourceAuthorityLifecycle, ResourceAuthorityCredentialRead}}); err != nil { t.Fatal(err) }
	if !registry.Authorized("store-a", ResourceAuthorityCredentialRead) { t.Fatal("explicit control credential authority missing") }
	if registry.Authorized("gateway-a", ResourceAuthorityCredentialRead) { t.Fatal("credential authority leaked to ungranted service") }
}

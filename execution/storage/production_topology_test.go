package storage

import (
	"bytes"
	"context"
	"errors"
	"testing"
)

type productionGatewaySource struct {
	payload []byte
	err     error
}

func (s productionGatewaySource) FetchGatewayObject(context.Context, GatewayRequest) ([]byte, error) {
	if s.err != nil {
		return nil, s.err
	}
	return append([]byte(nil), s.payload...), nil
}

func buildProductionTestTopology(t *testing.T, payload []byte) *ProductionResourceTopology {
	t.Helper()
	topology, err := BuildProductionResourceTopology([]ProductionNodeSpec{
		{
			ProviderID: "provider-a",
			NodeID:     "node-a",
			Services: []ProductionServiceSpec{
				{ServiceID: "cache-a", Capabilities: []ResourceCapability{ResourceCapabilityCache}, Priority: 10, Source: productionGatewaySource{payload: payload}},
				{ServiceID: "store-a", Capabilities: []ResourceCapability{ResourceCapabilityStore}, Priority: 20, Source: productionGatewaySource{err: errors.New("provider-a unavailable")}},
			},
		},
		{
			ProviderID: "provider-b",
			NodeID:     "node-b",
			Services: []ProductionServiceSpec{
				{ServiceID: "store-b", Capabilities: []ResourceCapability{ResourceCapabilityStore}, Priority: 30, Source: productionGatewaySource{payload: payload}},
				{ServiceID: "repair-b", Capabilities: []ResourceCapability{ResourceCapabilityRepair}, Priority: 40, Endpoint: "https://repair-b.invalid"},
			},
		},
	})
	if err != nil {
		t.Fatal(err)
	}
	return topology
}

func TestProductionTopologyRequiresMultipleProviders(t *testing.T) {
	_, err := BuildProductionResourceTopology([]ProductionNodeSpec{{ProviderID: "provider-a", NodeID: "node-a", Services: []ProductionServiceSpec{{ServiceID: "store", Capabilities: []ResourceCapability{ResourceCapabilityStore}, Endpoint: "https://store.invalid"}}}})
	if !errors.Is(err, ErrProductionTopology) {
		t.Fatalf("expected multi-provider rejection, got %v", err)
	}
	_, err = BuildProductionResourceTopology([]ProductionNodeSpec{
		{ProviderID: "provider-a", NodeID: "node-a", Services: []ProductionServiceSpec{{ServiceID: "store-a", Capabilities: []ResourceCapability{ResourceCapabilityStore}, Endpoint: "https://a.invalid"}}},
		{ProviderID: "provider-a", NodeID: "node-b", Services: []ProductionServiceSpec{{ServiceID: "store-b", Capabilities: []ResourceCapability{ResourceCapabilityStore}, Endpoint: "https://b.invalid"}}},
	})
	if !errors.Is(err, ErrProductionTopology) {
		t.Fatalf("expected distinct-provider rejection, got %v", err)
	}
}

func TestProductionTopologyDeterministicDiscoveryAndLifecycle(t *testing.T) {
	payload := []byte("production-payload")
	topology := buildProductionTestTopology(t, payload)
	if err := topology.StartAll(); err != nil {
		t.Fatal(err)
	}
	endpoints, err := topology.Discovery().DiscoverResources(context.Background(), ResourceDiscoveryRequest{Capabilities: []ResourceCapability{ResourceCapabilityStore, ResourceCapabilityCache, ResourceCapabilityRepair}})
	if err != nil {
		t.Fatal(err)
	}
	if len(endpoints) != 4 {
		t.Fatalf("expected 4 endpoints, got %#v", endpoints)
	}
	if endpoints[0].Capability != ResourceCapabilityCache || endpoints[0].ProviderID != "provider-a" {
		t.Fatalf("unexpected deterministic order: %#v", endpoints)
	}
	if err := topology.StopAll(); err != nil {
		t.Fatal(err)
	}
	for _, node := range topology.Nodes() {
		for _, service := range node.Runtime.Snapshot() {
			if service.State != ResourceServiceStopped {
				t.Fatalf("service not stopped: %#v", service)
			}
		}
	}
}

func TestProductionTopologyGatewayFailsOverAcrossProviders(t *testing.T) {
	payload := []byte("verified-production-payload")
	topology := buildProductionTestTopology(t, payload)
	if err := topology.StartAll(); err != nil {
		t.Fatal(err)
	}

	// Degrade cache-a so production discovery excludes it from active routing.
	for _, node := range topology.Nodes() {
		if node.ProviderID == "provider-a" {
			if err := node.Runtime.Transition("cache-a", ResourceServiceDegraded); err != nil {
				t.Fatal(err)
			}
		}
	}

	router := GatewayRouter{Discovery: ResourceGatewayDiscovery{Discovery: topology.Discovery()}}
	key := CacheKey{ObjectID: "obj", ManifestID: "manifest", ShardIndex: 0, ShardRoot: DeveloperShardRoot(payload), SizeBytes: uint64(len(payload))}
	result, err := router.Route(context.Background(), GatewayRequest{CacheKey: key, CommitmentID: "commit", Access: GatewayAccess{Mode: GatewayAccessPublic}})
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(result.Payload, payload) {
		t.Fatalf("payload mismatch: %q", result.Payload)
	}
	if result.ProviderID != "provider-b" || result.NodeID != "node-b" || result.Tier != "store" {
		t.Fatalf("expected cross-provider failover to provider-b store, got %#v", result)
	}
	if len(result.Attempts) == 0 || result.Attempts[0].ProviderID != "provider-a" {
		t.Fatalf("expected failed provider-a store attempt before failover: %#v", result.Attempts)
	}
}

func TestProductionTopologyDegradedEndpointsAreAdvisoryOnly(t *testing.T) {
	payload := []byte("payload")
	topology := buildProductionTestTopology(t, payload)
	if err := topology.StartAll(); err != nil {
		t.Fatal(err)
	}
	for _, node := range topology.Nodes() {
		if node.ProviderID == "provider-b" {
			if err := node.Runtime.Transition("store-b", ResourceServiceDegraded); err != nil {
				t.Fatal(err)
			}
		}
	}
	withoutDegraded, err := topology.Discovery().DiscoverResources(context.Background(), ResourceDiscoveryRequest{Capabilities: []ResourceCapability{ResourceCapabilityStore}})
	if err != nil {
		t.Fatal(err)
	}
	if len(withoutDegraded) != 1 || withoutDegraded[0].ProviderID != "provider-a" {
		t.Fatalf("degraded endpoint leaked into active discovery: %#v", withoutDegraded)
	}
	withDegraded, err := topology.Discovery().DiscoverResources(context.Background(), ResourceDiscoveryRequest{Capabilities: []ResourceCapability{ResourceCapabilityStore}, IncludeDegraded: true})
	if err != nil {
		t.Fatal(err)
	}
	if len(withDegraded) != 2 || withDegraded[1].State != ResourceServiceDegraded {
		t.Fatalf("expected advisory degraded endpoint: %#v", withDegraded)
	}
}

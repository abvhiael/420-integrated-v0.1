package storage

import (
	"bytes"
	"context"
	"errors"
	"testing"
	"time"
)

type productionDiscoveryStub struct {
	endpoints []ResourceEndpoint
	err       error
}

func (s productionDiscoveryStub) DiscoverResources(context.Context, ResourceDiscoveryRequest) ([]ResourceEndpoint, error) {
	if s.err != nil {
		return nil, s.err
	}
	return append([]ResourceEndpoint(nil), s.endpoints...), nil
}

type productionBlockingSource struct{}

func (productionBlockingSource) FetchGatewayObject(ctx context.Context, _ GatewayRequest) ([]byte, error) {
	<-ctx.Done()
	return nil, ctx.Err()
}

type productionDenyAuthorizer struct{}

func (productionDenyAuthorizer) AuthorizeGatewayAccess(context.Context, GatewayAccess, GatewayRequest) error {
	return errors.New("denied")
}

func TestProductionDiscoveryIsolatesFailedProvider(t *testing.T) {
	good := productionGatewaySource{payload: []byte("ok")}
	discovery := MultiProviderResourceDiscovery{Sources: []ResourceDiscovery{
		productionDiscoveryStub{err: errors.New("provider-a discovery unavailable")},
		productionDiscoveryStub{endpoints: []ResourceEndpoint{{ProviderID: "provider-b", NodeID: "node-b", ServiceID: "store-b", Capability: ResourceCapabilityStore, Priority: 20, State: ResourceServiceRunning, Source: good}}},
	}}
	endpoints, err := discovery.DiscoverResources(context.Background(), ResourceDiscoveryRequest{Capabilities: []ResourceCapability{ResourceCapabilityStore}})
	if err != nil {
		t.Fatal(err)
	}
	if len(endpoints) != 1 || endpoints[0].ProviderID != "provider-b" {
		t.Fatalf("healthy provider should survive peer discovery failure: %#v", endpoints)
	}
}

func TestProductionDiscoveryFailsClosedWhenAllProvidersFail(t *testing.T) {
	discovery := MultiProviderResourceDiscovery{Sources: []ResourceDiscovery{
		productionDiscoveryStub{err: errors.New("a down")},
		productionDiscoveryStub{err: errors.New("b down")},
	}}
	_, err := discovery.DiscoverResources(context.Background(), ResourceDiscoveryRequest{Capabilities: []ResourceCapability{ResourceCapabilityStore}})
	if !errors.Is(err, ErrProductionTopology) {
		t.Fatalf("expected all-provider failure, got %v", err)
	}
}

func TestProductionDiscoveryFiltersMalformedOrStaleEndpoints(t *testing.T) {
	good := productionGatewaySource{payload: []byte("good")}
	discovery := MultiProviderResourceDiscovery{Sources: []ResourceDiscovery{
		productionDiscoveryStub{endpoints: []ResourceEndpoint{
			{ProviderID: "", NodeID: "node-a", ServiceID: "store-a", Capability: ResourceCapabilityStore, State: ResourceServiceRunning, Source: good},
			{ProviderID: "provider-a", NodeID: "node-a", ServiceID: "store-a", Capability: ResourceCapabilityStore, State: ResourceServiceStopped, Source: good},
			{ProviderID: "provider-a", NodeID: "node-a", ServiceID: "store-a", Capability: ResourceCapability("bogus"), State: ResourceServiceRunning, Source: good},
		}},
		productionDiscoveryStub{endpoints: []ResourceEndpoint{{ProviderID: "provider-b", NodeID: "node-b", ServiceID: "store-b", Capability: ResourceCapabilityStore, Priority: 30, State: ResourceServiceRunning, Source: good}}},
	}}
	endpoints, err := discovery.DiscoverResources(context.Background(), ResourceDiscoveryRequest{Capabilities: []ResourceCapability{ResourceCapabilityStore}})
	if err != nil {
		t.Fatal(err)
	}
	if len(endpoints) != 1 || endpoints[0].ProviderID != "provider-b" {
		t.Fatalf("malformed/stale endpoint entered production discovery: %#v", endpoints)
	}
}

func TestProductionGatewayRejectsCorruptCacheAndUsesVerifiedStore(t *testing.T) {
	goodPayload := []byte("verified-production-object")
	corruptPayload := append([]byte(nil), goodPayload...)
	corruptPayload[0] ^= 0xff
	discovery := MultiProviderResourceDiscovery{Sources: []ResourceDiscovery{
		productionDiscoveryStub{endpoints: []ResourceEndpoint{{ProviderID: "provider-a", NodeID: "node-a", ServiceID: "cache-a", Capability: ResourceCapabilityCache, Priority: 10, State: ResourceServiceRunning, Source: productionGatewaySource{payload: corruptPayload}}}},
		productionDiscoveryStub{endpoints: []ResourceEndpoint{{ProviderID: "provider-b", NodeID: "node-b", ServiceID: "store-b", Capability: ResourceCapabilityStore, Priority: 20, State: ResourceServiceRunning, Source: productionGatewaySource{payload: goodPayload}}}},
	}}
	router := GatewayRouter{Discovery: ResourceGatewayDiscovery{Discovery: discovery}}
	key := CacheKey{ObjectID: "obj", ManifestID: "manifest", ShardIndex: 0, ShardRoot: DeveloperShardRoot(goodPayload), SizeBytes: uint64(len(goodPayload))}
	result, err := router.Route(context.Background(), GatewayRequest{CacheKey: key, CommitmentID: "commit", Access: GatewayAccess{Mode: GatewayAccessPublic}})
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(result.Payload, goodPayload) || result.ProviderID != "provider-b" || result.Tier != "store" {
		t.Fatalf("expected verified store fallback after cache poisoning: %#v", result)
	}
	if len(result.Attempts) != 1 || result.Attempts[0].Tier != "cache" {
		t.Fatalf("expected one rejected cache attempt: %#v", result.Attempts)
	}
}

func TestProductionGatewayCancellationBoundsTimeoutStorm(t *testing.T) {
	payload := []byte("never-used")
	discovery := MultiProviderResourceDiscovery{Sources: []ResourceDiscovery{
		productionDiscoveryStub{endpoints: []ResourceEndpoint{{ProviderID: "provider-a", NodeID: "node-a", ServiceID: "cache-a", Capability: ResourceCapabilityCache, Priority: 10, State: ResourceServiceRunning, Source: productionBlockingSource{}}}},
		productionDiscoveryStub{endpoints: []ResourceEndpoint{{ProviderID: "provider-b", NodeID: "node-b", ServiceID: "store-b", Capability: ResourceCapabilityStore, Priority: 20, State: ResourceServiceRunning, Source: productionGatewaySource{payload: payload}}}},
	}}
	router := GatewayRouter{Discovery: ResourceGatewayDiscovery{Discovery: discovery}}
	key := CacheKey{ObjectID: "obj", ManifestID: "manifest", ShardIndex: 0, ShardRoot: DeveloperShardRoot(payload), SizeBytes: uint64(len(payload))}
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Millisecond)
	defer cancel()
	_, err := router.Route(ctx, GatewayRequest{CacheKey: key, CommitmentID: "commit", Access: GatewayAccess{Mode: GatewayAccessPublic}})
	if !errors.Is(ctx.Err(), context.DeadlineExceeded) || !errors.Is(err, ErrGatewayRoute) {
		t.Fatalf("expected bounded cancellation failure, ctx=%v err=%v", ctx.Err(), err)
	}
}

func TestProductionPrivateReadSpoofFailsClosed(t *testing.T) {
	payload := []byte("private")
	router := GatewayRouter{Store: []GatewaySource{productionGatewaySource{payload: payload}}, Authorizer: productionDenyAuthorizer{}}
	key := CacheKey{ObjectID: "obj", ManifestID: "manifest", ShardIndex: 0, ShardRoot: DeveloperShardRoot(payload), SizeBytes: uint64(len(payload))}
	_, err := router.Route(context.Background(), GatewayRequest{CacheKey: key, CommitmentID: "commit", Access: GatewayAccess{Mode: GatewayAccessPrivate, Subject: "spoofed-subject", SessionID: "spoofed-session", Capability: GatewayAccessRead}})
	if !errors.Is(err, ErrGatewayUnauthorized) {
		t.Fatalf("expected private access denial, got %v", err)
	}
}

func TestProductionProviderDisappearanceAndRejoin(t *testing.T) {
	topology := buildProductionTestTopology(t, []byte("payload"))
	if err := topology.StartAll(); err != nil {
		t.Fatal(err)
	}
	var providerB *ProductionResourceNode
	for i := range topology.nodes {
		if topology.nodes[i].ProviderID == "provider-b" {
			providerB = &topology.nodes[i]
			break
		}
	}
	if providerB == nil {
		t.Fatal("provider-b not found")
	}
	if err := providerB.Runtime.Transition("store-b", ResourceServiceFailed); err != nil {
		t.Fatal(err)
	}
	endpoints, err := topology.Discovery().DiscoverResources(context.Background(), ResourceDiscoveryRequest{Capabilities: []ResourceCapability{ResourceCapabilityStore}})
	if err != nil {
		t.Fatal(err)
	}
	if len(endpoints) != 1 || endpoints[0].ProviderID != "provider-a" {
		t.Fatalf("failed provider remained routable: %#v", endpoints)
	}
	if err := topology.StartAll(); err != nil {
		t.Fatal(err)
	}
	endpoints, err = topology.Discovery().DiscoverResources(context.Background(), ResourceDiscoveryRequest{Capabilities: []ResourceCapability{ResourceCapabilityStore}})
	if err != nil {
		t.Fatal(err)
	}
	if len(endpoints) != 2 {
		t.Fatalf("rejoined provider did not return to discovery: %#v", endpoints)
	}
}

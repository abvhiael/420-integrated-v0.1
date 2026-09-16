package storage

import (
	"context"
	"errors"
	"testing"
	"time"
)

type developerGatewaySourceFunc func(context.Context, GatewayRequest) ([]byte, error)
func (f developerGatewaySourceFunc) FetchGatewayObject(ctx context.Context, req GatewayRequest) ([]byte, error) { return f(ctx, req) }

type developerHelperGatewayDiscoveryStub struct { candidates []GatewayCandidate }
func (d developerHelperGatewayDiscoveryStub) DiscoverGatewaySources(context.Context, GatewayRequest) ([]GatewayCandidate, error) { return append([]GatewayCandidate(nil), d.candidates...), nil }

func developerHelperObject(payload []byte) DeveloperObjectRef {
	return DeveloperObjectRef{ObjectID: "object-1", ManifestID: "manifest-1", ShardIndex: 0, ShardRoot: DeveloperShardRoot(payload), SizeBytes: uint64(len(payload)), CommitmentID: "commitment-1"}
}

func TestDeveloperCacheStatusFreshExpiredAndMissing(t *testing.T) {
	now := time.Unix(1000, 0).UTC()
	payload := []byte("cache-payload")
	object := developerHelperObject(payload)
	key := CacheKey{ObjectID: object.ObjectID, ManifestID: object.ManifestID, ShardIndex: object.ShardIndex, ShardRoot: object.ShardRoot, SizeBytes: object.SizeBytes}
	id, err := CanonicalCacheKey(key); if err != nil { t.Fatal(err) }
	state := CacheState{Entries: map[string]CacheEntry{id: {Key:key, StoredAt:now.Add(-time.Minute), ExpiresAt:now.Add(time.Minute), LastAccess:now, HitCount:3}}}
	status, err := DeveloperCacheStatusForObject(state, object, now); if err != nil { t.Fatal(err) }
	if status.Authoritative || status.State != DeveloperCacheFresh || status.HitCount != 3 { t.Fatalf("unexpected fresh status %#v", status) }
	status, err = DeveloperCacheStatusForObject(state, object, now.Add(2*time.Minute)); if err != nil { t.Fatal(err) }
	if status.State != DeveloperCacheExpired { t.Fatalf("expected expired, got %#v", status) }
	status, err = DeveloperCacheStatusForObject(CacheState{Entries: map[string]CacheEntry{}}, object, now); if err != nil { t.Fatal(err) }
	if status.State != DeveloperCacheMissing { t.Fatalf("expected missing, got %#v", status) }
}

func TestDeveloperRepairStatusKeepsRepairSeparateFromCanonicalSettlement(t *testing.T) {
	object := developerHelperObject([]byte("payload"))
	manifest := RepairManifest{ManifestID: object.ManifestID, ObjectID: object.ObjectID, ManifestHash:"hash-1", ErasureRoot:"erasure", DataShards:1, TotalShards:2, Sealed:true, Placements: []RepairPlacement{
		{ShardIndex:0, AgreementID:"a0", CommitmentID:object.CommitmentID, NodeID:"n0", ShardRoot:object.ShardRoot, SizeBytes:object.SizeBytes, Live:true},
		{ShardIndex:1, AgreementID:"a1", CommitmentID:"c1", NodeID:"n1", ShardRoot:"root-1", SizeBytes:8, Live:false},
	}}
	status, err := DeveloperRepairStatusForObject(object, manifest, RepairPolicy{TargetLiveShards:2}); if err != nil { t.Fatal(err) }
	if status.Authoritative || !status.Retrievable || !status.Recoverable || !status.Degraded || len(status.ReplaceShards) != 1 || status.ReplaceShards[0] != 1 {
		t.Fatalf("unexpected repair status %#v", status)
	}
}

func TestDeveloperRepairStatusRejectsIdentitySubstitution(t *testing.T) {
	object := developerHelperObject([]byte("payload"))
	manifest := RepairManifest{ManifestID:"other", ObjectID:object.ObjectID, ManifestHash:"hash", DataShards:1, TotalShards:1, Sealed:true}
	if _, err := DeveloperRepairStatusForObject(object, manifest, RepairPolicy{}); !errors.Is(err, ErrDeveloperResourceHelper) { t.Fatalf("expected identity rejection, got %v", err) }
}

func TestDeveloperGatewayHelperReportsCacheToStoreFallback(t *testing.T) {
	payload := []byte("gateway-payload")
	object := developerHelperObject(payload)
	cache := developerGatewaySourceFunc(func(context.Context, GatewayRequest) ([]byte,error) { return nil, errors.New("cache miss") })
	store := developerGatewaySourceFunc(func(context.Context, GatewayRequest) ([]byte,error) { return append([]byte(nil), payload...), nil })
	helper := DeveloperGatewayHelper{Router:GatewayRouter{Cache:[]GatewaySource{cache}, Store:[]GatewaySource{store}}}
	got, err := helper.Retrieve(context.Background(), DeveloperRetrieveRequest{Object:object, Access:DeveloperReadAccess{Mode:DeveloperAccessPublic}}, DeveloperRetrievalPolicy{AllowCache:true, AllowStoreFallback:true})
	if err != nil { t.Fatal(err) }
	if !got.Diagnostics.FallbackUsed || got.Diagnostics.SelectedTier != "store" || len(got.Diagnostics.Attempts) != 1 || got.Diagnostics.Attempts[0].Tier != "cache" { t.Fatalf("unexpected diagnostics %#v", got.Diagnostics) }
}

func TestDeveloperGatewayHelperCanForbidStoreFallbackIncludingDiscovery(t *testing.T) {
	payload := []byte("gateway-payload")
	object := developerHelperObject(payload)
	store := developerGatewaySourceFunc(func(context.Context, GatewayRequest) ([]byte,error) { return append([]byte(nil), payload...), nil })
	helper := DeveloperGatewayHelper{Router:GatewayRouter{Discovery:developerHelperGatewayDiscoveryStub{candidates:[]GatewayCandidate{{ProviderID:"p", NodeID:"n", Capability:GatewayCapabilityStore, Priority:1, Active:true, Source:store}}}}}
	_, err := helper.Retrieve(context.Background(), DeveloperRetrieveRequest{Object:object, Access:DeveloperReadAccess{Mode:DeveloperAccessPublic}}, DeveloperRetrievalPolicy{AllowCache:true, AllowStoreFallback:false})
	if !errors.Is(err, ErrGatewayRoute) { t.Fatalf("store discovery bypassed policy: %v", err) }
}

func TestDeveloperGatewayHelperCanForbidCache(t *testing.T) {
	payload := []byte("gateway-payload")
	object := developerHelperObject(payload)
	cache := developerGatewaySourceFunc(func(context.Context, GatewayRequest) ([]byte,error) { return append([]byte(nil), payload...), nil })
	store := developerGatewaySourceFunc(func(context.Context, GatewayRequest) ([]byte,error) { return append([]byte(nil), payload...), nil })
	helper := DeveloperGatewayHelper{Router:GatewayRouter{Cache:[]GatewaySource{cache}, Store:[]GatewaySource{store}}}
	got, err := helper.Retrieve(context.Background(), DeveloperRetrieveRequest{Object:object, Access:DeveloperReadAccess{Mode:DeveloperAccessPublic}}, DeveloperRetrievalPolicy{AllowCache:false, AllowStoreFallback:true})
	if err != nil { t.Fatal(err) }
	if got.Diagnostics.SelectedTier != "store" || got.Diagnostics.FallbackUsed { t.Fatalf("unexpected policy result %#v", got.Diagnostics) }
}

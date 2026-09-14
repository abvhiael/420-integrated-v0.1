package storage

import (
	"context"
	"errors"
	"testing"
)

type fakeEligibilityReader struct {
	verified map[string]RepairProviderCandidate
	rejected map[string]bool
}

func (f fakeEligibilityReader) VerifyRepairCandidate(_ context.Context, c RepairProviderCandidate, required uint64) (RepairProviderCandidate, error) {
	if f.rejected[c.OfferID] { return RepairProviderCandidate{}, errors.New("rejected") }
	v, ok := f.verified[c.OfferID]
	if !ok || v.AvailableBytes < required { return RepairProviderCandidate{}, errors.New("ineligible") }
	return v, nil
}

func selectionFixture() (RepairReconstructionPlan, RepairManifest) {
	manifest := RepairManifest{
		ManifestID:"0x"+repeatHex("11",32), ObjectID:"0x"+repeatHex("22",32), ManifestHash:"0x"+repeatHex("33",32), ErasureRoot:"0x"+repeatHex("44",32),
		DataShards:2, TotalShards:4, Sealed:true,
		Placements:[]RepairPlacement{
			{ShardIndex:0,AgreementID:"a0",CommitmentID:"c0",NodeID:"node-live-0",ShardRoot:"r0",SizeBytes:4,Live:true},
			{ShardIndex:1,AgreementID:"a1",CommitmentID:"c1",NodeID:"node-live-1",ShardRoot:"r1",SizeBytes:4,Live:true},
			{ShardIndex:2,AgreementID:"a2",CommitmentID:"c2",NodeID:"node-old-2",ShardRoot:"r2",SizeBytes:4,Live:false},
			{ShardIndex:3,AgreementID:"a3",CommitmentID:"c3",NodeID:"node-old-3",ShardRoot:"r3",SizeBytes:4,Live:false},
		},
	}
	reconstruction := RepairReconstructionPlan{
		ManifestID:manifest.ManifestID,ObjectID:manifest.ObjectID,ErasureRoot:manifest.ErasureRoot,DataShards:2,TotalShards:4,
		Sources:[]RepairShardRef{{ShardIndex:0,SizeBytes:4},{ShardIndex:1,SizeBytes:4}},
		Targets:[]RepairShardRef{{ShardIndex:3,SizeBytes:4},{ShardIndex:2,SizeBytes:4}},
	}
	return reconstruction, manifest
}

func TestSelectRepairProvidersDeterministicByPriceCapacityAndNode(t *testing.T) {
	reconstruction, manifest := selectionFixture()
	reader := fakeEligibilityReader{verified:map[string]RepairProviderCandidate{
		"offer-a":{OfferID:"offer-a",NodeID:"node-a",ProviderID:"provider-a",UnitPrice420:5,AvailableBytes:100},
		"offer-b":{OfferID:"offer-b",NodeID:"node-b",ProviderID:"provider-b",UnitPrice420:3,AvailableBytes:50},
		"offer-c":{OfferID:"offer-c",NodeID:"node-c",ProviderID:"provider-c",UnitPrice420:3,AvailableBytes:80},
	}}
	plan, err := SelectRepairProviders(context.Background(), reconstruction, manifest, reader, []RepairProviderCandidate{{OfferID:"offer-a",NodeID:"x",ProviderID:"x"},{OfferID:"offer-b",NodeID:"x",ProviderID:"x"},{OfferID:"offer-c",NodeID:"x",ProviderID:"x"}})
	if err != nil { t.Fatal(err) }
	if len(plan.Selections)!=2 { t.Fatalf("selections=%d",len(plan.Selections)) }
	if plan.Selections[0].ShardIndex!=2 || plan.Selections[0].Candidate.OfferID!="offer-c" { t.Fatalf("first=%+v",plan.Selections[0]) }
	if plan.Selections[1].ShardIndex!=3 || plan.Selections[1].Candidate.OfferID!="offer-b" { t.Fatalf("second=%+v",plan.Selections[1]) }
}

func TestSelectRepairProvidersSkipsRejectedAndLiveNode(t *testing.T) {
	reconstruction, manifest := selectionFixture()
	reader := fakeEligibilityReader{verified:map[string]RepairProviderCandidate{
		"live":{OfferID:"live",NodeID:"node-live-0",ProviderID:"provider-live",UnitPrice420:1,AvailableBytes:100},
		"ok1":{OfferID:"ok1",NodeID:"node-new-1",ProviderID:"provider-1",UnitPrice420:2,AvailableBytes:100},
		"ok2":{OfferID:"ok2",NodeID:"node-new-2",ProviderID:"provider-2",UnitPrice420:3,AvailableBytes:100},
	}, rejected:map[string]bool{"bad":true}}
	plan, err := SelectRepairProviders(context.Background(), reconstruction, manifest, reader, []RepairProviderCandidate{{OfferID:"bad",NodeID:"x",ProviderID:"x"},{OfferID:"live",NodeID:"x",ProviderID:"x"},{OfferID:"ok1",NodeID:"x",ProviderID:"x"},{OfferID:"ok2",NodeID:"x",ProviderID:"x"}})
	if err != nil { t.Fatal(err) }
	for _, s := range plan.Selections { if s.Candidate.NodeID=="node-live-0" { t.Fatal("selected existing live node") } }
}

func TestSelectRepairProvidersRequiresProviderDiversity(t *testing.T) {
	reconstruction, manifest := selectionFixture()
	reader := fakeEligibilityReader{verified:map[string]RepairProviderCandidate{
		"a":{OfferID:"a",NodeID:"node-a",ProviderID:"same-provider",UnitPrice420:1,AvailableBytes:100},
		"b":{OfferID:"b",NodeID:"node-b",ProviderID:"same-provider",UnitPrice420:2,AvailableBytes:100},
	}}
	_, err := SelectRepairProviders(context.Background(), reconstruction, manifest, reader, []RepairProviderCandidate{{OfferID:"a",NodeID:"x",ProviderID:"x"},{OfferID:"b",NodeID:"x",ProviderID:"x"}})
	if !errors.Is(err,ErrInvalidRepairState) { t.Fatalf("err=%v",err) }
}

func TestSelectRepairProvidersRequiresEnoughCapacity(t *testing.T) {
	reconstruction, manifest := selectionFixture()
	reader := fakeEligibilityReader{verified:map[string]RepairProviderCandidate{
		"a":{OfferID:"a",NodeID:"node-a",ProviderID:"provider-a",UnitPrice420:1,AvailableBytes:100},
	}}
	_, err := SelectRepairProviders(context.Background(), reconstruction, manifest, reader, []RepairProviderCandidate{{OfferID:"a",NodeID:"x",ProviderID:"x"}})
	if !errors.Is(err,ErrInvalidRepairState) { t.Fatalf("err=%v",err) }
}

func repeatHex(pair string, n int) string { out:=""; for i:=0;i<n;i++ { out+=pair }; return out }

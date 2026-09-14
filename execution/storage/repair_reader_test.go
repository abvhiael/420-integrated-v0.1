package storage

import (
	"context"
	"testing"
)

type fakeRepairReader struct {
	snapshot RepairSnapshot
	err      error
}

func (f fakeRepairReader) RepairSnapshot(_ context.Context, _ string) (RepairSnapshot, error) {
	return f.snapshot, f.err
}

func repairSnapshotFixture() RepairSnapshot {
	return RepairSnapshot{
		RepairPolicyHash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
		Manifest: RepairManifest{
			ManifestID:   "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
			ObjectID:     "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
			ManifestHash: "0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
			ErasureRoot:  "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
			DataShards:   2,
			TotalShards:  4,
			Sealed:       true,
			Placements: []RepairPlacement{
				{ShardIndex: 0, AgreementID: "a0", CommitmentID: "c0", NodeID: "n0", ShardRoot: "r0", SizeBytes: 10, Live: true},
				{ShardIndex: 1, AgreementID: "a1", CommitmentID: "c1", NodeID: "n1", ShardRoot: "r1", SizeBytes: 10, Live: true},
				{ShardIndex: 2, AgreementID: "a2", CommitmentID: "c2", NodeID: "n2", ShardRoot: "r2", SizeBytes: 10, Live: false},
				{ShardIndex: 3, AgreementID: "a3", CommitmentID: "c3", NodeID: "n3", ShardRoot: "r3", SizeBytes: 10, Live: false},
			},
		},
	}
}

func TestEvaluateRepairResolvesPolicyAndPlans(t *testing.T) {
	snapshot := repairSnapshotFixture()
	resolver := StaticRepairPolicyResolver{
		snapshot.RepairPolicyHash: {TargetLiveShards: 3},
	}
	got, err := EvaluateRepair(context.Background(), fakeRepairReader{snapshot: snapshot}, resolver, snapshot.Manifest.ManifestID)
	if err != nil { t.Fatal(err) }
	if !got.Plan.Recoverable || !got.Plan.Degraded { t.Fatalf("plan=%+v", got.Plan) }
	if got.Plan.TargetLiveShards != 3 || len(got.Plan.ReplaceShards) != 1 || got.Plan.ReplaceShards[0] != 2 {
		t.Fatalf("unexpected repair plan: %+v", got.Plan)
	}
}

func TestEvaluateRepairRejectsUnknownPolicy(t *testing.T) {
	snapshot := repairSnapshotFixture()
	_, err := EvaluateRepair(context.Background(), fakeRepairReader{snapshot: snapshot}, StaticRepairPolicyResolver{}, snapshot.Manifest.ManifestID)
	if err == nil { t.Fatal("expected unknown repair policy to fail closed") }
}

func TestEvaluateRepairRejectsManifestMismatch(t *testing.T) {
	snapshot := repairSnapshotFixture()
	resolver := StaticRepairPolicyResolver{snapshot.RepairPolicyHash: {TargetLiveShards: 4}}
	_, err := EvaluateRepair(context.Background(), fakeRepairReader{snapshot: snapshot}, resolver, "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff")
	if err == nil { t.Fatal("expected manifest mismatch") }
}

func TestStaticRepairPolicyResolverBoundsTarget(t *testing.T) {
	snapshot := repairSnapshotFixture()
	resolver := StaticRepairPolicyResolver{snapshot.RepairPolicyHash: {TargetLiveShards: 1}}
	_, err := resolver.ResolveRepairPolicy(context.Background(), snapshot.RepairPolicyHash, snapshot.Manifest)
	if err == nil { t.Fatal("expected target below data-shard threshold to fail") }
}

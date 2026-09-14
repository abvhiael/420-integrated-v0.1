package storage

import (
	"bytes"
	"context"
	"io"
	"reflect"
	"testing"
)

type repairTestOpener struct {
	data map[uint32][]byte
	opened []uint32
}

func (o *repairTestOpener) OpenRepairShard(_ context.Context, shard RepairShardRef) (io.ReadCloser, error) {
	o.opened = append(o.opened, shard.ShardIndex)
	return io.NopCloser(bytes.NewReader(o.data[shard.ShardIndex])), nil
}

type repairTestCodec struct {
	result map[uint32][]byte
	sources []uint32
	targets []uint32
}

func (c *repairTestCodec) Reconstruct(_ context.Context, _ string, _, _ uint32, sources map[uint32]io.Reader, targets []uint32) (map[uint32][]byte, error) {
	for index := range sources { c.sources = append(c.sources, index) }
	c.targets = append([]uint32(nil), targets...)
	return c.result, nil
}

func reconstructionEvaluation(target []byte) RepairEvaluation {
	placements := []RepairPlacement{
		{ShardIndex:0,AgreementID:"0x01",CommitmentID:"0x11",NodeID:"0x21",ShardRoot:"0xaa",SizeBytes:4,Live:true},
		{ShardIndex:1,AgreementID:"0x02",CommitmentID:"0x12",NodeID:"0x22",ShardRoot:"0xbb",SizeBytes:4,Live:true},
		{ShardIndex:2,AgreementID:"0x03",CommitmentID:"0x13",NodeID:"0x23",ShardRoot:"0xcc",SizeBytes:4,Live:true},
		{ShardIndex:3,AgreementID:"0x04",CommitmentID:"0x14",NodeID:"0x24",ShardRoot:sha256HexBytes(target),SizeBytes:uint64(len(target)),Live:false},
	}
	manifest := RepairManifest{ManifestID:"0xabc",ObjectID:"0xdef",ManifestHash:"0x123",ErasureRoot:"0x456",DataShards:2,TotalShards:4,Sealed:true,Placements:placements}
	return RepairEvaluation{Snapshot:RepairSnapshot{Manifest:manifest,RepairPolicyHash:"0x999"},Policy:RepairPolicy{TargetLiveShards:4},Plan:RepairPlan{ManifestID:"0xabc",ObjectID:"0xdef",Recoverable:true,Degraded:true,LiveShards:3,RequiredShards:2,TargetLiveShards:4,SourceShards:[]uint32{2,0,1},ReplaceShards:[]uint32{3}}}
}

func TestBuildRepairReconstructionPlanSelectsMinimalDeterministicSources(t *testing.T) {
	plan, err := BuildRepairReconstructionPlan(reconstructionEvaluation([]byte("heal")))
	if err != nil { t.Fatal(err) }
	if got := []uint32{plan.Sources[0].ShardIndex, plan.Sources[1].ShardIndex}; !reflect.DeepEqual(got, []uint32{0,1}) {
		t.Fatalf("sources=%v", got)
	}
	if len(plan.Targets) != 1 || plan.Targets[0].ShardIndex != 3 { t.Fatalf("targets=%v", plan.Targets) }
}

func TestReconstructRepairShardsValidatesCanonicalOutput(t *testing.T) {
	target := []byte("heal")
	plan, err := BuildRepairReconstructionPlan(reconstructionEvaluation(target))
	if err != nil { t.Fatal(err) }
	opener := &repairTestOpener{data:map[uint32][]byte{0:[]byte("aaaa"),1:[]byte("bbbb")}}
	codec := &repairTestCodec{result:map[uint32][]byte{3:target}}
	out, err := ReconstructRepairShards(context.Background(), plan, opener, codec)
	if err != nil { t.Fatal(err) }
	if !bytes.Equal(out[3], target) { t.Fatalf("target=%q", out[3]) }
	if !reflect.DeepEqual(opener.opened, []uint32{0,1}) { t.Fatalf("opened=%v", opener.opened) }
	if !reflect.DeepEqual(codec.targets, []uint32{3}) { t.Fatalf("targets=%v", codec.targets) }
}

func TestReconstructRepairShardsRejectsWrongRoot(t *testing.T) {
	plan, err := BuildRepairReconstructionPlan(reconstructionEvaluation([]byte("heal")))
	if err != nil { t.Fatal(err) }
	opener := &repairTestOpener{data:map[uint32][]byte{0:[]byte("aaaa"),1:[]byte("bbbb")}}
	codec := &repairTestCodec{result:map[uint32][]byte{3:[]byte("fail")}}
	if _, err := ReconstructRepairShards(context.Background(), plan, opener, codec); err != ErrRepairReconstruction {
		t.Fatalf("err=%v", err)
	}
}

func TestBuildRepairReconstructionPlanRejectsUnrecoverable(t *testing.T) {
	eval := reconstructionEvaluation([]byte("heal"))
	eval.Plan.Recoverable = false
	if _, err := BuildRepairReconstructionPlan(eval); err != ErrInvalidRepairState { t.Fatalf("err=%v", err) }
}

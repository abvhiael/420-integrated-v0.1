package storage

import (
	"errors"
	"reflect"
	"testing"
)

func repairFixture(live ...uint32) RepairManifest {
	liveSet := map[uint32]bool{}
	for _, index := range live {
		liveSet[index] = true
	}
	placements := make([]RepairPlacement, 0, 4)
	for index := uint32(0); index < 4; index++ {
		placements = append(placements, RepairPlacement{
			ShardIndex:   index,
			AgreementID:  "agreement",
			CommitmentID: "commitment",
			NodeID:       "node",
			ShardRoot:    "root",
			SizeBytes:    1024,
			Live:         liveSet[index],
		})
	}
	return RepairManifest{
		ManifestID:   "manifest",
		ObjectID:     "object",
		ManifestHash: "manifest-hash",
		ErasureRoot:  "erasure-root",
		DataShards:   2,
		TotalShards:  4,
		Sealed:       true,
		Placements:   placements,
	}
}

func TestPlanRepairHealthyManifest(t *testing.T) {
	plan, err := PlanRepair(repairFixture(0, 1, 2, 3), RepairPolicy{})
	if err != nil {
		t.Fatal(err)
	}
	if !plan.Recoverable || plan.Degraded || plan.LiveShards != 4 {
		t.Fatalf("unexpected plan: %+v", plan)
	}
	if len(plan.ReplaceShards) != 0 {
		t.Fatalf("replace=%v", plan.ReplaceShards)
	}
}

func TestPlanRepairDegradedButRecoverable(t *testing.T) {
	plan, err := PlanRepair(repairFixture(0, 2), RepairPolicy{})
	if err != nil {
		t.Fatal(err)
	}
	if !plan.Recoverable || !plan.Degraded || plan.LiveShards != 2 {
		t.Fatalf("unexpected plan: %+v", plan)
	}
	if !reflect.DeepEqual(plan.SourceShards, []uint32{0, 2}) {
		t.Fatalf("sources=%v", plan.SourceShards)
	}
	if !reflect.DeepEqual(plan.ReplaceShards, []uint32{1, 3}) {
		t.Fatalf("replace=%v", plan.ReplaceShards)
	}
}

func TestPlanRepairUnrecoverableManifest(t *testing.T) {
	plan, err := PlanRepair(repairFixture(3), RepairPolicy{})
	if err != nil {
		t.Fatal(err)
	}
	if plan.Recoverable || !plan.Degraded || plan.LiveShards != 1 {
		t.Fatalf("unexpected plan: %+v", plan)
	}
	if !reflect.DeepEqual(plan.ReplaceShards, []uint32{0, 1, 2}) {
		t.Fatalf("replace=%v", plan.ReplaceShards)
	}
}

func TestPlanRepairHonorsLowerDurabilityTarget(t *testing.T) {
	plan, err := PlanRepair(repairFixture(0, 2, 3), RepairPolicy{TargetLiveShards: 3})
	if err != nil {
		t.Fatal(err)
	}
	if !plan.Recoverable || plan.Degraded {
		t.Fatalf("unexpected plan: %+v", plan)
	}
	if len(plan.ReplaceShards) != 0 {
		t.Fatalf("replace=%v", plan.ReplaceShards)
	}
}

func TestPlanRepairLimitsReplacementToPolicyDeficit(t *testing.T) {
	manifest := repairFixture(0, 2)
	plan, err := PlanRepair(manifest, RepairPolicy{TargetLiveShards: 3})
	if err != nil {
		t.Fatal(err)
	}
	if !plan.Degraded || !reflect.DeepEqual(plan.ReplaceShards, []uint32{1}) {
		t.Fatalf("unexpected plan: %+v", plan)
	}
}

func TestPlanRepairRejectsUnsealedManifest(t *testing.T) {
	manifest := repairFixture(0, 1, 2, 3)
	manifest.Sealed = false
	_, err := PlanRepair(manifest, RepairPolicy{})
	if !errors.Is(err, ErrInvalidRepairState) {
		t.Fatalf("got %v", err)
	}
}

func TestPlanRepairRejectsDuplicateShardIndex(t *testing.T) {
	manifest := repairFixture(0, 1, 2, 3)
	manifest.Placements[3].ShardIndex = 2
	_, err := PlanRepair(manifest, RepairPolicy{})
	if !errors.Is(err, ErrInvalidRepairState) {
		t.Fatalf("got %v", err)
	}
}

func TestPlanRepairRejectsInvalidTarget(t *testing.T) {
	manifest := repairFixture(0, 1, 2, 3)
	_, err := PlanRepair(manifest, RepairPolicy{TargetLiveShards: 1})
	if !errors.Is(err, ErrInvalidRepairState) {
		t.Fatalf("got %v", err)
	}
}

package storage

import (
	"errors"
	"sort"
	"strings"
)

var ErrInvalidRepairState = errors.New("invalid repair state")

type RepairPlacement struct {
	ShardIndex   uint32
	AgreementID  string
	CommitmentID string
	NodeID       string
	ShardRoot    string
	SizeBytes    uint64
	Live         bool
}

type RepairManifest struct {
	ManifestID   string
	ObjectID     string
	ManifestHash string
	ErasureRoot  string
	DataShards   uint32
	TotalShards  uint32
	Sealed       bool
	Placements   []RepairPlacement
}

type RepairPolicy struct {
	TargetLiveShards uint32
}

type RepairPlan struct {
	ManifestID       string
	ObjectID         string
	Recoverable      bool
	Degraded         bool
	LiveShards       uint32
	RequiredShards   uint32
	TargetLiveShards uint32
	SourceShards     []uint32
	ReplaceShards    []uint32
}

// PlanRepair is deliberately read-only. It derives repair intent from a
// canonical sealed manifest snapshot and live-placement state, but it does not
// select providers or create agreements, commitments, or placements.
func PlanRepair(manifest RepairManifest, policy RepairPolicy) (RepairPlan, error) {
	if strings.TrimSpace(manifest.ManifestID) == "" ||
		strings.TrimSpace(manifest.ObjectID) == "" ||
		strings.TrimSpace(manifest.ManifestHash) == "" ||
		manifest.DataShards == 0 ||
		manifest.TotalShards == 0 ||
		manifest.DataShards > manifest.TotalShards ||
		!manifest.Sealed {
		return RepairPlan{}, ErrInvalidRepairState
	}

	target := policy.TargetLiveShards
	if target == 0 {
		target = manifest.TotalShards
	}
	if target < manifest.DataShards || target > manifest.TotalShards {
		return RepairPlan{}, ErrInvalidRepairState
	}

	byIndex := make(map[uint32]RepairPlacement, manifest.TotalShards)
	for _, placement := range manifest.Placements {
		if placement.ShardIndex >= manifest.TotalShards {
			return RepairPlan{}, ErrInvalidRepairState
		}
		if _, exists := byIndex[placement.ShardIndex]; exists {
			return RepairPlan{}, ErrInvalidRepairState
		}
		if strings.TrimSpace(placement.AgreementID) == "" ||
			strings.TrimSpace(placement.CommitmentID) == "" ||
			strings.TrimSpace(placement.NodeID) == "" ||
			strings.TrimSpace(placement.ShardRoot) == "" ||
			placement.SizeBytes == 0 {
			return RepairPlan{}, ErrInvalidRepairState
		}
		byIndex[placement.ShardIndex] = placement
	}

	plan := RepairPlan{
		ManifestID:       manifest.ManifestID,
		ObjectID:         manifest.ObjectID,
		RequiredShards:   manifest.DataShards,
		TargetLiveShards: target,
	}

	for index := uint32(0); index < manifest.TotalShards; index++ {
		placement, exists := byIndex[index]
		if exists && placement.Live {
			plan.LiveShards++
			plan.SourceShards = append(plan.SourceShards, index)
		} else {
			plan.ReplaceShards = append(plan.ReplaceShards, index)
		}
	}

	plan.Recoverable = plan.LiveShards >= manifest.DataShards
	plan.Degraded = plan.LiveShards < target

	// A repair plan must never ask downstream execution to replace more shards
	// than necessary to restore the configured durability target.
	needed := uint32(0)
	if plan.Degraded {
		needed = target - plan.LiveShards
	}
	if uint32(len(plan.ReplaceShards)) > needed {
		plan.ReplaceShards = plan.ReplaceShards[:needed]
	}

	sort.Slice(plan.SourceShards, func(i, j int) bool { return plan.SourceShards[i] < plan.SourceShards[j] })
	sort.Slice(plan.ReplaceShards, func(i, j int) bool { return plan.ReplaceShards[i] < plan.ReplaceShards[j] })
	return plan, nil
}

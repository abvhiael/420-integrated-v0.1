package storage

import (
	"context"
	"errors"
	"fmt"
	"io"
	"sort"
	"strings"
)

var ErrRepairReconstruction = errors.New("repair reconstruction failed")

type RepairShardRef struct {
	ShardIndex   uint32
	AgreementID  string
	CommitmentID string
	NodeID       string
	ShardRoot    string
	SizeBytes    uint64
}

type RepairReconstructionPlan struct {
	ManifestID  string
	ObjectID    string
	ErasureRoot string
	DataShards  uint32
	TotalShards uint32
	Sources     []RepairShardRef
	Targets     []RepairShardRef
}

// BuildRepairReconstructionPlan converts a verified SR-5.2 evaluation into a
// deterministic reconstruction plan. It selects exactly dataShards live source
// shards, ordered by shard index, and binds every replacement target to the
// canonical root and size from the sealed manifest placement.
func BuildRepairReconstructionPlan(eval RepairEvaluation) (RepairReconstructionPlan, error) {
	manifest := eval.Snapshot.Manifest
	plan := eval.Plan
	if strings.TrimSpace(manifest.ManifestID) == "" ||
		strings.TrimSpace(manifest.ObjectID) == "" ||
		strings.TrimSpace(manifest.ErasureRoot) == "" ||
		!manifest.Sealed ||
		manifest.DataShards == 0 || manifest.TotalShards < manifest.DataShards ||
		!equalHex(plan.ManifestID, manifest.ManifestID) ||
		!plan.Recoverable || plan.RequiredShards != manifest.DataShards {
		return RepairReconstructionPlan{}, ErrInvalidRepairState
	}

	byIndex := make(map[uint32]RepairPlacement, len(manifest.Placements))
	for _, placement := range manifest.Placements {
		if placement.ShardIndex >= manifest.TotalShards {
			return RepairReconstructionPlan{}, ErrInvalidRepairState
		}
		if _, exists := byIndex[placement.ShardIndex]; exists {
			return RepairReconstructionPlan{}, ErrInvalidRepairState
		}
		byIndex[placement.ShardIndex] = placement
	}

	sourceIndices := append([]uint32(nil), plan.SourceShards...)
	targetIndices := append([]uint32(nil), plan.ReplaceShards...)
	sort.Slice(sourceIndices, func(i, j int) bool { return sourceIndices[i] < sourceIndices[j] })
	sort.Slice(targetIndices, func(i, j int) bool { return targetIndices[i] < targetIndices[j] })
	if uint32(len(sourceIndices)) < manifest.DataShards {
		return RepairReconstructionPlan{}, ErrInvalidRepairState
	}
	sourceIndices = sourceIndices[:manifest.DataShards]

	out := RepairReconstructionPlan{
		ManifestID: manifest.ManifestID,
		ObjectID: manifest.ObjectID,
		ErasureRoot: manifest.ErasureRoot,
		DataShards: manifest.DataShards,
		TotalShards: manifest.TotalShards,
	}
	seen := make(map[uint32]struct{}, len(sourceIndices)+len(targetIndices))
	for _, index := range sourceIndices {
		placement, ok := byIndex[index]
		if !ok || !placement.Live {
			return RepairReconstructionPlan{}, ErrInvalidRepairState
		}
		if err := validateRepairPlacement(placement); err != nil {
			return RepairReconstructionPlan{}, err
		}
		seen[index] = struct{}{}
		out.Sources = append(out.Sources, repairShardRef(placement))
	}
	for _, index := range targetIndices {
		if _, exists := seen[index]; exists {
			return RepairReconstructionPlan{}, ErrInvalidRepairState
		}
		placement, ok := byIndex[index]
		if !ok || placement.Live {
			return RepairReconstructionPlan{}, ErrInvalidRepairState
		}
		if err := validateRepairPlacement(placement); err != nil {
			return RepairReconstructionPlan{}, err
		}
		seen[index] = struct{}{}
		out.Targets = append(out.Targets, repairShardRef(placement))
	}
	return out, nil
}

func validateRepairPlacement(p RepairPlacement) error {
	if strings.TrimSpace(p.AgreementID) == "" || strings.TrimSpace(p.CommitmentID) == "" ||
		strings.TrimSpace(p.NodeID) == "" || strings.TrimSpace(p.ShardRoot) == "" || p.SizeBytes == 0 {
		return ErrInvalidRepairState
	}
	return nil
}

func repairShardRef(p RepairPlacement) RepairShardRef {
	return RepairShardRef{ShardIndex:p.ShardIndex, AgreementID:p.AgreementID, CommitmentID:p.CommitmentID, NodeID:p.NodeID, ShardRoot:p.ShardRoot, SizeBytes:p.SizeBytes}
}

// RepairShardOpener supplies canonical source bytes. The implementation may
// retrieve them from local 420Store storage, another provider, or a gateway,
// but must return bytes for the exact RepairShardRef requested.
type RepairShardOpener interface {
	OpenRepairShard(ctx context.Context, shard RepairShardRef) (io.ReadCloser, error)
}

// RepairCodec owns erasure reconstruction semantics. SR-5.3 deliberately keeps
// the codec provider-neutral; the coordinator supplies exactly dataShards
// canonical sources and requested target indexes.
type RepairCodec interface {
	Reconstruct(ctx context.Context, erasureRoot string, dataShards, totalShards uint32, sources map[uint32]io.Reader, targets []uint32) (map[uint32][]byte, error)
}

// ReconstructRepairShards executes reconstruction without mutating canonical
// chain state. Returned bytes are still unplaced; later SR-5 phases choose
// replacement providers and create agreements/commitments/placements.
func ReconstructRepairShards(ctx context.Context, plan RepairReconstructionPlan, opener RepairShardOpener, codec RepairCodec) (map[uint32][]byte, error) {
	if opener == nil || codec == nil || len(plan.Sources) != int(plan.DataShards) || len(plan.Targets) == 0 {
		return nil, ErrInvalidRepairState
	}
	readers := make(map[uint32]io.Reader, len(plan.Sources))
	closers := make([]io.Closer, 0, len(plan.Sources))
	for _, source := range plan.Sources {
		rc, err := opener.OpenRepairShard(ctx, source)
		if err != nil {
			for _, closer := range closers { _ = closer.Close() }
			return nil, fmt.Errorf("%w: open source %d: %v", ErrRepairReconstruction, source.ShardIndex, err)
		}
		closers = append(closers, rc)
		readers[source.ShardIndex] = rc
	}
	defer func() { for _, closer := range closers { _ = closer.Close() } }()

	targets := make([]uint32, len(plan.Targets))
	for i, target := range plan.Targets { targets[i] = target.ShardIndex }
	out, err := codec.Reconstruct(ctx, plan.ErasureRoot, plan.DataShards, plan.TotalShards, readers, targets)
	if err != nil { return nil, fmt.Errorf("%w: %v", ErrRepairReconstruction, err) }
	if len(out) != len(plan.Targets) { return nil, ErrRepairReconstruction }
	for _, target := range plan.Targets {
		data, ok := out[target.ShardIndex]
		if !ok || uint64(len(data)) != target.SizeBytes || !equalHex(sha256Hex(data), target.ShardRoot) {
			return nil, ErrRepairReconstruction
		}
	}
	return out, nil
}

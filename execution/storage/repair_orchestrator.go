package storage

import (
	"context"
	"fmt"
	"sort"
	"strings"
)

var ErrRepairOrchestration = fmt.Errorf("repair orchestration failed")

// RepairLifecycleSpec carries the immutable agreement envelope needed to create
// replacement storage state. These values must be derived from canonical state
// before orchestration begins; the coordinator never invents policy semantics.
type RepairLifecycleSpec struct {
	ContentRoot      string
	StorageClass     string
	RepairPolicyHash string
	ProofSchemeID    string
	StartTime        uint64
	EndTime          uint64
	ProofInterval    uint64
}

type RepairExecutionIntent struct {
	ManifestID  string
	ObjectID    string
	ManifestHash string
	DataShards  uint32
	TotalShards uint32
	Shard       RepairShardRef
	Candidate   RepairProviderCandidate
	Lifecycle   RepairLifecycleSpec
}

type RepairLifecycleState struct {
	AgreementID           string
	CommitmentID          string
	CapacityReservationID string
	AgreementActive       bool
	ShardTransferred      bool
	PlacementReplaced     bool
}

// RepairLifecycleWriter is deliberately expressed as idempotent Ensure* calls.
// Implementations may resume after process or RPC failure by reading canonical
// state and returning the already-created identifier instead of duplicating it.
type RepairLifecycleWriter interface {
	EnsureAgreement(ctx context.Context, intent RepairExecutionIntent) (string, error)
	EnsureCommitment(ctx context.Context, intent RepairExecutionIntent, agreementID string) (string, error)
	EnsureCapacityReservation(ctx context.Context, intent RepairExecutionIntent, agreementID string) (string, error)
	EnsureAgreementActive(ctx context.Context, intent RepairExecutionIntent, agreementID, commitmentID, reservationID string) error
	EnsureShardTransferred(ctx context.Context, intent RepairExecutionIntent, agreementID, commitmentID string) error
	EnsurePlacementReplaced(ctx context.Context, intent RepairExecutionIntent, agreementID string) error
	ReadRepairLifecycle(ctx context.Context, intent RepairExecutionIntent) (RepairLifecycleState, error)
}

type RepairExecutionResult struct {
	ManifestID string
	Shards     []RepairExecutionShardResult
}

type RepairExecutionShardResult struct {
	ShardIndex             uint32
	NodeID                 string
	AgreementID            string
	CommitmentID           string
	CapacityReservationID  string
	PlacementReplaced      bool
}

// ExecuteRepairSelection performs SR-5.6 lifecycle orchestration in the only
// safe order: agreement -> commitment -> capacity -> activation -> shard
// transfer -> canonical placement rotation. Every stage is restart-safe when
// backed by an idempotent RepairLifecycleWriter.
func ExecuteRepairSelection(
	ctx context.Context,
	reconstruction RepairReconstructionPlan,
	selection RepairSelectionPlan,
	manifest RepairManifest,
	lifecycle RepairLifecycleSpec,
	writer RepairLifecycleWriter,
) (RepairExecutionResult, error) {
	if writer == nil || !equalHex(reconstruction.ManifestID, manifest.ManifestID) || !equalHex(selection.ManifestID, manifest.ManifestID) {
		return RepairExecutionResult{}, ErrInvalidRepairState
	}
	if strings.TrimSpace(manifest.ManifestHash) == "" || strings.TrimSpace(manifest.ObjectID) == "" || len(reconstruction.Targets) == 0 || len(selection.Selections) != len(reconstruction.Targets) {
		return RepairExecutionResult{}, ErrInvalidRepairState
	}
	if err := validateRepairLifecycleSpec(lifecycle); err != nil {
		return RepairExecutionResult{}, err
	}

	targets := make(map[uint32]RepairShardRef, len(reconstruction.Targets))
	for _, target := range reconstruction.Targets {
		if err := validateRepairPlacement(RepairPlacement{
			ShardIndex: target.ShardIndex,
			AgreementID: target.AgreementID,
			CommitmentID: target.CommitmentID,
			NodeID: target.NodeID,
			ShardRoot: target.ShardRoot,
			SizeBytes: target.SizeBytes,
		}); err != nil {
			return RepairExecutionResult{}, err
		}
		if _, exists := targets[target.ShardIndex]; exists {
			return RepairExecutionResult{}, ErrInvalidRepairState
		}
		targets[target.ShardIndex] = target
	}

	selections := append([]RepairPlacementSelection(nil), selection.Selections...)
	sort.Slice(selections, func(i, j int) bool { return selections[i].ShardIndex < selections[j].ShardIndex })

	result := RepairExecutionResult{ManifestID: manifest.ManifestID, Shards: make([]RepairExecutionShardResult, 0, len(selections))}
	for _, selected := range selections {
		target, ok := targets[selected.ShardIndex]
		if !ok || selected.Candidate.AvailableBytes < target.SizeBytes || strings.TrimSpace(selected.Candidate.OfferID) == "" || strings.TrimSpace(selected.Candidate.NodeID) == "" || strings.TrimSpace(selected.Candidate.ProviderID) == "" {
			return RepairExecutionResult{}, ErrInvalidRepairState
		}
		intent := RepairExecutionIntent{
			ManifestID: manifest.ManifestID,
			ObjectID: manifest.ObjectID,
			ManifestHash: manifest.ManifestHash,
			DataShards: manifest.DataShards,
			TotalShards: manifest.TotalShards,
			Shard: target,
			Candidate: selected.Candidate,
			Lifecycle: lifecycle,
		}
		shardResult, err := executeRepairIntent(ctx, writer, intent)
		if err != nil {
			return RepairExecutionResult{}, err
		}
		result.Shards = append(result.Shards, shardResult)
	}
	return result, nil
}

func executeRepairIntent(ctx context.Context, writer RepairLifecycleWriter, intent RepairExecutionIntent) (RepairExecutionShardResult, error) {
	state, err := writer.ReadRepairLifecycle(ctx, intent)
	if err != nil {
		return RepairExecutionShardResult{}, fmt.Errorf("%w: read shard %d: %v", ErrRepairOrchestration, intent.Shard.ShardIndex, err)
	}
	if state.PlacementReplaced {
		if strings.TrimSpace(state.AgreementID) == "" || strings.TrimSpace(state.CommitmentID) == "" || strings.TrimSpace(state.CapacityReservationID) == "" {
			return RepairExecutionShardResult{}, ErrInvalidRepairState
		}
		return repairExecutionResult(intent, state), nil
	}

	agreementID := state.AgreementID
	if strings.TrimSpace(agreementID) == "" {
		agreementID, err = writer.EnsureAgreement(ctx, intent)
		if err != nil { return RepairExecutionShardResult{}, wrapRepairStage(intent.Shard.ShardIndex, "agreement", err) }
	}
	if strings.TrimSpace(agreementID) == "" { return RepairExecutionShardResult{}, ErrInvalidRepairState }

	commitmentID := state.CommitmentID
	if strings.TrimSpace(commitmentID) == "" {
		commitmentID, err = writer.EnsureCommitment(ctx, intent, agreementID)
		if err != nil { return RepairExecutionShardResult{}, wrapRepairStage(intent.Shard.ShardIndex, "commitment", err) }
	}
	if strings.TrimSpace(commitmentID) == "" { return RepairExecutionShardResult{}, ErrInvalidRepairState }

	reservationID := state.CapacityReservationID
	if strings.TrimSpace(reservationID) == "" {
		reservationID, err = writer.EnsureCapacityReservation(ctx, intent, agreementID)
		if err != nil { return RepairExecutionShardResult{}, wrapRepairStage(intent.Shard.ShardIndex, "capacity", err) }
	}
	if strings.TrimSpace(reservationID) == "" { return RepairExecutionShardResult{}, ErrInvalidRepairState }

	if !state.AgreementActive {
		if err := writer.EnsureAgreementActive(ctx, intent, agreementID, commitmentID, reservationID); err != nil {
			return RepairExecutionShardResult{}, wrapRepairStage(intent.Shard.ShardIndex, "activate", err)
		}
	}
	if !state.ShardTransferred {
		if err := writer.EnsureShardTransferred(ctx, intent, agreementID, commitmentID); err != nil {
			return RepairExecutionShardResult{}, wrapRepairStage(intent.Shard.ShardIndex, "transfer", err)
		}
	}
	if err := writer.EnsurePlacementReplaced(ctx, intent, agreementID); err != nil {
		return RepairExecutionShardResult{}, wrapRepairStage(intent.Shard.ShardIndex, "placement", err)
	}

	state = RepairLifecycleState{
		AgreementID: agreementID,
		CommitmentID: commitmentID,
		CapacityReservationID: reservationID,
		AgreementActive: true,
		ShardTransferred: true,
		PlacementReplaced: true,
	}
	return repairExecutionResult(intent, state), nil
}

func validateRepairLifecycleSpec(spec RepairLifecycleSpec) error {
	if strings.TrimSpace(spec.ContentRoot) == "" || strings.TrimSpace(spec.StorageClass) == "" || strings.TrimSpace(spec.RepairPolicyHash) == "" || strings.TrimSpace(spec.ProofSchemeID) == "" || spec.StartTime == 0 || spec.EndTime <= spec.StartTime || spec.ProofInterval == 0 || spec.ProofInterval > spec.EndTime-spec.StartTime {
		return ErrInvalidRepairState
	}
	return nil
}

func repairExecutionResult(intent RepairExecutionIntent, state RepairLifecycleState) RepairExecutionShardResult {
	return RepairExecutionShardResult{
		ShardIndex: intent.Shard.ShardIndex,
		NodeID: intent.Candidate.NodeID,
		AgreementID: state.AgreementID,
		CommitmentID: state.CommitmentID,
		CapacityReservationID: state.CapacityReservationID,
		PlacementReplaced: state.PlacementReplaced,
	}
}

func wrapRepairStage(index uint32, stage string, err error) error {
	return fmt.Errorf("%w: shard %d %s: %v", ErrRepairOrchestration, index, stage, err)
}

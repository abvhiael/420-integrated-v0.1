package storage

import (
	"context"
	"fmt"
	"strings"
	"time"
)

type JournaledRepairLifecycleWriter struct {
	Inner   RepairLifecycleWriter
	Journal RepairJournal
	Now     func() time.Time
}

func (w JournaledRepairLifecycleWriter) ReadRepairLifecycle(ctx context.Context, intent RepairExecutionIntent) (RepairLifecycleState, error) {
	if w.Inner == nil { return RepairLifecycleState{}, ErrRepairJournal }
	return w.Inner.ReadRepairLifecycle(ctx, intent)
}

func (w JournaledRepairLifecycleWriter) EnsureAgreement(ctx context.Context, intent RepairExecutionIntent) (string, error) {
	attempt := w.nextAttempt(ctx, intent)
	id, err := w.Inner.EnsureAgreement(ctx, intent)
	if err != nil { return "", w.recordFailure(ctx, intent, attempt, "agreement", err) }
	if err := w.record(ctx, intent, RepairJobEvent{Stage: RepairStageAgreement, Attempt: attempt, AgreementID: id, NodeID: intent.Candidate.NodeID}); err != nil { return "", err }
	return id, nil
}

func (w JournaledRepairLifecycleWriter) EnsureCommitment(ctx context.Context, intent RepairExecutionIntent, agreementID string) (string, error) {
	attempt := w.nextAttempt(ctx, intent)
	id, err := w.Inner.EnsureCommitment(ctx, intent, agreementID)
	if err != nil { return "", w.recordFailure(ctx, intent, attempt, "commitment", err) }
	if err := w.record(ctx, intent, RepairJobEvent{Stage: RepairStageCommitment, Attempt: attempt, AgreementID: agreementID, CommitmentID: id, NodeID: intent.Candidate.NodeID}); err != nil { return "", err }
	return id, nil
}

func (w JournaledRepairLifecycleWriter) EnsureCapacityReservation(ctx context.Context, intent RepairExecutionIntent, agreementID string) (string, error) {
	attempt := w.nextAttempt(ctx, intent)
	id, err := w.Inner.EnsureCapacityReservation(ctx, intent, agreementID)
	if err != nil { return "", w.recordFailure(ctx, intent, attempt, "capacity", err) }
	if err := w.record(ctx, intent, RepairJobEvent{Stage: RepairStageCapacity, Attempt: attempt, AgreementID: agreementID, ReservationID: id, NodeID: intent.Candidate.NodeID}); err != nil { return "", err }
	return id, nil
}

func (w JournaledRepairLifecycleWriter) EnsureAgreementActive(ctx context.Context, intent RepairExecutionIntent, agreementID, commitmentID, reservationID string) error {
	attempt := w.nextAttempt(ctx, intent)
	if err := w.Inner.EnsureAgreementActive(ctx, intent, agreementID, commitmentID, reservationID); err != nil { return w.recordFailure(ctx, intent, attempt, "activate", err) }
	return w.record(ctx, intent, RepairJobEvent{Stage: RepairStageActivated, Attempt: attempt, AgreementID: agreementID, CommitmentID: commitmentID, ReservationID: reservationID, NodeID: intent.Candidate.NodeID})
}

func (w JournaledRepairLifecycleWriter) EnsureShardTransferred(ctx context.Context, intent RepairExecutionIntent, agreementID, commitmentID string) error {
	attempt := w.nextAttempt(ctx, intent)
	if err := w.Inner.EnsureShardTransferred(ctx, intent, agreementID, commitmentID); err != nil { return w.recordFailure(ctx, intent, attempt, "transfer", err) }
	return w.record(ctx, intent, RepairJobEvent{Stage: RepairStageTransferred, Attempt: attempt, AgreementID: agreementID, CommitmentID: commitmentID, NodeID: intent.Candidate.NodeID})
}

func (w JournaledRepairLifecycleWriter) EnsurePlacementReplaced(ctx context.Context, intent RepairExecutionIntent, agreementID string) error {
	attempt := w.nextAttempt(ctx, intent)
	if err := w.Inner.EnsurePlacementReplaced(ctx, intent, agreementID); err != nil { return w.recordFailure(ctx, intent, attempt, "placement", err) }
	return w.record(ctx, intent, RepairJobEvent{Stage: RepairStageReplaced, Attempt: attempt, AgreementID: agreementID, NodeID: intent.Candidate.NodeID})
}

func (w JournaledRepairLifecycleWriter) RecordPlanned(ctx context.Context, intent RepairExecutionIntent) error {
	return w.record(ctx, intent, RepairJobEvent{Stage: RepairStagePlanned, Attempt: w.nextAttempt(ctx, intent), NodeID: intent.Candidate.NodeID})
}

func (w JournaledRepairLifecycleWriter) nextAttempt(ctx context.Context, intent RepairExecutionIntent) uint32 {
	if w.Journal == nil { return 1 }
	events, err := w.Journal.RepairEvents(ctx, RepairJobID(intent.ManifestID, intent.Shard.ShardIndex))
	if err != nil || len(events) == 0 { return 1 }
	var max uint32
	for _, e := range events { if e.Attempt > max { max = e.Attempt } }
	if events[len(events)-1].Stage == RepairStageFailed { return max + 1 }
	if max == 0 { return 1 }
	return max
}

func (w JournaledRepairLifecycleWriter) recordFailure(ctx context.Context, intent RepairExecutionIntent, attempt uint32, stage string, cause error) error {
	if cause == nil { return ErrRepairJournal }
	recordErr := w.record(ctx, intent, RepairJobEvent{Stage: RepairStageFailed, Attempt: attempt, NodeID: intent.Candidate.NodeID, Error: stage + ": " + cause.Error()})
	if recordErr != nil { return fmt.Errorf("%w: %v; journal: %v", cause, ErrRepairJournal, recordErr) }
	return cause
}

func (w JournaledRepairLifecycleWriter) record(ctx context.Context, intent RepairExecutionIntent, event RepairJobEvent) error {
	if w.Journal == nil || strings.TrimSpace(intent.ManifestID) == "" { return ErrRepairJournal }
	event.JobID = RepairJobID(intent.ManifestID, intent.Shard.ShardIndex)
	event.ManifestID = intent.ManifestID
	event.ShardIndex = intent.Shard.ShardIndex
	if event.At.IsZero() { event.At = w.now() }
	return w.Journal.AppendRepairEvent(ctx, event)
}

func (w JournaledRepairLifecycleWriter) now() time.Time {
	if w.Now != nil { return w.Now().UTC() }
	return time.Now().UTC()
}

var _ RepairLifecycleWriter = JournaledRepairLifecycleWriter{}

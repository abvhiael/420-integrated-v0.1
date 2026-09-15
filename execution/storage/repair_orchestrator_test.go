package storage

import (
	"context"
	"errors"
	"reflect"
	"testing"
)

type fakeRepairLifecycleWriter struct {
	state RepairLifecycleState
	calls []string
	fail  string
}

func (f *fakeRepairLifecycleWriter) ReadRepairLifecycle(context.Context, RepairExecutionIntent) (RepairLifecycleState, error) {
	f.calls = append(f.calls, "read")
	return f.state, nil
}
func (f *fakeRepairLifecycleWriter) EnsureAgreement(context.Context, RepairExecutionIntent) (string, error) {
	f.calls = append(f.calls, "agreement")
	if f.fail == "agreement" { return "", errors.New("boom") }
	f.state.AgreementID = "0xagreement"
	return f.state.AgreementID, nil
}
func (f *fakeRepairLifecycleWriter) EnsureCommitment(context.Context, RepairExecutionIntent, string) (string, error) {
	f.calls = append(f.calls, "commitment")
	if f.fail == "commitment" { return "", errors.New("boom") }
	f.state.CommitmentID = "0xcommitment"
	return f.state.CommitmentID, nil
}
func (f *fakeRepairLifecycleWriter) EnsureCapacityReservation(context.Context, RepairExecutionIntent, string) (string, error) {
	f.calls = append(f.calls, "capacity")
	if f.fail == "capacity" { return "", errors.New("boom") }
	f.state.CapacityReservationID = "0xreservation"
	return f.state.CapacityReservationID, nil
}
func (f *fakeRepairLifecycleWriter) EnsureAgreementActive(context.Context, RepairExecutionIntent, string, string, string) error {
	f.calls = append(f.calls, "activate")
	if f.fail == "activate" { return errors.New("boom") }
	f.state.AgreementActive = true
	return nil
}
func (f *fakeRepairLifecycleWriter) EnsureShardTransferred(context.Context, RepairExecutionIntent, string, string) error {
	f.calls = append(f.calls, "transfer")
	if f.fail == "transfer" { return errors.New("boom") }
	f.state.ShardTransferred = true
	return nil
}
func (f *fakeRepairLifecycleWriter) EnsurePlacementReplaced(context.Context, RepairExecutionIntent, string) error {
	f.calls = append(f.calls, "placement")
	if f.fail == "placement" { return errors.New("boom") }
	f.state.PlacementReplaced = true
	return nil
}

func repairOrchestrationFixture() (RepairReconstructionPlan, RepairSelectionPlan, RepairManifest, RepairLifecycleSpec) {
	manifest := RepairManifest{
		ManifestID: "0xmanifest", ObjectID: "0xobject", ManifestHash: "0xmanifesthash", ErasureRoot: "0xerasure",
		DataShards: 2, TotalShards: 4, Sealed: true,
	}
	target := RepairShardRef{ShardIndex: 3, AgreementID: "0xoldagreement", CommitmentID: "0xoldcommitment", NodeID: "0xoldnode", ShardRoot: "0xroot", SizeBytes: 1024}
	reconstruction := RepairReconstructionPlan{ManifestID: manifest.ManifestID, ObjectID: manifest.ObjectID, ErasureRoot: manifest.ErasureRoot, DataShards: 2, TotalShards: 4, Targets: []RepairShardRef{target}}
	selection := RepairSelectionPlan{ManifestID: manifest.ManifestID, Selections: []RepairPlacementSelection{{ShardIndex: 3, Candidate: RepairProviderCandidate{OfferID: "0xoffer", NodeID: "0xnewnode", ProviderID: "0xprovider", AvailableBytes: 4096}}}}
	lifecycle := RepairLifecycleSpec{ContentRoot: "0xcontent", StorageClass: "0xclass", RepairPolicyHash: "0xpolicy", ProofSchemeID: "0xscheme", StartTime: 100, EndTime: 1000, ProofInterval: 100}
	return reconstruction, selection, manifest, lifecycle
}

func TestExecuteRepairSelectionOrdersLifecycle(t *testing.T) {
	reconstruction, selection, manifest, lifecycle := repairOrchestrationFixture()
	writer := &fakeRepairLifecycleWriter{}
	result, err := ExecuteRepairSelection(context.Background(), reconstruction, selection, manifest, lifecycle, writer)
	if err != nil { t.Fatal(err) }
	wantCalls := []string{"read", "agreement", "commitment", "capacity", "activate", "transfer", "placement"}
	if !reflect.DeepEqual(writer.calls, wantCalls) { t.Fatalf("calls=%v want=%v", writer.calls, wantCalls) }
	if len(result.Shards) != 1 || !result.Shards[0].PlacementReplaced || result.Shards[0].AgreementID != "0xagreement" { t.Fatalf("unexpected result: %+v", result) }
}

func TestExecuteRepairSelectionResumesPartialLifecycle(t *testing.T) {
	reconstruction, selection, manifest, lifecycle := repairOrchestrationFixture()
	writer := &fakeRepairLifecycleWriter{state: RepairLifecycleState{AgreementID: "0xagreement", CommitmentID: "0xcommitment", CapacityReservationID: "0xreservation", AgreementActive: true}}
	_, err := ExecuteRepairSelection(context.Background(), reconstruction, selection, manifest, lifecycle, writer)
	if err != nil { t.Fatal(err) }
	wantCalls := []string{"read", "transfer", "placement"}
	if !reflect.DeepEqual(writer.calls, wantCalls) { t.Fatalf("calls=%v want=%v", writer.calls, wantCalls) }
}

func TestExecuteRepairSelectionStopsBeforePlacementOnTransferFailure(t *testing.T) {
	reconstruction, selection, manifest, lifecycle := repairOrchestrationFixture()
	writer := &fakeRepairLifecycleWriter{fail: "transfer"}
	_, err := ExecuteRepairSelection(context.Background(), reconstruction, selection, manifest, lifecycle, writer)
	if err == nil { t.Fatal("expected transfer failure") }
	for _, call := range writer.calls { if call == "placement" { t.Fatal("placement rotated after failed transfer") } }
}

func TestExecuteRepairSelectionAlreadyCompleteIsNoop(t *testing.T) {
	reconstruction, selection, manifest, lifecycle := repairOrchestrationFixture()
	writer := &fakeRepairLifecycleWriter{state: RepairLifecycleState{AgreementID: "0xagreement", CommitmentID: "0xcommitment", CapacityReservationID: "0xreservation", AgreementActive: true, ShardTransferred: true, PlacementReplaced: true}}
	result, err := ExecuteRepairSelection(context.Background(), reconstruction, selection, manifest, lifecycle, writer)
	if err != nil { t.Fatal(err) }
	if !reflect.DeepEqual(writer.calls, []string{"read"}) { t.Fatalf("calls=%v", writer.calls) }
	if !result.Shards[0].PlacementReplaced { t.Fatal("expected complete repair") }
}

func TestExecuteRepairSelectionRejectsMismatchedSelection(t *testing.T) {
	reconstruction, selection, manifest, lifecycle := repairOrchestrationFixture()
	selection.Selections[0].ShardIndex = 2
	_, err := ExecuteRepairSelection(context.Background(), reconstruction, selection, manifest, lifecycle, &fakeRepairLifecycleWriter{})
	if err == nil { t.Fatal("expected invalid repair state") }
}

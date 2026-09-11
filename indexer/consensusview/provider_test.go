package consensusview

import (
	"path/filepath"
	"testing"

	"github.com/420integrated/420-integrated/consensus/storage"
	ctypes "github.com/420integrated/420-integrated/consensus/types"
)

func TestConsensusProjection(t *testing.T) {
	path := filepath.Join(t.TempDir(), "consensus.json")
	store := storage.NewFileStore(path)
	var head, safe, finalized ctypes.Root
	head[31], safe[31], finalized[31] = 3, 2, 1
	seats := make([]uint16, 15)
	for i := range seats { seats[i] = uint16(i) }
	if err := store.Save(storage.Status{
		Head: ctypes.Checkpoint{Slot: 841, Root: head}, Safe: ctypes.Checkpoint{Slot: 840, Root: safe}, Finalized: ctypes.Checkpoint{Slot: 839, Root: finalized},
		NextSlot: 842, ActiveSeats: seats,
		ScheduledProposer: storage.ProposerStatus{Slot:842, Primary:1, Fallback1:2, Fallback2:3},
		LatestQC: storage.QCStatus{Slot:841, BlockRoot:"0xabc", ParentRoot:"0xdef", Signers:11},
	}); err != nil { t.Fatal(err) }
	p, err := New(path); if err != nil { t.Fatal(err) }
	status, err := p.Consensus(); if err != nil { t.Fatal(err) }
	if status.Epoch != 2 || status.SlotInEpoch != 2 { t.Fatalf("unexpected epoch projection: %+v", status) }
	if status.Rotation != 0 || status.ActiveValidatorCount != 15 { t.Fatalf("unexpected rotation/committee: %+v", status) }
	if !status.LatestQC.Certified || status.LatestQC.Quorum != 11 || status.LatestQC.Signers != 11 { t.Fatalf("unexpected QC: %+v", status.LatestQC) }
}

func TestConsensusProjectionRejectsBadQC(t *testing.T) {
	path := filepath.Join(t.TempDir(), "consensus.json")
	store := storage.NewFileStore(path)
	seats := make([]uint16, 15); for i := range seats { seats[i] = uint16(i) }
	if err := store.Save(storage.Status{NextSlot:1, ActiveSeats:seats, ScheduledProposer:storage.ProposerStatus{Slot:1,Primary:0,Fallback1:1,Fallback2:2}, LatestQC:storage.QCStatus{Slot:0,BlockRoot:"0xabc",Signers:10}}); err != nil { t.Fatal(err) }
	p, _ := New(path)
	if _, err := p.Consensus(); err == nil { t.Fatal("expected sub-quorum QC rejection") }
}

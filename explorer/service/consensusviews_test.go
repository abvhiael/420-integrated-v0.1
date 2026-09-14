package service

import (
	"context"
	"testing"
	"time"

	"github.com/420integrated/420-integrated/indexer/model"
)

type consensusCapableFake struct { *fakeIndexer; status model.ConsensusStatus }
func (f *consensusCapableFake) Consensus(context.Context) (model.ConsensusStatus, error) { return f.status, nil }

func TestConsensusView(t *testing.T) {
	seats := make([]uint16,15); for i:=range seats { seats[i]=uint16(i) }
	idx := &consensusCapableFake{fakeIndexer:&fakeIndexer{}, status:model.ConsensusStatus{
		ChainID:420, CurrentSlot:841, NextSlot:842, Epoch:2, SlotInEpoch:2, Rotation:0, SlotInRotation:842,
		SlotsPerEpoch:420, EpochsPerRotation:42, SlotsPerRotation:17640,
		ActiveValidatorCount:15, ActiveSeats:seats,
		ScheduledProposer:model.ConsensusProposer{Slot:842,Primary:1,Fallback1:2,Fallback2:3},
		LatestQC:model.ConsensusQC{Slot:841,BlockRoot:"0xabc",ParentRoot:"0xdef",Signers:11,Quorum:11,Certified:true},
		Head:model.ConsensusCheckpoint{Slot:841}, Safe:model.ConsensusCheckpoint{Slot:840}, Finalized:model.ConsensusCheckpoint{Slot:839},
	}}
	svc,err:=New(idx,420,time.Minute); if err!=nil { t.Fatal(err) }
	view,err:=svc.Consensus(context.Background()); if err!=nil { t.Fatal(err) }
	if view.QuorumParticipationPercent < 73.3 || view.QuorumParticipationPercent > 73.4 { t.Fatalf("unexpected participation: %f",view.QuorumParticipationPercent) }
	if view.SlotsUntilEpochBoundary != 418 { t.Fatalf("unexpected epoch boundary: %d",view.SlotsUntilEpochBoundary) }
	if view.SlotsUntilRotationBoundary != 16798 { t.Fatalf("unexpected rotation boundary: %d",view.SlotsUntilRotationBoundary) }
}

func TestConsensusViewRejectsProposerOutsideCommittee(t *testing.T) {
	idx:=&consensusCapableFake{fakeIndexer:&fakeIndexer{},status:model.ConsensusStatus{ChainID:420,NextSlot:1,SlotsPerEpoch:420,EpochsPerRotation:42,SlotsPerRotation:17640,ActiveValidatorCount:3,ActiveSeats:[]uint16{0,1,2},ScheduledProposer:model.ConsensusProposer{Slot:1,Primary:0,Fallback1:1,Fallback2:9}}}
	svc,_:=New(idx,420,time.Minute)
	if _,err:=svc.Consensus(context.Background());err==nil{t.Fatal("expected proposer membership rejection")}
}

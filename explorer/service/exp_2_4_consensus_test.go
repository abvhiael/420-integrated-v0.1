package service

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/420integrated/420-integrated/indexer/model"
)

func validEXP24Consensus() model.ConsensusStatus {
	return model.ConsensusStatus{
		ChainID:420,
		CurrentSlot:841, NextSlot:842,
		Epoch:2, SlotInEpoch:2,
		Rotation:0, SlotInRotation:842,
		SlotsPerEpoch:420, EpochsPerRotation:42, SlotsPerRotation:17640,
		ActiveValidatorCount:4, ActiveSeats:[]uint16{1,2,3,4},
		ScheduledProposer:model.ConsensusProposer{Slot:842,Primary:1,Fallback1:2,Fallback2:3},
		LatestQC:model.ConsensusQC{Slot:841,BlockRoot:"0xqc",ParentRoot:"0xparent",Signers:4,Quorum:3,Certified:true},
		Head:model.ConsensusCheckpoint{Slot:841,Root:"0xhead"},
		Safe:model.ConsensusCheckpoint{Slot:840,Root:"0xsafe"},
		Finalized:model.ConsensusCheckpoint{Slot:839,Root:"0xfinalized"},
	}
}

func exp24ConsensusService(t *testing.T, status model.ConsensusStatus) *Service {
	t.Helper()
	idx:=&consensusCapableFake{fakeIndexer:&fakeIndexer{},status:status}
	svc,err:=New(idx,420,time.Minute)
	if err!=nil { t.Fatal(err) }
	return svc
}

func TestEXP24ConsensusDerivedPresentation(t *testing.T) {
	view,err:=exp24ConsensusService(t,validEXP24Consensus()).Consensus(context.Background())
	if err!=nil { t.Fatal(err) }
	if view.SlotsUntilEpochBoundary!=418 || view.SlotsUntilRotationBoundary!=16798 {
		t.Fatalf("unexpected boundaries: epoch=%d rotation=%d",view.SlotsUntilEpochBoundary,view.SlotsUntilRotationBoundary)
	}
	if view.QuorumParticipationPercent!=100 {
		t.Fatalf("unexpected participation: %f",view.QuorumParticipationPercent)
	}
}

func TestEXP24ConsensusRejectsSlotAndDimensionDrift(t *testing.T) {
	cases:=[]struct{name string; mutate func(*model.ConsensusStatus); want string}{
		{"next-slot",func(s *model.ConsensusStatus){s.NextSlot=844},"current/next slot"},
		{"epoch",func(s *model.ConsensusStatus){s.Epoch=3},"epoch position"},
		{"slot-in-epoch",func(s *model.ConsensusStatus){s.SlotInEpoch=3},"epoch position"},
		{"rotation",func(s *model.ConsensusStatus){s.Rotation=1},"rotation position"},
		{"slot-in-rotation",func(s *model.ConsensusStatus){s.SlotInRotation=843},"rotation position"},
		{"rotation-dimensions",func(s *model.ConsensusStatus){s.SlotsPerRotation=17641},"rotation dimensions"},
	}
	for _,tc:=range cases{
		t.Run(tc.name,func(t *testing.T){
			st:=validEXP24Consensus(); tc.mutate(&st)
			_,err:=exp24ConsensusService(t,st).Consensus(context.Background())
			if err==nil || !strings.Contains(err.Error(),tc.want){t.Fatalf("err=%v want %q",err,tc.want)}
		})
	}
}

func TestEXP24ConsensusRejectsCheckpointAndQCDivergence(t *testing.T) {
	cases:=[]struct{name string; mutate func(*model.ConsensusStatus); want string}{
		{"missing-head-root",func(s *model.ConsensusStatus){s.Head.Root=""},"checkpoint without root"},
		{"qc-missing-root",func(s *model.ConsensusStatus){s.LatestQC.BlockRoot=""},"certified QC without block provenance"},
		{"qc-missing-parent",func(s *model.ConsensusStatus){s.LatestQC.ParentRoot=""},"certified QC without block provenance"},
		{"qc-beyond-head",func(s *model.ConsensusStatus){s.LatestQC.Slot=842},"QC beyond consensus head"},
		{"qc-too-few-signers",func(s *model.ConsensusStatus){s.LatestQC.Signers=2},"invalid QC participation"},
		{"qc-too-many-signers",func(s *model.ConsensusStatus){s.LatestQC.Signers=5},"invalid QC participation"},
	}
	for _,tc:=range cases{
		t.Run(tc.name,func(t *testing.T){
			st:=validEXP24Consensus(); tc.mutate(&st)
			_,err:=exp24ConsensusService(t,st).Consensus(context.Background())
			if err==nil || !strings.Contains(err.Error(),tc.want){t.Fatalf("err=%v want %q",err,tc.want)}
		})
	}
}

func TestEXP24ConsensusRejectsInvalidCommitteeShape(t *testing.T) {
	st:=validEXP24Consensus()
	st.ActiveValidatorCount=2
	st.ActiveSeats=[]uint16{1,2}
	st.ScheduledProposer=model.ConsensusProposer{Slot:842,Primary:1,Fallback1:2,Fallback2:1}
	if _,err:=exp24ConsensusService(t,st).Consensus(context.Background()); err==nil || !strings.Contains(err.Error(),"fewer than three") {
		t.Fatalf("expected minimum committee rejection, got %v",err)
	}
}

func TestEXP24HistoricalProducerTracePreservesAuthorityBoundary(t *testing.T) {
	block:=model.BlockRecord{
		ChainID:420,Number:77,Hash:"0xexecution",Finality:model.FinalityFinalized,SchemaVersion:"v1",
		Producer:&model.BlockProducer{ConsensusSlot:777,ProducerSeat:12,ProposerRank:1,ConsensusBlockRoot:"0xconsensus",Certified:true},
	}
	trace,err:=traceFromBlock(block)
	if err!=nil { t.Fatal(err) }
	if trace==nil || trace.ExecutionBlockHash!="0xexecution" || trace.ConsensusBlockRoot!="0xconsensus" ||
		trace.ConsensusSlot!=777 || trace.ProducerSeat!=12 || trace.ProposerRank!=1 || !trace.Certified {
		t.Fatalf("unexpected trace: %+v",trace)
	}
	if trace.CanonicalAuthority || trace.ExecutionAuthority=="" || trace.ConsensusAuthority=="" || trace.ProjectionAuthority=="" {
		t.Fatalf("authority boundary lost: %+v",trace)
	}
}

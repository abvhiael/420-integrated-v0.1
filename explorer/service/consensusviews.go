package service

import (
	"context"
	"errors"
	"fmt"

	"github.com/420integrated/420-integrated/indexer/model"
)

type consensusIndexerReader interface {
	Consensus(context.Context) (model.ConsensusStatus, error)
}

type ConsensusView struct {
	model.ConsensusStatus
	QuorumParticipationPercent float64 `json:"quorumParticipationPercent"`
	SlotsUntilEpochBoundary    uint64  `json:"slotsUntilEpochBoundary"`
	SlotsUntilRotationBoundary uint64  `json:"slotsUntilRotationBoundary"`
}

func (s *Service) Consensus(ctx context.Context) (ConsensusView, error) {
	reader, ok := s.indexer.(consensusIndexerReader)
	if !ok { return ConsensusView{}, errors.New("420Indexer consensus query capability unavailable") }
	status, err := reader.Consensus(ctx)
	if err != nil { return ConsensusView{}, err }
	if err := s.requireRecordChain(status.ChainID); err != nil { return ConsensusView{}, err }
	if status.Finalized.Slot > status.Safe.Slot || status.Safe.Slot > status.Head.Slot {
		return ConsensusView{}, errors.New("420Indexer returned inconsistent consensus finality ordering")
	}
	if status.SlotsPerEpoch == 0 || status.SlotsPerRotation == 0 || status.EpochsPerRotation == 0 {
		return ConsensusView{}, errors.New("420Indexer returned invalid consensus dimensions")
	}
	if status.ScheduledProposer.Slot != status.NextSlot {
		return ConsensusView{}, errors.New("420Indexer returned proposer schedule for wrong slot")
	}
	active := map[uint16]bool{}
	for _, seat := range status.ActiveSeats {
		if active[seat] { return ConsensusView{}, fmt.Errorf("420Indexer returned duplicate active seat %d", seat) }
		active[seat] = true
	}
	if len(active) != status.ActiveValidatorCount {
		return ConsensusView{}, errors.New("420Indexer returned active validator count inconsistent with active seats")
	}
	p := status.ScheduledProposer
	if !active[p.Primary] || !active[p.Fallback1] || !active[p.Fallback2] {
		return ConsensusView{}, errors.New("420Indexer returned proposer outside active committee")
	}
	if p.Primary == p.Fallback1 || p.Primary == p.Fallback2 || p.Fallback1 == p.Fallback2 {
		return ConsensusView{}, errors.New("420Indexer returned colliding proposer schedule")
	}
	if status.LatestQC.Certified {
		if status.LatestQC.Quorum <= 0 || status.LatestQC.Signers < status.LatestQC.Quorum || status.LatestQC.Signers > status.ActiveValidatorCount {
			return ConsensusView{}, errors.New("420Indexer returned invalid QC participation")
		}
	}
	participation := float64(0)
	if status.ActiveValidatorCount > 0 && status.LatestQC.Certified {
		participation = float64(status.LatestQC.Signers) * 100 / float64(status.ActiveValidatorCount)
	}
	epochRemaining := status.SlotsPerEpoch - status.SlotInEpoch
	rotationRemaining := status.SlotsPerRotation - status.SlotInRotation
	if epochRemaining == status.SlotsPerEpoch { epochRemaining = 0 }
	if rotationRemaining == status.SlotsPerRotation { rotationRemaining = 0 }
	return ConsensusView{ConsensusStatus: status, QuorumParticipationPercent: participation, SlotsUntilEpochBoundary: epochRemaining, SlotsUntilRotationBoundary: rotationRemaining}, nil
}

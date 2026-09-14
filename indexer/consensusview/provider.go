package consensusview

import (
	"encoding/hex"
	"errors"
	"fmt"

	"github.com/420integrated/420-integrated/consensus/storage"
	ctypes "github.com/420integrated/420-integrated/consensus/types"
	"github.com/420integrated/420-integrated/indexer/model"
)

var (
	ErrUnavailable = errors.New("consensus status unavailable")
	ErrInvalidStatus = errors.New("invalid consensus status")
)

type Provider struct { store *storage.FileStore }

func New(path string) (*Provider, error) {
	if path == "" { return nil, errors.New("consensus status path required") }
	return &Provider{store: storage.NewFileStore(path)}, nil
}

func rootString(root ctypes.Root) string { return "0x" + hex.EncodeToString(root[:]) }

func containsSeat(seats []uint16, seat uint16) bool {
	for _, s := range seats { if s == seat { return true } }
	return false
}

func (p *Provider) Consensus() (model.ConsensusStatus, error) {
	st, ok, err := p.store.Load()
	if err != nil { return model.ConsensusStatus{}, err }
	if !ok { return model.ConsensusStatus{}, ErrUnavailable }
	if st.Safe.Slot > st.Head.Slot || st.Finalized.Slot > st.Safe.Slot { return model.ConsensusStatus{}, fmt.Errorf("%w: finalized <= safe <= head violated", ErrInvalidStatus) }
	seen := map[uint16]bool{}
	for _, seat := range st.ActiveSeats {
		if seen[seat] { return model.ConsensusStatus{}, fmt.Errorf("%w: duplicate active seat %d", ErrInvalidStatus, seat) }
		seen[seat] = true
	}
	if len(st.ActiveSeats) < 3 { return model.ConsensusStatus{}, fmt.Errorf("%w: fewer than three active seats", ErrInvalidStatus) }
	sp := st.ScheduledProposer
	if sp.Slot != st.NextSlot { return model.ConsensusStatus{}, fmt.Errorf("%w: proposer slot %d does not match next slot %d", ErrInvalidStatus, sp.Slot, st.NextSlot) }
	if !containsSeat(st.ActiveSeats, sp.Primary) || !containsSeat(st.ActiveSeats, sp.Fallback1) || !containsSeat(st.ActiveSeats, sp.Fallback2) {
		return model.ConsensusStatus{}, fmt.Errorf("%w: proposer seat outside active committee", ErrInvalidStatus)
	}
	if sp.Primary == sp.Fallback1 || sp.Primary == sp.Fallback2 || sp.Fallback1 == sp.Fallback2 {
		return model.ConsensusStatus{}, fmt.Errorf("%w: proposer/fallback collision", ErrInvalidStatus)
	}
	quorum := (2*len(st.ActiveSeats))/3 + 1
	qc := model.ConsensusQC{Slot: st.LatestQC.Slot, BlockRoot: st.LatestQC.BlockRoot, ParentRoot: st.LatestQC.ParentRoot, Signers: st.LatestQC.Signers, Quorum: quorum}
	if st.LatestQC.BlockRoot != "" {
		if st.LatestQC.Signers < quorum || st.LatestQC.Signers > len(st.ActiveSeats) { return model.ConsensusStatus{}, fmt.Errorf("%w: latest QC signer count %d outside [%d,%d]", ErrInvalidStatus, st.LatestQC.Signers, quorum, len(st.ActiveSeats)) }
		qc.Certified = true
	}
	current := uint64(0)
	if st.NextSlot > 0 { current = st.NextSlot - 1 }
	return model.ConsensusStatus{
		ChainID: ctypes.ChainID, CurrentSlot: current, NextSlot: st.NextSlot,
		Epoch: st.NextSlot / ctypes.SlotsPerEpoch, SlotInEpoch: st.NextSlot % ctypes.SlotsPerEpoch,
		Rotation: st.NextSlot / ctypes.SlotsPerRotation, SlotInRotation: st.NextSlot % ctypes.SlotsPerRotation,
		SlotsPerEpoch: ctypes.SlotsPerEpoch, EpochsPerRotation: ctypes.EpochsPerRotation, SlotsPerRotation: ctypes.SlotsPerRotation,
		ActiveValidatorCount: len(st.ActiveSeats), ActiveSeats: append([]uint16(nil), st.ActiveSeats...),
		ScheduledProposer: model.ConsensusProposer{Slot: sp.Slot, Primary: sp.Primary, Fallback1: sp.Fallback1, Fallback2: sp.Fallback2}, LatestQC: qc,
		Head: model.ConsensusCheckpoint{Slot: st.Head.Slot, Root: rootString(st.Head.Root)},
		Safe: model.ConsensusCheckpoint{Slot: st.Safe.Slot, Root: rootString(st.Safe.Root)},
		Finalized: model.ConsensusCheckpoint{Slot: st.Finalized.Slot, Root: rootString(st.Finalized.Root)},
	}, nil
}

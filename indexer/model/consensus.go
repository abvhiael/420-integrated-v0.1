package model

// ConsensusCheckpoint is a non-authoritative projection of consensus-owned finality state.
type ConsensusCheckpoint struct {
	Slot uint64 `json:"slot"`
	Root string `json:"root"`
}

type ConsensusProposer struct {
	Slot      uint64 `json:"slot"`
	Primary   uint16 `json:"primary"`
	Fallback1 uint16 `json:"fallback1"`
	Fallback2 uint16 `json:"fallback2"`
}

type ConsensusQC struct {
	Slot       uint64 `json:"slot"`
	BlockRoot  string `json:"blockRoot"`
	ParentRoot string `json:"parentRoot"`
	Signers    int    `json:"signers"`
	Quorum     int    `json:"quorum"`
	Certified  bool   `json:"certified"`
}

type ConsensusStatus struct {
	ChainID              uint64              `json:"chainId"`
	CurrentSlot          uint64              `json:"currentSlot"`
	NextSlot             uint64              `json:"nextSlot"`
	Epoch                uint64              `json:"epoch"`
	SlotInEpoch          uint64              `json:"slotInEpoch"`
	Rotation             uint64              `json:"rotation"`
	SlotInRotation       uint64              `json:"slotInRotation"`
	SlotsPerEpoch        uint64              `json:"slotsPerEpoch"`
	EpochsPerRotation    uint64              `json:"epochsPerRotation"`
	SlotsPerRotation     uint64              `json:"slotsPerRotation"`
	ActiveValidatorCount int                 `json:"activeValidatorCount"`
	ActiveSeats          []uint16            `json:"activeSeats"`
	ScheduledProposer    ConsensusProposer   `json:"scheduledProposer"`
	LatestQC             ConsensusQC         `json:"latestQc"`
	Head                 ConsensusCheckpoint `json:"head"`
	Safe                 ConsensusCheckpoint `json:"safe"`
	Finalized            ConsensusCheckpoint `json:"finalized"`
}

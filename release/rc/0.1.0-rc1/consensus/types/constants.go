package types

const (
	ChainID uint64 = 420

	SlotSeconds       uint64 = 12
	SlotsPerEpoch     uint64 = 420
	EpochsPerRotation uint64 = 42
	SlotsPerRotation  uint64 = SlotsPerEpoch * EpochsPerRotation

	InitialBlockRewardKief uint64 = 4_200_000_000_000_000_000
	TailBlockRewardKief    uint64 = 420_000_000_000_000_000

	RewardEraBlocks uint64 = 420_000
)

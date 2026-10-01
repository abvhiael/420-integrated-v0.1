package systemcall

import (
	"bytes"
	"errors"
	"fmt"
	"math"
	"math/big"
	"sort"
)

const (
	ActionValidatorState = "420/SYSCALL/VALIDATOR_STATE/V1"
	ActionExitNotice     = "420/SYSCALL/VALIDATOR_EXIT_NOTICE/V1"
	ActionValidatorSlash = "420/SYSCALL/VALIDATOR_SLASH/V1"
	ActionRotation       = "420/SYSCALL/ROTATION_SNAPSHOT/V1"
	ActionReward         = "420/SYSCALL/REWARD/V1"

	issuanceReductionInterval uint64 = 420_000
	issuanceFloorEra          uint64 = 340
	allocationScale                  = uint64(1_000_000_000_000)
	minSecurityAllocation            = uint64(283_446_712_018)
	maxSecurityAllocation            = uint64(500_000_000_000)
	minActiveValidators       uint16 = 15
	maxActiveValidators       uint16 = 30
	bpsScale                  uint16 = 10_000
)

var (
	ValidatorRegistryTarget = Address{18: 0x04, 19: 0x23}
	RewardControllerTarget  = Address{18: 0x04, 19: 0x20}

	initialBlockIssuance = new(big.Int).SetUint64(4_200_000_000_000_000_000)
	floorBlockIssuance   = new(big.Int).SetUint64(420_000_000_000_000_000)

	selectorValidatorState = [4]byte{0x17, 0xe6, 0x19, 0xd8}
	selectorExitNotice     = [4]byte{0x3d, 0xc8, 0x4e, 0xd0}
	selectorSlash          = [4]byte{0x0c, 0x6c, 0x52, 0x04}
	selectorRotation       = [4]byte{0x65, 0x94, 0x41, 0x4c}
	selectorReward         = [4]byte{0xac, 0x11, 0xb5, 0xe1}

	ErrInvalidStakeOutcome = errors.New("invalid finalized Stake outcome")
	ErrSequenceOverflow    = errors.New("system-call sequence overflow")
)

type Address [20]byte

func (a Address) IsZero() bool { return a == Address{} }

type ValidatorStatus uint8

const (
	StatusNone ValidatorStatus = iota
	StatusRegistered
	StatusProbation
	StatusEligible
	StatusActive
	StatusNormalCooldown
	StatusSuspended
	StatusExited
	StatusWithdrawalHold
	StatusWithdrawable
)

type SlashOffense uint8

const (
	SlashNone SlashOffense = iota
	SlashInactivity
	SlashInvalidConsensusMessage
	SlashDoubleProposal
	SlashDoubleVote
	SlashSurroundVote
	SlashFinalityEquivocation
)

type DerivationContext struct {
	ExecutionBlock uint64
	ParentHash     [32]byte
	ChainID        uint64
}

type RotationSnapshotOutcome struct {
	Rotation         uint64
	EligibleSnapshot uint64
}

type ExitNoticeOutcome struct {
	ValidatorID    [32]byte
	NoticeRotation uint64
}

type SlashOutcome struct {
	Ordinal         uint32
	ValidatorID     [32]byte
	Offense         SlashOffense
	CorrelationTier uint8
	OwnedBond       *big.Int
	ProtocolCredit  *big.Int
	PenaltyBps      uint16
	EvidenceHash    [32]byte
	ResultingStatus ValidatorStatus
}

type ValidatorStateOutcome struct {
	ValidatorID           [32]byte
	Status                ValidatorStatus
	EffectiveSlot         uint64
	ActivationRotation    uint64
	ScheduledExitRotation uint64
	CooldownUntilRotation uint64
}

type RewardOutcome struct {
	BlockNumber  uint64
	Proposer     Address
	Participants []Address
	ActiveCount  uint16
}

type FinalizedStakeOutcomes struct {
	Rotation        *RotationSnapshotOutcome
	ExitNotices     []ExitNoticeOutcome
	Slashes         []SlashOutcome
	ValidatorStates []ValidatorStateOutcome
	Reward          *RewardOutcome
}

type SlashSettlement struct {
	OwnedSlashed  *big.Int
	CreditSlashed *big.Int
}

type RewardSettlement struct {
	GrossScheduled       *big.Int
	SecurityScheduled    *big.Int
	AttentionAmount      *big.Int
	DevelopmentAmount    *big.Int
	ProposerAmount       *big.Int
	PerParticipantAmount *big.Int
	Participants         []Address
}

func BuildStakeBatch(ctx DerivationContext, previousSequence uint64, outcomes FinalizedStakeOutcomes) (Batch, error) {
	if ctx.ChainID == 0 || ctx.ParentHash == ([32]byte{}) {
		return Batch{}, fmt.Errorf("%w: invalid execution context", ErrInvalidStakeOutcome)
	}

	calls := make([]Call, 0, 2+len(outcomes.ExitNotices)+len(outcomes.Slashes)+len(outcomes.ValidatorStates))
	nextSequence := previousSequence

	appendCall := func(action string, target Address, payload []byte) error {
		if nextSequence == math.MaxUint64 {
			return ErrSequenceOverflow
		}
		nextSequence++
		calls = append(calls, Call{
			Sequence:       nextSequence,
			ExecutionBlock: ctx.ExecutionBlock,
			ParentHash:     ctx.ParentHash,
			ChainID:        ctx.ChainID,
			Action:         action,
			Target:         [20]byte(target),
			Payload:        payload,
		})
		return nil
	}

	// Rotation is first because ACTIVE->NORMAL_COOLDOWN validation consumes the
	// just-finalized rotation boundary. Eligibility mutations in the same block
	// therefore affect the next snapshot, not the snapshot that triggered them.
	if outcomes.Rotation != nil {
		payload, err := EncodeRotationSnapshotPayload(*outcomes.Rotation)
		if err != nil {
			return Batch{}, err
		}
		if err := appendCall(ActionRotation, ValidatorRegistryTarget, payload); err != nil {
			return Batch{}, err
		}
	}

	exits := append([]ExitNoticeOutcome(nil), outcomes.ExitNotices...)
	sort.Slice(exits, func(i, j int) bool {
		return bytes.Compare(exits[i].ValidatorID[:], exits[j].ValidatorID[:]) < 0
	})
	for i, out := range exits {
		if i > 0 && out.ValidatorID == exits[i-1].ValidatorID {
			return Batch{}, fmt.Errorf("%w: duplicate exit notice validator", ErrInvalidStakeOutcome)
		}
		payload, err := EncodeExitNoticePayload(out)
		if err != nil {
			return Batch{}, err
		}
		if err := appendCall(ActionExitNotice, ValidatorRegistryTarget, payload); err != nil {
			return Batch{}, err
		}
	}

	slashes := append([]SlashOutcome(nil), outcomes.Slashes...)
	sort.Slice(slashes, func(i, j int) bool {
		if slashes[i].Ordinal != slashes[j].Ordinal {
			return slashes[i].Ordinal < slashes[j].Ordinal
		}
		return bytes.Compare(slashes[i].EvidenceHash[:], slashes[j].EvidenceHash[:]) < 0
	})
	seenEvidence := make(map[[32]byte]struct{}, len(slashes))
	seenSlashOrdinal := make(map[uint32]struct{}, len(slashes))
	slashedValidators := make(map[[32]byte]struct{}, len(slashes))
	for _, out := range slashes {
		if out.EvidenceHash == ([32]byte{}) {
			return Batch{}, fmt.Errorf("%w: zero slash evidence", ErrInvalidStakeOutcome)
		}
		if _, ok := seenEvidence[out.EvidenceHash]; ok {
			return Batch{}, fmt.Errorf("%w: duplicate slash evidence", ErrInvalidStakeOutcome)
		}
		seenEvidence[out.EvidenceHash] = struct{}{}
		if _, ok := seenSlashOrdinal[out.Ordinal]; ok {
			return Batch{}, fmt.Errorf("%w: duplicate slash ordinal", ErrInvalidStakeOutcome)
		}
		seenSlashOrdinal[out.Ordinal] = struct{}{}
		slashedValidators[out.ValidatorID] = struct{}{}

		settlement, err := DeriveSlashSettlement(out)
		if err != nil {
			return Batch{}, err
		}
		payload, err := EncodeSlashPayload(out, settlement)
		if err != nil {
			return Batch{}, err
		}
		if err := appendCall(ActionValidatorSlash, ValidatorRegistryTarget, payload); err != nil {
			return Batch{}, err
		}
	}

	states := append([]ValidatorStateOutcome(nil), outcomes.ValidatorStates...)
	sort.Slice(states, func(i, j int) bool {
		return bytes.Compare(states[i].ValidatorID[:], states[j].ValidatorID[:]) < 0
	})
	for i, out := range states {
		if i > 0 && out.ValidatorID == states[i-1].ValidatorID {
			return Batch{}, fmt.Errorf("%w: duplicate validator state outcome", ErrInvalidStakeOutcome)
		}
		if _, ok := slashedValidators[out.ValidatorID]; ok {
			return Batch{}, fmt.Errorf("%w: slash and state mutation for the same validator must be a single finalized outcome", ErrInvalidStakeOutcome)
		}
		payload, err := EncodeValidatorStatePayload(out)
		if err != nil {
			return Batch{}, err
		}
		if err := appendCall(ActionValidatorState, ValidatorRegistryTarget, payload); err != nil {
			return Batch{}, err
		}
	}

	if outcomes.Reward != nil {
		if outcomes.Reward.BlockNumber != ctx.ExecutionBlock {
			return Batch{}, fmt.Errorf("%w: reward block does not match execution block", ErrInvalidStakeOutcome)
		}
		settlement, err := DeriveRewardSettlement(*outcomes.Reward)
		if err != nil {
			return Batch{}, err
		}
		payload, err := EncodeRewardPayload(*outcomes.Reward, settlement)
		if err != nil {
			return Batch{}, err
		}
		if err := appendCall(ActionReward, RewardControllerTarget, payload); err != nil {
			return Batch{}, err
		}
	}

	batch := Batch{
		ExecutionBlock: ctx.ExecutionBlock,
		ParentHash:     ctx.ParentHash,
		ChainID:        ctx.ChainID,
		Calls:          calls,
	}
	if err := batch.Validate(previousSequence); err != nil {
		return Batch{}, err
	}
	return batch, nil
}

func GrossBlockIssuance(blockNumber uint64) *big.Int {
	era := blockNumber / issuanceReductionInterval
	if era >= issuanceFloorEra {
		return new(big.Int).Set(floorBlockIssuance)
	}
	if era == 0 {
		return new(big.Int).Set(initialBlockIssuance)
	}

	numerator := new(big.Int).Exp(big.NewInt(995_800), new(big.Int).SetUint64(era), nil)
	denominator := new(big.Int).Exp(big.NewInt(1_000_000), new(big.Int).SetUint64(era), nil)
	gross := new(big.Int).Mul(new(big.Int).Set(initialBlockIssuance), numerator)
	gross.Quo(gross, denominator)
	if gross.Cmp(floorBlockIssuance) < 0 {
		return new(big.Int).Set(floorBlockIssuance)
	}
	return gross
}

func SecurityAllocationScale(activeCount uint16) (uint64, error) {
	if activeCount < minActiveValidators || activeCount > maxActiveValidators {
		return 0, fmt.Errorf("%w: active validator count %d outside bounded-validator range", ErrInvalidStakeOutcome, activeCount)
	}
	delta := maxSecurityAllocation - minSecurityAllocation
	return minSecurityAllocation + (delta*uint64(activeCount-minActiveValidators))/uint64(maxActiveValidators-minActiveValidators), nil
}

func DeriveRewardSettlement(out RewardOutcome) (RewardSettlement, error) {
	if out.BlockNumber == 0 || out.Proposer.IsZero() {
		return RewardSettlement{}, fmt.Errorf("%w: invalid reward identity/context", ErrInvalidStakeOutcome)
	}
	scale, err := SecurityAllocationScale(out.ActiveCount)
	if err != nil {
		return RewardSettlement{}, err
	}
	if len(out.Participants) > int(out.ActiveCount)-1 {
		return RewardSettlement{}, fmt.Errorf("%w: too many reward participants", ErrInvalidStakeOutcome)
	}

	participants := append([]Address(nil), out.Participants...)
	sort.Slice(participants, func(i, j int) bool {
		return bytes.Compare(participants[i][:], participants[j][:]) < 0
	})
	for i, participant := range participants {
		if participant.IsZero() || participant == out.Proposer {
			return RewardSettlement{}, fmt.Errorf("%w: invalid reward participant", ErrInvalidStakeOutcome)
		}
		if i > 0 && participant == participants[i-1] {
			return RewardSettlement{}, fmt.Errorf("%w: duplicate reward participant", ErrInvalidStakeOutcome)
		}
	}

	gross := GrossBlockIssuance(out.BlockNumber)
	security := new(big.Int).Mul(new(big.Int).Set(gross), new(big.Int).SetUint64(scale))
	security.Quo(security, new(big.Int).SetUint64(allocationScale))

	remaining := new(big.Int).Sub(new(big.Int).Set(gross), security)
	attention := new(big.Int).Quo(new(big.Int).Set(remaining), big.NewInt(2))
	development := new(big.Int).Sub(new(big.Int).Set(remaining), attention)
	proposer := new(big.Int).Quo(new(big.Int).Set(security), big.NewInt(2))
	participantPool := new(big.Int).Sub(new(big.Int).Set(security), proposer)
	perParticipant := new(big.Int).Quo(participantPool, new(big.Int).SetUint64(uint64(out.ActiveCount-1)))

	return RewardSettlement{
		GrossScheduled:       gross,
		SecurityScheduled:    security,
		AttentionAmount:      attention,
		DevelopmentAmount:    development,
		ProposerAmount:       proposer,
		PerParticipantAmount: perParticipant,
		Participants:         participants,
	}, nil
}

func DeriveSlashSettlement(out SlashOutcome) (SlashSettlement, error) {
	if out.ValidatorID == ([32]byte{}) || out.EvidenceHash == ([32]byte{}) {
		return SlashSettlement{}, fmt.Errorf("%w: slash identity/evidence missing", ErrInvalidStakeOutcome)
	}
	if out.CorrelationTier > 2 || out.ResultingStatus == StatusNone || out.ResultingStatus > StatusWithdrawable {
		return SlashSettlement{}, fmt.Errorf("%w: invalid slash tier/status", ErrInvalidStakeOutcome)
	}
	owned, err := validUint256(out.OwnedBond)
	if err != nil {
		return SlashSettlement{}, err
	}
	credit, err := validUint256(out.ProtocolCredit)
	if err != nil {
		return SlashSettlement{}, err
	}
	effective := new(big.Int).Add(new(big.Int).Set(owned), credit)

	switch out.Offense {
	case SlashInactivity:
		if out.PenaltyBps != 0 {
			return SlashSettlement{}, fmt.Errorf("%w: inactivity principal penalty must be zero", ErrInvalidStakeOutcome)
		}
		return SlashSettlement{OwnedSlashed: new(big.Int), CreditSlashed: new(big.Int)}, nil
	case SlashFinalityEquivocation:
		if out.PenaltyBps != bpsScale {
			return SlashSettlement{}, fmt.Errorf("%w: finality equivocation must consume all collateral", ErrInvalidStakeOutcome)
		}
		return SlashSettlement{OwnedSlashed: new(big.Int).Set(owned), CreditSlashed: new(big.Int).Set(credit)}, nil
	case SlashInvalidConsensusMessage, SlashDoubleProposal, SlashDoubleVote, SlashSurroundVote:
	default:
		return SlashSettlement{}, fmt.Errorf("%w: invalid slash offense", ErrInvalidStakeOutcome)
	}

	if effective.Sign() == 0 {
		return SlashSettlement{}, fmt.Errorf("%w: slash collateral is zero", ErrInvalidStakeOutcome)
	}
	maxBps := maxSlashBps(out.Offense, out.CorrelationTier)
	if out.PenaltyBps == 0 || out.PenaltyBps > maxBps {
		return SlashSettlement{}, fmt.Errorf("%w: slash penalty %d exceeds %d", ErrInvalidStakeOutcome, out.PenaltyBps, maxBps)
	}
	total := new(big.Int).Mul(new(big.Int).Set(effective), new(big.Int).SetUint64(uint64(out.PenaltyBps)))
	total.Quo(total, new(big.Int).SetUint64(uint64(bpsScale)))
	if total.Sign() == 0 {
		return SlashSettlement{}, fmt.Errorf("%w: rounded slash penalty is zero", ErrInvalidStakeOutcome)
	}
	ownedSlashed := new(big.Int).Mul(new(big.Int).Set(total), owned)
	ownedSlashed.Quo(ownedSlashed, effective)
	creditSlashed := new(big.Int).Sub(new(big.Int).Set(total), ownedSlashed)
	return SlashSettlement{OwnedSlashed: ownedSlashed, CreditSlashed: creditSlashed}, nil
}

func maxSlashBps(offense SlashOffense, correlationTier uint8) uint16 {
	if offense == SlashFinalityEquivocation {
		return bpsScale
	}
	var base uint16
	switch offense {
	case SlashInvalidConsensusMessage:
		base = 250
	case SlashDoubleProposal:
		base = 500
	case SlashDoubleVote, SlashSurroundVote:
		base = 1_000
	default:
		return 0
	}
	return base * uint16(correlationTier+1)
}

func EncodeRotationSnapshotPayload(out RotationSnapshotOutcome) ([]byte, error) {
	if out.Rotation == 0 {
		return nil, fmt.Errorf("%w: rotation is zero", ErrInvalidStakeOutcome)
	}
	return encodeStatic(selectorRotation, wordUint64(out.Rotation), wordUint64(out.EligibleSnapshot)), nil
}

func EncodeExitNoticePayload(out ExitNoticeOutcome) ([]byte, error) {
	if out.ValidatorID == ([32]byte{}) || out.NoticeRotation == 0 {
		return nil, fmt.Errorf("%w: invalid exit notice", ErrInvalidStakeOutcome)
	}
	return encodeStatic(selectorExitNotice, out.ValidatorID, wordUint64(out.NoticeRotation)), nil
}

func EncodeValidatorStatePayload(out ValidatorStateOutcome) ([]byte, error) {
	if out.ValidatorID == ([32]byte{}) || out.Status == StatusNone || out.Status > StatusWithdrawable {
		return nil, fmt.Errorf("%w: invalid validator state", ErrInvalidStakeOutcome)
	}
	return encodeStatic(
		selectorValidatorState,
		out.ValidatorID,
		wordUint8(uint8(out.Status)),
		wordUint64(out.EffectiveSlot),
		wordUint64(out.ActivationRotation),
		wordUint64(out.ScheduledExitRotation),
		wordUint64(out.CooldownUntilRotation),
	), nil
}

func EncodeSlashPayload(out SlashOutcome, settlement SlashSettlement) ([]byte, error) {
	owned, err := wordBig(settlement.OwnedSlashed)
	if err != nil {
		return nil, err
	}
	credit, err := wordBig(settlement.CreditSlashed)
	if err != nil {
		return nil, err
	}
	return encodeStatic(
		selectorSlash,
		out.ValidatorID,
		wordUint8(uint8(out.Offense)),
		wordUint8(out.CorrelationTier),
		owned,
		credit,
		out.EvidenceHash,
		wordUint8(uint8(out.ResultingStatus)),
	), nil
}

func EncodeRewardPayload(out RewardOutcome, settlement RewardSettlement) ([]byte, error) {
	proposer, err := wordBig(settlement.ProposerAmount)
	if err != nil {
		return nil, err
	}
	perParticipant, err := wordBig(settlement.PerParticipantAmount)
	if err != nil {
		return nil, err
	}
	attention, err := wordBig(settlement.AttentionAmount)
	if err != nil {
		return nil, err
	}
	development, err := wordBig(settlement.DevelopmentAmount)
	if err != nil {
		return nil, err
	}

	headWords := 7
	payload := make([]byte, 4, 4+(headWords+1+len(settlement.Participants))*32)
	copy(payload, selectorReward[:])
	payload = append(payload, wordUint64(out.BlockNumber)[:]...)
	payload = append(payload, wordAddress(out.Proposer)[:]...)
	payload = append(payload, wordUint64(uint64(headWords*32))[:]...)
	payload = append(payload, proposer[:]...)
	payload = append(payload, perParticipant[:]...)
	payload = append(payload, attention[:]...)
	payload = append(payload, development[:]...)
	payload = append(payload, wordUint64(uint64(len(settlement.Participants)))[:]...)
	for _, participant := range settlement.Participants {
		payload = append(payload, wordAddress(participant)[:]...)
	}
	return payload, nil
}

func encodeStatic(selector [4]byte, words ...[32]byte) []byte {
	out := make([]byte, 4, 4+32*len(words))
	copy(out, selector[:])
	for _, word := range words {
		out = append(out, word[:]...)
	}
	return out
}

func wordUint8(v uint8) [32]byte { return wordUint64(uint64(v)) }

func wordUint64(v uint64) (out [32]byte) {
	for i := 0; i < 8; i++ {
		out[31-i] = byte(v)
		v >>= 8
	}
	return out
}

func wordAddress(v Address) (out [32]byte) {
	copy(out[12:], v[:])
	return out
}

func wordBig(v *big.Int) ([32]byte, error) {
	var out [32]byte
	n, err := validUint256(v)
	if err != nil {
		return out, err
	}
	b := n.Bytes()
	copy(out[32-len(b):], b)
	return out, nil
}

func validUint256(v *big.Int) (*big.Int, error) {
	if v == nil || v.Sign() < 0 || v.BitLen() > 256 {
		return nil, fmt.Errorf("%w: value outside uint256", ErrInvalidStakeOutcome)
	}
	return new(big.Int).Set(v), nil
}

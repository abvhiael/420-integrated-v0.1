package systemcall

import (
	"encoding/hex"
	"errors"
	"fmt"
)

// Frozen protocol identities. These are execution-layer constants, not configurable RPC options.
const (
	GatewayAddress     = "0x000000000000000000000000000000000000043c"
	RewardController   = "0x0000000000000000000000000000000000000420"
	ValidatorRegistry  = "0x0000000000000000000000000000000000000423"
	NativeSystemOrigin = "0xfffffffffffffffffffffffffffffffffffff420"

	ActionValidatorState      = "420/SYSCALL/VALIDATOR_STATE/V1"
	ActionValidatorExitNotice = "420/SYSCALL/VALIDATOR_EXIT_NOTICE/V1"
	ActionValidatorBond       = "420/SYSCALL/VALIDATOR_BOND/V1"
	ActionValidatorSlash      = "420/SYSCALL/VALIDATOR_SLASH/V1"
	ActionRotationSnapshot    = "420/SYSCALL/ROTATION_SNAPSHOT/V1"
	ActionReward              = "420/SYSCALL/REWARD/V1"
)

var (
	ErrSequence       = errors.New("invalid system-call sequence")
	ErrExecutionBlock = errors.New("invalid system-call execution block")
	ErrParentHash     = errors.New("invalid system-call parent hash")
	ErrChainID        = errors.New("invalid system-call chain id")
	ErrAction         = errors.New("invalid system-call action")
	ErrTarget         = errors.New("invalid system-call target")
	ErrPayload        = errors.New("invalid system-call payload")
)

// Envelope is the consensus-authored instruction that node420 injects into block execution.
// Action is the canonical domain string; the Solidity gateway receives keccak256(Action).
// Payload is exact ABI calldata for the frozen downstream selector.
type Envelope struct {
	Sequence       uint64
	ExecutionBlock uint64
	ParentHash     [32]byte
	ChainID        uint64
	Action         string
	Target         string
	Payload        []byte
}

// Context contains execution facts supplied by the block processor, never by JSON-RPC clients.
type Context struct {
	LastSequence uint64
	BlockNumber  uint64
	ParentHash   [32]byte
	ChainID      uint64
}

func (e Envelope) Validate(ctx Context) error {
	if e.Sequence != ctx.LastSequence+1 || e.Sequence == 0 {
		return ErrSequence
	}
	if e.ExecutionBlock != ctx.BlockNumber {
		return ErrExecutionBlock
	}
	if e.ParentHash != ctx.ParentHash || e.ParentHash == ([32]byte{}) {
		return ErrParentHash
	}
	if e.ChainID == 0 || e.ChainID != ctx.ChainID {
		return ErrChainID
	}
	if len(e.Payload) < 4 {
		return ErrPayload
	}
	expected, ok := TargetForAction(e.Action)
	if !ok {
		return ErrAction
	}
	if normalizeAddress(e.Target) != expected {
		return ErrTarget
	}
	return nil
}

func TargetForAction(action string) (string, bool) {
	switch action {
	case ActionValidatorState, ActionValidatorExitNotice, ActionValidatorBond, ActionValidatorSlash, ActionRotationSnapshot:
		return ValidatorRegistry, true
	case ActionReward:
		return RewardController, true
	default:
		return "", false
	}
}

func normalizeAddress(s string) string {
	if len(s) == 42 && s[:2] == "0x" {
		b, err := hex.DecodeString(s[2:])
		if err == nil && len(b) == 20 {
			return "0x" + hex.EncodeToString(b)
		}
	}
	return s
}

// CommitmentBytes is the canonical byte sequence to hash with legacy Keccak-256.
// It intentionally excludes transport framing. The execution patch and fourtwentyd must
// hash exactly these fields in this order when comparing system-call commitments.
func (e Envelope) CommitmentBytes(actionHash [32]byte, payloadHash [32]byte) []byte {
	out := make([]byte, 0, 32+8+8+32+8+32+20+32)
	out = append(out, []byte("420/CONSENSUS_SYSTEM_CALL/V1")...)
	out = appendU64(out, e.ChainID)
	out = appendU64(out, e.Sequence)
	out = appendU64(out, e.ExecutionBlock)
	out = append(out, e.ParentHash[:]...)
	out = append(out, actionHash[:]...)
	target, err := addressBytes(e.Target)
	if err != nil {
		return nil
	}
	out = append(out, target...)
	out = append(out, payloadHash[:]...)
	return out
}

func addressBytes(s string) ([]byte, error) {
	if len(s) != 42 || s[:2] != "0x" {
		return nil, fmt.Errorf("address: %w", ErrTarget)
	}
	b, err := hex.DecodeString(s[2:])
	if err != nil || len(b) != 20 {
		return nil, fmt.Errorf("address: %w", ErrTarget)
	}
	return b, nil
}

func appendU64(dst []byte, v uint64) []byte {
	return append(dst,
		byte(v>>56), byte(v>>48), byte(v>>40), byte(v>>32),
		byte(v>>24), byte(v>>16), byte(v>>8), byte(v),
	)
}

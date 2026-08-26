package systemcall

import (
	"encoding/hex"
	"errors"
	"fmt"
)

const (
	GatewayAddress     = "0x000000000000000000000000000000000000043c"
	RewardController   = "0x0000000000000000000000000000000000000420"
	ValidatorRegistry  = "0x0000000000000000000000000000000000000423"
	NativeSystemOrigin = "0xfffffffffffffffffffffffffffffffffffffffe"

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

type Envelope struct {
	Sequence       uint64
	ExecutionBlock uint64
	ParentHash     [32]byte
	ChainID        uint64
	Action         string
	Target         string
	Payload        []byte
}

type Context struct {
	LastSequence uint64
	BlockNumber  uint64
	ParentHash   [32]byte
	ChainID      uint64
}

func (e Envelope) Validate(ctx Context) error {
	if e.Sequence != ctx.LastSequence+1 || e.Sequence == 0 { return ErrSequence }
	if e.ExecutionBlock != ctx.BlockNumber { return ErrExecutionBlock }
	if e.ParentHash != ctx.ParentHash || e.ParentHash == ([32]byte{}) { return ErrParentHash }
	if e.ChainID == 0 || e.ChainID != ctx.ChainID { return ErrChainID }
	if len(e.Payload) < 4 { return ErrPayload }
	expected, ok := TargetForAction(e.Action)
	if !ok { return ErrAction }
	if normalizeAddress(e.Target) != expected { return ErrTarget }
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
		if err == nil && len(b) == 20 { return "0x" + hex.EncodeToString(b) }
	}
	return s
}

// SolidityCallHashPreimage returns the exact static abi.encode preimage for
// keccak256(abi.encode(DOMAIN, chainId, sequence, executionBlock, parentHash, action, target, payloadHash)).
func (e Envelope) SolidityCallHashPreimage(domainHash, actionHash, payloadHash [32]byte) ([]byte, error) {
	target, err := addressBytes(e.Target)
	if err != nil { return nil, err }
	out := make([]byte, 32*8)
	copy(out[0:32], domainHash[:])
	putU256U64(out[32:64], e.ChainID)
	putU256U64(out[64:96], e.Sequence)
	putU256U64(out[96:128], e.ExecutionBlock)
	copy(out[128:160], e.ParentHash[:])
	copy(out[160:192], actionHash[:])
	copy(out[204:224], target)
	copy(out[224:256], payloadHash[:])
	return out, nil
}

func addressBytes(s string) ([]byte, error) {
	if len(s) != 42 || s[:2] != "0x" { return nil, fmt.Errorf("address: %w", ErrTarget) }
	b, err := hex.DecodeString(s[2:])
	if err != nil || len(b) != 20 { return nil, fmt.Errorf("address: %w", ErrTarget) }
	return b, nil
}

func putU256U64(dst []byte, v uint64) {
	if len(dst) != 32 { panic("putU256U64 requires 32-byte destination") }
	dst[24] = byte(v >> 56); dst[25] = byte(v >> 48); dst[26] = byte(v >> 40); dst[27] = byte(v >> 32)
	dst[28] = byte(v >> 24); dst[29] = byte(v >> 16); dst[30] = byte(v >> 8); dst[31] = byte(v)
}

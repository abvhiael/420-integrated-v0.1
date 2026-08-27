package systemcall

import "fmt"

// MessageExecutor is the narrow adapter the node420 Geth patch must implement.
// ExecuteConsensusMessage must execute a zero-value EVM message from NativeSystemOrigin
// to GatewayAddress in the current block state and return an error on EVM revert/failure.
type MessageExecutor interface {
	ExecuteConsensusMessage(origin string, destination string, input []byte) error
}

// GatewayCalldataEncoder ABI-encodes ConsensusSystemCall420.apply(...).
// The execution package keeps ABI mechanics behind this interface so the Geth patch may use
// its native ABI implementation without pulling a second Ethereum stack into this module.
type GatewayCalldataEncoder interface {
	EncodeGatewayApply(e Envelope) ([]byte, error)
}

// ApplyBatch validates an ordered consensus batch against the current block context and
// applies it atomically from the caller's state-transition perspective. The state database
// adapter must snapshot/revert the whole block when this returns an error.
func ApplyBatch(ctx Context, calls []Envelope, encoder GatewayCalldataEncoder, exec MessageExecutor) error {
	last := ctx.LastSequence
	for i := range calls {
		local := ctx
		local.LastSequence = last
		if err := calls[i].Validate(local); err != nil {
			return fmt.Errorf("system call %d validation: %w", i, err)
		}
		input, err := encoder.EncodeGatewayApply(calls[i])
		if err != nil {
			return fmt.Errorf("system call %d encode: %w", i, err)
		}
		if err := exec.ExecuteConsensusMessage(NativeSystemOrigin, GatewayAddress, input); err != nil {
			return fmt.Errorf("system call %d execute: %w", i, err)
		}
		last = calls[i].Sequence
	}
	return nil
}

// ValidateBatch performs all context/sequence checks without executing EVM state.
// Payload semantic checks remain duplicated by ConsensusSystemCall420 on-chain.
func ValidateBatch(ctx Context, calls []Envelope) error {
	last := ctx.LastSequence
	for i := range calls {
		local := ctx
		local.LastSequence = last
		if err := calls[i].Validate(local); err != nil {
			return fmt.Errorf("system call %d validation: %w", i, err)
		}
		last = calls[i].Sequence
	}
	return nil
}

package types

import (
	"errors"

	csys "github.com/420integrated/420-integrated/consensus/systemcall"
)

var ErrSystemCallBatchRoot = errors.New("consensus block system-call batch root mismatch")

// ConsensusBlockBody carries consensus-owned data needed to reconstruct execution effects.
// The ordered calls are not folded directly into the SSZ header; the header commits their
// canonical SHA-256 root through ConsensusBlock.SystemCallBatchRoot.
type ConsensusBlockBody struct {
	SystemCalls []csys.Call `json:"systemCalls"`
}

// ConsensusBlockEnvelope is the canonical header+body object for persistence/wire transport.
type ConsensusBlockEnvelope struct {
	Header ConsensusBlock     `json:"header"`
	Body   ConsensusBlockBody `json:"body"`
}

// SystemCallBatch reconstructs the exact execution batch from consensus history.
func (b ConsensusBlockEnvelope) SystemCallBatch(chainID uint64, executionBlock uint64, parentExecutionHash [32]byte) csys.Batch {
	calls := make([]csys.Call, len(b.Body.SystemCalls))
	copy(calls, b.Body.SystemCalls)
	return csys.Batch{
		ExecutionBlock: executionBlock,
		ParentHash:     parentExecutionHash,
		ChainID:        chainID,
		Calls:          calls,
	}
}

// ValidateSystemCallCommitment proves that the persisted/wire body matches the signed
// consensus header commitment. The caller supplies execution context already committed by
// the consensus/execution linkage for this block.
func (b ConsensusBlockEnvelope) ValidateSystemCallCommitment(chainID uint64, executionBlock uint64, parentExecutionHash [32]byte, previousSequence uint64) error {
	batch := b.SystemCallBatch(chainID, executionBlock, parentExecutionHash)
	if err := batch.Validate(previousSequence); err != nil {
		return err
	}
	root := batch.Root()
	if Root(root) != b.Header.SystemCallBatchRoot {
		return ErrSystemCallBatchRoot
	}
	return nil
}

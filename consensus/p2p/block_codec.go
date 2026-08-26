package p2p

import (
	"encoding/json"
	"fmt"

	ctypes "github.com/420integrated/420-integrated/consensus/types"
)

// EncodeConsensusBlock is the canonical TopicBlock payload encoder. The block body includes
// the ordered system-call list whose root is signed by the consensus header.
func EncodeConsensusBlock(block ctypes.ConsensusBlockEnvelope) ([]byte, error) {
	return json.Marshal(block)
}

// DecodeConsensusBlock decodes the canonical TopicBlock payload. Root validation requires
// execution context and is performed by ConsensusBlockEnvelope.ValidateSystemCallCommitment.
func DecodeConsensusBlock(payload []byte) (ctypes.ConsensusBlockEnvelope, error) {
	var block ctypes.ConsensusBlockEnvelope
	if err := json.Unmarshal(payload, &block); err != nil {
		return block, fmt.Errorf("decode consensus block: %w", err)
	}
	return block, nil
}

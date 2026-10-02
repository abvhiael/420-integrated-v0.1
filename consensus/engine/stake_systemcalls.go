package engine

import (
	"context"

	csys "github.com/420integrated/420-integrated/consensus/systemcall"
)

// ForkchoiceUpdatedV3WithFinalizedStakeOutcomes is the fourtwentyd production
// construction path for a locally built execution payload. It derives the exact
// Stake system-call batch from finalized consensus outcomes and the persisted,
// canonical parent sequence before staging that batch at node420.
func (c *Client) ForkchoiceUpdatedV3WithFinalizedStakeOutcomes(
	ctx context.Context,
	state ForkchoiceStateV1,
	attrs *PayloadAttributesV3,
	sequences csys.SequenceManager,
	parent csys.SequenceAnchor,
	outcomes csys.FinalizedStakeOutcomes,
) (ForkchoiceUpdatedResponse, csys.Batch, error) {
	batch, err := sequences.BuildNext(parent, outcomes)
	if err != nil {
		return ForkchoiceUpdatedResponse{}, csys.Batch{}, err
	}
	resp, err := c.ForkchoiceUpdatedV3WithSystemCalls(ctx, state, attrs, batch, parent.LastSequence)
	if err != nil {
		return ForkchoiceUpdatedResponse{}, csys.Batch{}, err
	}
	return resp, batch, nil
}

// NewPayloadV3WithFinalizedStakeOutcomes reconstructs the same deterministic
// Stake batch when validating a payload received from another proposer. The
// exact derived batch is verified against payload extraData before import.
func (c *Client) NewPayloadV3WithFinalizedStakeOutcomes(
	ctx context.Context,
	payload ExecutionPayloadV3,
	versionedHashes []Hash32,
	parentBeaconBlockRoot Hash32,
	sequences csys.SequenceManager,
	parent csys.SequenceAnchor,
	outcomes csys.FinalizedStakeOutcomes,
) (PayloadStatusV1, csys.Batch, error) {
	batch, err := sequences.BuildNext(parent, outcomes)
	if err != nil {
		return PayloadStatusV1{}, csys.Batch{}, err
	}
	status, err := c.NewPayloadV3WithSystemCalls(
		ctx,
		payload,
		versionedHashes,
		parentBeaconBlockRoot,
		batch,
		parent.LastSequence,
	)
	if err != nil {
		return PayloadStatusV1{}, csys.Batch{}, err
	}
	return status, batch, nil
}

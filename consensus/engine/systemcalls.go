package engine

import (
	"context"
	"encoding/hex"
	"fmt"

	csys "github.com/420integrated/420-integrated/consensus/systemcall"
)

// EncodeSystemCallBatch converts the canonical consensus object to the authenticated
// engine420 transport without changing any committed field.
func EncodeSystemCallBatch(batch csys.Batch) SystemCallBatchV1 {
	root := batch.Root()
	out := SystemCallBatchV1{
		ExecutionBlock: hexQuantity(batch.ExecutionBlock),
		ParentHash:     Hash32("0x" + hex.EncodeToString(batch.ParentHash[:])),
		ChainID:        hexQuantity(batch.ChainID),
		BatchRoot:      Hash32("0x" + hex.EncodeToString(root[:])),
		Calls:          make([]SystemCallV1, len(batch.Calls)),
	}
	for i, c := range batch.Calls {
		out.Calls[i] = SystemCallV1{
			Sequence:       hexQuantity(c.Sequence),
			ExecutionBlock: hexQuantity(c.ExecutionBlock),
			ParentHash:     Hash32("0x" + hex.EncodeToString(c.ParentHash[:])),
			ChainID:        hexQuantity(c.ChainID),
			Action:         c.Action,
			Target:         "0x" + hex.EncodeToString(c.Target[:]),
			Payload:        "0x" + hex.EncodeToString(c.Payload),
		}
	}
	return out
}

// StageSystemCallBatch validates the consensus object and sends it to the paired
// node420 before payload construction/import. An ACCEPTED response must echo the root.
func (c *Client) StageSystemCallBatch(ctx context.Context, batch csys.Batch, previousSequence uint64) error {
	if err := batch.Validate(previousSequence); err != nil {
		return fmt.Errorf("validate consensus system-call batch: %w", err)
	}
	wire := EncodeSystemCallBatch(batch)
	status, err := c.SubmitSystemCallsV1(ctx, wire)
	if err != nil {
		return err
	}
	if status.Status != "ACCEPTED" {
		if status.ValidationError != nil {
			return fmt.Errorf("node420 rejected system-call batch: %s", *status.ValidationError)
		}
		return fmt.Errorf("node420 rejected system-call batch: status=%s", status.Status)
	}
	if status.BatchRoot != wire.BatchRoot {
		return fmt.Errorf("node420 system-call root mismatch: got=%s want=%s", status.BatchRoot, wire.BatchRoot)
	}
	return nil
}

// ForkchoiceUpdatedV3WithSystemCalls is the payload-building entrypoint for 420.
// It stages the committed batch before asking node420 to build on the parent.
func (c *Client) ForkchoiceUpdatedV3WithSystemCalls(
	ctx context.Context,
	state ForkchoiceStateV1,
	attrs *PayloadAttributesV3,
	batch csys.Batch,
	previousSequence uint64,
) (ForkchoiceUpdatedResponse, error) {
	parent := Hash32("0x" + hex.EncodeToString(batch.ParentHash[:]))
	if state.HeadBlockHash != parent {
		return ForkchoiceUpdatedResponse{}, fmt.Errorf("system-call batch parent %s != forkchoice head %s", parent, state.HeadBlockHash)
	}
	if err := c.StageSystemCallBatch(ctx, batch, previousSequence); err != nil {
		return ForkchoiceUpdatedResponse{}, err
	}
	return c.ForkchoiceUpdatedV3(ctx, state, attrs)
}

// NewPayloadV3WithSystemCalls stages the same committed batch before importing/validating
// a payload received from another proposer. This keeps builder and validator paths symmetric.
func (c *Client) NewPayloadV3WithSystemCalls(
	ctx context.Context,
	payload ExecutionPayloadV3,
	versionedHashes []Hash32,
	parentBeaconBlockRoot Hash32,
	batch csys.Batch,
	previousSequence uint64,
) (PayloadStatusV1, error) {
	if err := VerifyPayloadSystemCallRoot(payload, batch); err != nil {
		return PayloadStatusV1{}, err
	}
	if err := c.StageSystemCallBatch(ctx, batch, previousSequence); err != nil {
		return PayloadStatusV1{}, err
	}
	return c.NewPayloadV3(ctx, payload, versionedHashes, parentBeaconBlockRoot)
}

// VerifyPayloadSystemCallRoot checks the execution-header commitment before NewPayload.
func VerifyPayloadSystemCallRoot(payload ExecutionPayloadV3, batch csys.Batch) error {
	root := batch.Root()
	want := "0x" + hex.EncodeToString(root[:])
	if payload.ExtraData != want {
		return fmt.Errorf("execution payload system-call root mismatch: extraData=%s want=%s", payload.ExtraData, want)
	}
	parent := Hash32("0x" + hex.EncodeToString(batch.ParentHash[:]))
	if payload.ParentHash != parent {
		return fmt.Errorf("execution payload parent mismatch: got=%s want=%s", payload.ParentHash, parent)
	}
	return nil
}

func hexQuantity(v uint64) string { return fmt.Sprintf("0x%x", v) }

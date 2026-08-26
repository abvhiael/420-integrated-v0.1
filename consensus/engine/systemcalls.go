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

func hexQuantity(v uint64) string { return fmt.Sprintf("0x%x", v) }

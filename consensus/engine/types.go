package engine

import "context"

// Hash32 is an Engine API 32-byte hash encoded as 0x-prefixed hex.
type Hash32 string

type ForkchoiceStateV1 struct {
	HeadBlockHash      Hash32 `json:"headBlockHash"`
	SafeBlockHash      Hash32 `json:"safeBlockHash"`
	FinalizedBlockHash Hash32 `json:"finalizedBlockHash"`
}

type PayloadAttributesV3 struct {
	Timestamp             string `json:"timestamp"`
	PrevRandao            Hash32 `json:"prevRandao"`
	SuggestedFeeRecipient string `json:"suggestedFeeRecipient"`
	Withdrawals           []any  `json:"withdrawals"`
	ParentBeaconBlockRoot Hash32 `json:"parentBeaconBlockRoot"`
}

type PayloadStatusV1 struct {
	Status          string  `json:"status"`
	LatestValidHash *Hash32 `json:"latestValidHash,omitempty"`
	ValidationError *string `json:"validationError,omitempty"`
}

type ForkchoiceUpdatedResponse struct {
	PayloadStatus PayloadStatusV1 `json:"payloadStatus"`
	PayloadID     *string         `json:"payloadId,omitempty"`
}

type ExecutionPayloadV3 struct {
	ParentHash    Hash32   `json:"parentHash"`
	FeeRecipient  string   `json:"feeRecipient"`
	StateRoot     Hash32   `json:"stateRoot"`
	ReceiptsRoot  Hash32   `json:"receiptsRoot"`
	LogsBloom     string   `json:"logsBloom"`
	PrevRandao    Hash32   `json:"prevRandao"`
	BlockNumber   string   `json:"blockNumber"`
	GasLimit      string   `json:"gasLimit"`
	GasUsed       string   `json:"gasUsed"`
	Timestamp     string   `json:"timestamp"`
	ExtraData     string   `json:"extraData"`
	BaseFeePerGas string   `json:"baseFeePerGas"`
	BlockHash     Hash32   `json:"blockHash"`
	Transactions  []string `json:"transactions"`
	Withdrawals   []any    `json:"withdrawals"`
	BlobGasUsed   string   `json:"blobGasUsed,omitempty"`
	ExcessBlobGas string   `json:"excessBlobGas,omitempty"`
}

type GetPayloadV3Response struct {
	ExecutionPayload      ExecutionPayloadV3 `json:"executionPayload"`
	BlockValue            string             `json:"blockValue"`
	BlobsBundle           any                `json:"blobsBundle"`
	ShouldOverrideBuilder bool               `json:"shouldOverrideBuilder"`
}

// SystemCallV1 is the authenticated Engine transport representation. Numeric values are
// hex quantities to match Engine API conventions; payload is exact ABI calldata.
type SystemCallV1 struct {
	Sequence       string `json:"sequence"`
	ExecutionBlock string `json:"executionBlock"`
	ParentHash     Hash32 `json:"parentHash"`
	ChainID        string `json:"chainId"`
	Action         string `json:"action"`
	Target         string `json:"target"`
	Payload        string `json:"payload"`
}

type SystemCallBatchV1 struct {
	ExecutionBlock string         `json:"executionBlock"`
	ParentHash     Hash32         `json:"parentHash"`
	ChainID        string         `json:"chainId"`
	BatchRoot      Hash32         `json:"batchRoot"`
	Calls          []SystemCallV1 `json:"calls"`
}

type SystemCallBatchStatusV1 struct {
	Status          string  `json:"status"`
	BatchRoot       Hash32  `json:"batchRoot"`
	ValidationError *string `json:"validationError,omitempty"`
}

func (c *Client) ForkchoiceUpdatedV3(ctx context.Context, state ForkchoiceStateV1, attrs *PayloadAttributesV3) (ForkchoiceUpdatedResponse, error) {
	var out ForkchoiceUpdatedResponse
	err := c.Call(ctx, "engine_forkchoiceUpdatedV3", []any{state, attrs}, &out)
	return out, err
}

func (c *Client) GetPayloadV3(ctx context.Context, payloadID string) (GetPayloadV3Response, error) {
	var out GetPayloadV3Response
	err := c.Call(ctx, "engine_getPayloadV3", []any{payloadID}, &out)
	return out, err
}

func (c *Client) NewPayloadV3(ctx context.Context, payload ExecutionPayloadV3, versionedHashes []Hash32, parentBeaconBlockRoot Hash32) (PayloadStatusV1, error) {
	var out PayloadStatusV1
	err := c.Call(ctx, "engine_newPayloadV3", []any{payload, versionedHashes, parentBeaconBlockRoot}, &out)
	return out, err
}

// SubmitSystemCallsV1 stages the consensus-committed system-call batch for one execution block.
// This method exists only on the authenticated Engine endpoint of the patched node420 client.
func (c *Client) SubmitSystemCallsV1(ctx context.Context, batch SystemCallBatchV1) (SystemCallBatchStatusV1, error) {
	var out SystemCallBatchStatusV1
	err := c.Call(ctx, "engine420_submitSystemCallsV1", []any{batch}, &out)
	return out, err
}

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

// ExecutionPayloadV3 intentionally mirrors the common Engine API payload fields
// without importing Geth internals into fourtwentyd.
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

func (c *Client) ForkchoiceUpdatedV3(ctx context.Context, state ForkchoiceStateV1, attrs *PayloadAttributesV3) (ForkchoiceUpdatedResponse, error) {
	var out ForkchoiceUpdatedResponse
	params := []any{state, attrs}
	err := c.Call(ctx, "engine_forkchoiceUpdatedV3", params, &out)
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

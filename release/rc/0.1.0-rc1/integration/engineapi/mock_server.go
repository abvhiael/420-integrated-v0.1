package engineapi

import (
	"encoding/json"
	"net/http"
)

type Mock struct {
	PayloadID string
}

func (m Mock) Handler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			JSONRPC string            `json:"jsonrpc"`
			ID      uint64            `json:"id"`
			Method  string            `json:"method"`
			Params  []json.RawMessage `json:"params"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		var result any
		switch req.Method {
		case "engine_exchangeCapabilities":
			result = []string{"engine_forkchoiceUpdatedV3", "engine_getPayloadV3", "engine_newPayloadV3"}
		case "engine_forkchoiceUpdatedV3":
			result = map[string]any{
				"payloadStatus": map[string]any{"status": "VALID", "latestValidHash": "0x0000000000000000000000000000000000000000000000000000000000000001"},
				"payloadId":     m.PayloadID,
			}
		case "engine_getPayloadV3":
			result = map[string]any{
				"executionPayload": map[string]any{
					"parentHash":    "0x0000000000000000000000000000000000000000000000000000000000000001",
					"feeRecipient":  "0x0000000000000000000000000000000000000420",
					"stateRoot":     "0x0000000000000000000000000000000000000000000000000000000000000002",
					"receiptsRoot":  "0x0000000000000000000000000000000000000000000000000000000000000003",
					"logsBloom":     "0x00",
					"prevRandao":    "0x0000000000000000000000000000000000000000000000000000000000000420",
					"blockNumber":   "0x1",
					"gasLimit":      "0x1c9c380",
					"gasUsed":       "0x0",
					"timestamp":     "0x1",
					"extraData":     "0x",
					"baseFeePerGas": "0x3b9aca00",
					"blockHash":     "0x0000000000000000000000000000000000000000000000000000000000000004",
					"transactions":  []any{},
					"withdrawals":   []any{},
					"blobGasUsed":   "0x0",
					"excessBlobGas": "0x0",
				},
				"blockValue":            "0x0",
				"blobsBundle":           map[string]any{},
				"shouldOverrideBuilder": false,
			}
		case "engine_newPayloadV3":
			result = map[string]any{
				"status":          "VALID",
				"latestValidHash": "0x0000000000000000000000000000000000000000000000000000000000000004",
			}
		default:
			w.WriteHeader(http.StatusOK)
			json.NewEncoder(w).Encode(map[string]any{
				"jsonrpc": "2.0", "id": req.ID,
				"error": map[string]any{"code": -32601, "message": "method not found"},
			})
			return
		}
		json.NewEncoder(w).Encode(map[string]any{"jsonrpc": "2.0", "id": req.ID, "result": result})
	})
}

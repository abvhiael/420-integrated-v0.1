package evidence

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
)

func TestAcquirePinsCodeAndProofToObservedBlock(t *testing.T) {
	var proofBlock string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			Method string            `json:"method"`
			Params []json.RawMessage `json:"params"`
		}
		_ = json.NewDecoder(r.Body).Decode(&req)
		var result any
		switch req.Method {
		case "eth_chainId":
			result = "0x1a4"
		case "eth_blockNumber":
			result = "0x2"
		case "eth_getProof":
			_ = json.Unmarshal(req.Params[2], &proofBlock)
			result = map[string]any{"codeHash": testCodeHash}
		case "eth_getCode":
			var block string
			_ = json.Unmarshal(req.Params[1], &block)
			if block == "0x0" {
				result = "0x"
			} else {
				result = "0x6001600055"
			}
		case "eth_getBlockByNumber":
			var block string
			var full bool
			_ = json.Unmarshal(req.Params[0], &block)
			_ = json.Unmarshal(req.Params[1], &full)
			if full {
				result = map[string]any{"transactions": []any{map[string]any{"hash": txHash, "to": nil, "input": "0x6001600055"}}}
			} else if block == "0x1" {
				result = map[string]any{"number": "0x1", "hash": block1Hash}
			} else {
				result = map[string]any{"number": "0x2", "hash": block2Hash}
			}
		case "eth_getTransactionReceipt":
			result = map[string]any{"transactionHash": txHash, "blockHash": block1Hash, "contractAddress": testAddr}
		default:
			t.Fatalf("unexpected method %s", req.Method)
		}
		_ = json.NewEncoder(w).Encode(map[string]any{"jsonrpc": "2.0", "id": 1, "result": result})
	}))
	defer srv.Close()

	client, err := NewRPCClient(srv.URL)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := client.Acquire(context.Background(), testAddr, 420); err != nil {
		t.Fatal(err)
	}
	if proofBlock != "0x2" {
		t.Fatalf("eth_getProof block=%q want 0x2", proofBlock)
	}
}

func TestAcquireRejectsObservationBlockReorgDuringAcquisition(t *testing.T) {
	var latestHeaderReads atomic.Int32
	reorgHash := "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			Method string            `json:"method"`
			Params []json.RawMessage `json:"params"`
		}
		_ = json.NewDecoder(r.Body).Decode(&req)
		var result any
		switch req.Method {
		case "eth_chainId":
			result = "0x1a4"
		case "eth_blockNumber":
			result = "0x2"
		case "eth_getProof":
			result = map[string]any{"codeHash": testCodeHash}
		case "eth_getCode":
			var block string
			_ = json.Unmarshal(req.Params[1], &block)
			if block == "0x0" {
				result = "0x"
			} else {
				result = "0x6001600055"
			}
		case "eth_getBlockByNumber":
			var block string
			var full bool
			_ = json.Unmarshal(req.Params[0], &block)
			_ = json.Unmarshal(req.Params[1], &full)
			if full {
				result = map[string]any{"transactions": []any{map[string]any{"hash": txHash, "to": nil, "input": "0x6001600055"}}}
			} else if block == "0x1" {
				result = map[string]any{"number": "0x1", "hash": block1Hash}
			} else {
				hash := block2Hash
				if latestHeaderReads.Add(1) > 1 {
					hash = reorgHash
				}
				result = map[string]any{"number": "0x2", "hash": hash}
			}
		case "eth_getTransactionReceipt":
			result = map[string]any{"transactionHash": txHash, "blockHash": block1Hash, "contractAddress": testAddr}
		default:
			t.Fatalf("unexpected method %s", req.Method)
		}
		_ = json.NewEncoder(w).Encode(map[string]any{"jsonrpc": "2.0", "id": 1, "result": result})
	}))
	defer srv.Close()

	client, err := NewRPCClient(srv.URL)
	if err != nil {
		t.Fatal(err)
	}
	_, err = client.Acquire(context.Background(), testAddr, 420)
	if err == nil || !strings.Contains(err.Error(), "observation block changed") {
		t.Fatalf("expected reorg rejection, got %v", err)
	}
}


func TestDeploymentEvidenceRejectsMalformedHexInternally(t *testing.T) {
	e := DeploymentEvidence{
		ChainID:         420,
		Address:         "0xzz11111111111111111111111111111111111111",
		RuntimeBytecode: "0x6000",
		RuntimeCodeHash: testCodeHash,
		ObservedAt:      BlockContext{Number: 2, Hash: block2Hash},
		FirstCodeBlock:  BlockContext{Number: 1, Hash: block1Hash},
		MissingContextReason: MissingCreationTxUnresolved,
		Provenance:      "canonical_chain_state/rpc",
	}
	if err := e.Validate(); err == nil {
		t.Fatal("malformed address hex must be rejected")
	}
	e.Address = testAddr
	e.RuntimeBytecode = "0xzz00"
	if err := e.Validate(); err == nil {
		t.Fatal("malformed runtime bytecode must be rejected")
	}
}

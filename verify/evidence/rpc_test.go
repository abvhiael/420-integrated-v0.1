package evidence

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

const (
	testAddr = "0x1111111111111111111111111111111111111111"
	testCodeHash = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
	block1Hash = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
	block2Hash = "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc"
	txHash = "0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd"
)

func TestAcquireBindsCanonicalEvidenceAndRecoversTopLevelCreation(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var req struct { Method string `json:"method"`; Params []json.RawMessage `json:"params"` }
		_ = json.NewDecoder(r.Body).Decode(&req)
		var result any
		switch req.Method {
		case "eth_chainId": result = "0x1a4"
		case "eth_blockNumber": result = "0x2"
		case "eth_getProof": result = map[string]any{"codeHash":testCodeHash}
		case "eth_getCode":
			var block string; _ = json.Unmarshal(req.Params[1], &block)
			if block == "0x0" { result = "0x" } else { result = "0x6001600055" }
		case "eth_getBlockByNumber":
			var block string; var full bool; _ = json.Unmarshal(req.Params[0], &block); _ = json.Unmarshal(req.Params[1], &full)
			if full {
				result = map[string]any{"transactions":[]any{map[string]any{"hash":txHash,"to":nil,"input":"0x6001600055"}}}
			} else if block == "0x1" {
				result = map[string]any{"number":"0x1","hash":block1Hash}
			} else {
				result = map[string]any{"number":"0x2","hash":block2Hash}
			}
		case "eth_getTransactionReceipt": result = map[string]any{"transactionHash":txHash,"blockHash":block1Hash,"contractAddress":testAddr}
		default: t.Fatalf("unexpected method %s", req.Method)
		}
		_ = json.NewEncoder(w).Encode(map[string]any{"jsonrpc":"2.0","id":1,"result":result})
	}))
	defer srv.Close()

	client, err := NewRPCClient(srv.URL); if err != nil { t.Fatal(err) }
	e, err := client.Acquire(context.Background(), testAddr, 420); if err != nil { t.Fatal(err) }
	if e.ChainID != 420 || e.Address != testAddr || e.RuntimeCodeHash != testCodeHash { t.Fatalf("unexpected binding: %+v", e) }
	if e.FirstCodeBlock.Number != 1 || e.ObservedAt.Number != 2 { t.Fatalf("unexpected block provenance: %+v", e) }
	if e.Creation == nil || e.Creation.TransactionHash != txHash || e.Creation.CreationBytecode != "0x6001600055" { t.Fatalf("creation context not recovered: %+v", e.Creation) }
	if e.MissingContextReason != MissingNone { t.Fatalf("unexpected missing reason %q", e.MissingContextReason) }
	if !strings.Contains(e.BindingKey(), testCodeHash) { t.Fatalf("binding key missing code hash: %s", e.BindingKey()) }
}

func TestAcquireMarksGenesisPredeployExplicitly(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var req struct { Method string `json:"method"`; Params []json.RawMessage `json:"params"` }; _ = json.NewDecoder(r.Body).Decode(&req)
		var result any
		switch req.Method {
		case "eth_chainId": result = "0x1a4"
		case "eth_blockNumber": result = "0x0"
		case "eth_getCode": result = "0x6000"
		case "eth_getProof": result = map[string]any{"codeHash":testCodeHash}
		case "eth_getBlockByNumber": result = map[string]any{"number":"0x0","hash":block1Hash}
		default: t.Fatalf("unexpected method %s", req.Method)
		}
		_ = json.NewEncoder(w).Encode(map[string]any{"jsonrpc":"2.0","id":1,"result":result})
	}))
	defer srv.Close()
	client,_ := NewRPCClient(srv.URL)
	e,err := client.Acquire(context.Background(),testAddr,420); if err!=nil{t.Fatal(err)}
	if e.Creation != nil || e.MissingContextReason != MissingGenesisOrPredeploy { t.Fatalf("expected explicit genesis/predeploy reason: %+v", e) }
}

func TestAcquireRejectsWrongChain(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]any{"jsonrpc":"2.0","id":1,"result":"0x1"})
	}))
	defer srv.Close()
	client,_ := NewRPCClient(srv.URL)
	if _,err := client.Acquire(context.Background(),testAddr,420); err == nil || !strings.Contains(err.Error(),"wrong chain") { t.Fatalf("expected wrong-chain rejection, got %v",err) }
}

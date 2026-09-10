package rpc

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/420integrated/420-integrated/indexer/model"
)

func TestClientChainIDAndBundle(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		var req request
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil { t.Fatal(err) }
		w.Header().Set("content-type", "application/json")
		switch req.Method {
		case "eth_chainId":
			json.NewEncoder(w).Encode(map[string]interface{}{"jsonrpc":"2.0","id":req.ID,"result":"0x1a4"})
		case "eth_blockNumber":
			json.NewEncoder(w).Encode(map[string]interface{}{"jsonrpc":"2.0","id":req.ID,"result":"0x1"})
		case "eth_getBlockByNumber":
			json.NewEncoder(w).Encode(map[string]interface{}{"jsonrpc":"2.0","id":req.ID,"result":map[string]interface{}{
				"number":"0x1","hash":"0xb1","parentHash":"0xb0","timestamp":"0x64",
				"transactions":[]map[string]interface{}{{"hash":"0xt1","transactionIndex":"0x0","from":"0xaaa","to":"0xbbb"}},
			}})
		case "eth_getTransactionReceipt":
			json.NewEncoder(w).Encode(map[string]interface{}{"jsonrpc":"2.0","id":req.ID,"result":map[string]interface{}{
				"transactionHash":"0xt1","transactionIndex":"0x0","blockHash":"0xb1","blockNumber":"0x1","status":"0x1","gasUsed":"0x5208","contractAddress":"",
				"logs":[]map[string]interface{}{{"address":"0xccc","topics":[]string{"0xtopic"},"data":"0x","blockNumber":"0x1","blockHash":"0xb1","transactionHash":"0xt1","transactionIndex":"0x0","logIndex":"0x0"}},
			}})
		default:
			t.Fatalf("unexpected method %s", req.Method)
		}
	})
	srv := httptest.NewServer(mux)
	defer srv.Close()
	c := NewClient(srv.URL, time.Second)
	chainID, err := c.ChainID()
	if err != nil { t.Fatal(err) }
	if chainID != 420 { t.Fatalf("chain id=%d", chainID) }
	head, err := c.BlockNumber(context.Background())
	if err != nil || head != 1 { t.Fatalf("head=%d err=%v", head, err) }
	bundle, err := c.BundleByNumber(context.Background(), 420, 1, model.FinalityHead, "v1")
	if err != nil { t.Fatal(err) }
	if bundle.Block.Hash != "0xb1" || len(bundle.Transactions) != 1 || len(bundle.Receipts) != 1 || len(bundle.Logs) != 1 {
		t.Fatalf("unexpected bundle: %+v", bundle)
	}
	if bundle.Logs[0].BlockHash != "0xb1" || bundle.Receipts[0].Status != 1 { t.Fatalf("provenance lost: %+v %+v", bundle.Logs[0], bundle.Receipts[0]) }

	safe, err := c.SafeBlock(context.Background(), 420, "v1")
	if err != nil { t.Fatal(err) }
	if safe.Number != 1 || safe.Hash != "0xb1" || safe.Finality != model.FinalitySafe { t.Fatalf("unexpected safe block: %+v", safe) }
	finalized, err := c.FinalizedBlock(context.Background(), 420, "v1")
	if err != nil { t.Fatal(err) }
	if finalized.Number != 1 || finalized.Hash != "0xb1" || finalized.Finality != model.FinalityFinalized { t.Fatalf("unexpected finalized block: %+v", finalized) }
}

package rpc

import (
	"context"
	"encoding/json"
	"fmt"
	eng "github.com/420integrated/420-integrated/consensus/engine"
	"github.com/420integrated/420-integrated/indexer/model"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestNativeBundleUsesAuthenticatedEvidenceAndDetectsReorganization(t *testing.T) {
	for _, reorg := range []bool{false, true} {
		t.Run(fmt.Sprint(reorg), func(t *testing.T) {
			reads := 0
			hash := "0x1111111111111111111111111111111111111111111111111111111111111111"
			root := "0x2222222222222222222222222222222222222222222222222222222222222222"
			authenticated := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if r.Header.Get("Authorization") == "" {
					t.Error("unauthenticated evidence")
				}
				var q struct {
					ID     any
					Method string
				}
				json.NewDecoder(r.Body).Decode(&q)
				var result any
				switch q.Method {
				case "eth_getBlockByNumber":
					reads++
					h := hash
					if reorg && reads > 1 {
						h = root
					}
					result = map[string]any{"hash": h, "number": "0x1", "parentHash": root, "timestamp": "0xc", "extraData": root, "transactions": []any{}}
				case "engine420_getSystemCallLogsV1":
					result = eng.NativeLogArchive{BlockHash: eng.Hash32(hash), BlockNumber: "0x1", BatchRoot: eng.Hash32(root), Logs: []eng.NativeLog{{Address: "0x0000000000000000000000000000000000000423", Topics: []string{}, Data: "0x", BlockHash: hash, BlockNumber: "0x1", TransactionHash: "0x0000000000000000000000000000000000000000000000000000000000000000", TransactionIndex: "0x0", LogIndex: "0x0"}}}
				default:
					t.Error(q.Method)
				}
				json.NewEncoder(w).Encode(map[string]any{"jsonrpc": "2.0", "id": q.ID, "result": result})
			}))
			defer authenticated.Close()
			untrusted := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				t.Error("public RPC used as accounting authority")
				w.WriteHeader(500)
			}))
			defer untrusted.Close()
			engine, err := eng.NewClient(authenticated.URL, make([]byte, 32))
			if err != nil {
				t.Fatal(err)
			}
			client := NewClient(untrusted.URL, time.Second).WithNativeLogs(engine)
			bundle, err := client.BundleByNumber(context.Background(), 420, 1, model.FinalityHead, "v1")
			if reorg {
				if err == nil {
					t.Fatal("reorganization accepted")
				}
			} else if err != nil || len(bundle.Logs) != 1 || bundle.Logs[0].BlockHash != hash {
				t.Fatal(bundle, err)
			}
		})
	}
}

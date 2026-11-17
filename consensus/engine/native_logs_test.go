package engine

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestCanonicalNativeArchiveAuthenticationAndProvenance(t *testing.T) {
	hash := Hash32("0x" + "1111111111111111111111111111111111111111111111111111111111111111")
	root := Hash32("0x" + "2222222222222222222222222222222222222222222222222222222222222222")
	original := NativeLog{Address: "0x0000000000000000000000000000000000000423", Topics: []string{}, Data: "0x", BlockHash: string(hash), BlockNumber: "0x1", TransactionHash: "0x0000000000000000000000000000000000000000000000000000000000000000", TransactionIndex: "0x0", LogIndex: "0x0"}
	for _, name := range []string{"valid", "wrong block", "wrong root", "duplicate", "missing", "removed"} {
		t.Run(name, func(t *testing.T) {
			archive := NativeLogArchive{BlockHash: hash, BlockNumber: "0x1", BatchRoot: root, Logs: []NativeLog{original}}
			switch name {
			case "wrong block":
				archive.BlockHash = root
			case "wrong root":
				archive.BatchRoot = hash
			case "duplicate":
				archive.Logs = append(archive.Logs, original)
			case "missing":
				archive.Logs = nil
			case "removed":
				archive.Logs[0].Removed = true
			}
			srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if r.Header.Get("Authorization") == "" {
					t.Error("missing JWT")
				}
				var req struct {
					Method string
					Params []Hash32
					ID     any
				}
				json.NewDecoder(r.Body).Decode(&req)
				if req.Method != "engine420_getSystemCallLogsV1" || len(req.Params) != 1 || req.Params[0] != hash {
					t.Error("unpinned request")
				}
				json.NewEncoder(w).Encode(map[string]any{"jsonrpc": "2.0", "id": req.ID, "result": archive})
			}))
			defer srv.Close()
			c, err := NewClient(srv.URL, make([]byte, 32))
			if err != nil {
				t.Fatal(err)
			}
			_, err = c.CanonicalNativeLogs(context.Background(), 1, hash, root)
			if (err == nil) != (name == "valid") {
				t.Fatal(name, err)
			}
		})
	}
}

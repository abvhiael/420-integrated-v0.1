package accounting

import (
	"context"
	"encoding/json"
	"fmt"
	eng "github.com/420integrated/420-integrated/consensus/engine"
	sys "github.com/420integrated/420-integrated/consensus/systemcall"
	ethhash "github.com/420integrated/420-integrated/execution/storage"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestExecutionGettersPinnedToCanonicalHash(t *testing.T) {
	hash := hex32([32]byte{1})
	id := hex32([32]byte{2})
	calls := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var q struct {
			ID     any
			Method string
			Params []json.RawMessage
		}
		if err := json.NewDecoder(r.Body).Decode(&q); err != nil {
			t.Fatal(err)
		}
		if !strings.HasPrefix(r.Header.Get("Authorization"), "Bearer ") {
			t.Error("unauthenticated getter")
		}
		var pin struct {
			BlockHash        string
			RequireCanonical bool
		}
		json.Unmarshal(q.Params[1], &pin)
		if pin.BlockHash != hash || !pin.RequireCanonical {
			t.Error("unpinned accounting state")
		}
		result := "0x" + strings.Repeat("0", 64)
		switch q.Method {
		case "eth_getBalance":
			result = "0x0"
		case "eth_call":
			var c struct{ To, Data string }
			json.Unmarshal(q.Params[0], &c)
			switch c.Data {
			case ethhash.EventTopic("protocolVersion()")[:10]:
				v := 2
				if c.To == Registry {
					v = 3
				}
				result = fmt.Sprintf("0x%064x", v)
			case ethhash.EventTopic("getValidator(bytes32)")[:10] + id[2:]:
				result = fmt.Sprintf("0x%064x", 32) + strings.Repeat("0", 64) + fmt.Sprintf("%064x", 576) + strings.Repeat("0", 64*17)
			}
		default:
			t.Error(q.Method)
		}
		calls++
		json.NewEncoder(w).Encode(map[string]any{"jsonrpc": "2.0", "id": q.ID, "result": result})
	}))
	defer server.Close()
	client, err := eng.NewClient(server.URL, make([]byte, 32))
	if err != nil {
		t.Fatal(err)
	}
	source := &RPCSource{Engine: client}
	state, err := source.State(context.Background(), sys.SequenceAnchor{ChainID: 420, BlockHash: [32]byte{1}}, []string{id}, []string{ZeroAddress})
	if err != nil {
		t.Fatal(err)
	}
	if calls < 25 || state[vk(id, "status")] != "0" {
		t.Fatal("incomplete observation", calls, state)
	}
}
func TestABIWordRejectsMalformedOrOverflow(t *testing.T) {
	for _, raw := range []string{"", "0x0", "0x" + strings.Repeat("z", 64)} {
		if _, err := words(raw); err == nil {
			t.Fatal(raw)
		}
	}
	b := make([]byte, 32)
	b[0] = 1
	for _, kind := range []string{"uint64", "address", "bool"} {
		if _, err := wordValue(kind, b); err == nil {
			t.Fatal(kind)
		}
	}
}

package engine

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	csys "github.com/420integrated/420-integrated/consensus/systemcall"
)

type memorySequenceStore struct {
	anchor csys.SequenceAnchor
	ok     bool
}

func (m *memorySequenceStore) Load() (csys.SequenceAnchor, bool, error) {
	return m.anchor, m.ok, nil
}

func (m *memorySequenceStore) Store(anchor csys.SequenceAnchor) error {
	m.anchor, m.ok = anchor, true
	return nil
}

func TestForkchoiceDerivesAndStagesFinalizedStakeOutcomes(t *testing.T) {
	secret := []byte("0123456789abcdef0123456789abcdef")
	var parentHash [32]byte
	for i := range parentHash {
		parentHash[i] = 0x44
	}
	parentHex := "0x" + strings.Repeat("44", 32)
	store := &memorySequenceStore{}
	manager := csys.SequenceManager{Store: store}
	parent := csys.SequenceAnchor{ChainID: 420, ExecutionBlock: 100, BlockHash: parentHash, LastSequence: 9}
	if err := manager.RecoverCanonicalParent(parent); err != nil {
		t.Fatal(err)
	}

	methods := make([]string, 0, 2)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		verifyJWT(t, strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer "), secret)
		var req map[string]any
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			t.Fatal(err)
		}
		method := req["method"].(string)
		methods = append(methods, method)
		switch method {
		case "engine420_submitSystemCallsV1":
			params := req["params"].([]any)
			batch := params[0].(map[string]any)
			calls := batch["calls"].([]any)
			if len(calls) != 1 {
				t.Fatalf("calls=%d", len(calls))
			}
			call := calls[0].(map[string]any)
			if call["action"] != csys.ActionRotation || call["sequence"] != "0xa" {
				t.Fatalf("derived call=%v", call)
			}
			json.NewEncoder(w).Encode(map[string]any{
				"jsonrpc": "2.0", "id": req["id"],
				"result": map[string]any{"status": "ACCEPTED", "batchRoot": batch["batchRoot"]},
			})
		case "engine_forkchoiceUpdatedV3":
			json.NewEncoder(w).Encode(map[string]any{
				"jsonrpc": "2.0", "id": req["id"],
				"result": map[string]any{"payloadStatus": map[string]any{"status": "VALID"}, "payloadId": "0x01"},
			})
		default:
			t.Fatalf("unexpected method=%s", method)
		}
	}))
	defer server.Close()

	client, err := NewClient(server.URL, secret)
	if err != nil {
		t.Fatal(err)
	}
	resp, batch, err := client.ForkchoiceUpdatedV3WithFinalizedStakeOutcomes(
		context.Background(),
		ForkchoiceStateV1{HeadBlockHash: Hash32(parentHex)},
		&PayloadAttributesV3{},
		manager,
		parent,
		csys.FinalizedStakeOutcomes{
			Rotation: &csys.RotationSnapshotOutcome{Rotation: 7, EligibleSnapshot: 60},
		},
	)
	if err != nil {
		t.Fatal(err)
	}
	if resp.PayloadStatus.Status != "VALID" || len(batch.Calls) != 1 || batch.Calls[0].Sequence != 10 {
		t.Fatalf("resp=%+v batch=%+v", resp, batch)
	}
	if len(methods) != 2 || methods[0] != "engine420_submitSystemCallsV1" || methods[1] != "engine_forkchoiceUpdatedV3" {
		t.Fatalf("method order=%v", methods)
	}
}

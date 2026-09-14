package storage

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestRPCProofSubmitterSendsCanonicalCallAndWaitsForSuccess(t *testing.T) {
	commitment := "0x" + strings.Repeat("11", 32)
	challenge := "0x" + strings.Repeat("22", 32)
	registry := "0x" + strings.Repeat("33", 20)
	from := "0x" + strings.Repeat("44", 20)
	txHash := "0x" + strings.Repeat("55", 32)
	var calls int
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			Method string `json:"method"`
			Params []json.RawMessage `json:"params"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil { t.Fatal(err) }
		calls++
		w.Header().Set("Content-Type", "application/json")
		switch req.Method {
		case "eth_sendTransaction":
			var tx map[string]string
			if err := json.Unmarshal(req.Params[0], &tx); err != nil { t.Fatal(err) }
			if tx["from"] != from || tx["to"] != registry { t.Fatalf("tx=%v", tx) }
			data := tx["data"]
			if len(data) < 10 || data[:10] != "0x"+hexSelector("submitProof(bytes32,bytes32,uint64,bytes)") { t.Fatalf("selector=%s", data) }
			if !strings.Contains(data, strings.TrimPrefix(commitment,"0x")) || !strings.Contains(data, strings.TrimPrefix(challenge,"0x")) { t.Fatal("missing ids") }
			_, _ = w.Write([]byte(`{"jsonrpc":"2.0","id":1,"result":"`+txHash+`"}`))
		case "eth_getTransactionReceipt":
			_, _ = w.Write([]byte(`{"jsonrpc":"2.0","id":1,"result":{"status":"0x1","transactionHash":"`+txHash+`"}}`))
		default:
			t.Fatalf("method=%s", req.Method)
		}
	}))
	defer server.Close()

	s := RPCProofSubmitter{Backend:RPCBackend{URL:server.URL,Client:server.Client()},Registry:registry,From:from,PollInterval:time.Millisecond,ReceiptWait:time.Second}
	proof := Proof{CommitmentID:commitment,ChallengeID:challenge,Epoch:time.Unix(1700000000,0).UTC(),Payload:[]byte("proof-bytes")}
	if err := s.SubmitProof(context.Background(), proof); err != nil { t.Fatal(err) }
	if calls != 2 { t.Fatalf("calls=%d", calls) }
}

func TestRPCProofSubmitterRejectsRevertedReceipt(t *testing.T) {
	registry := "0x" + strings.Repeat("33", 20)
	from := "0x" + strings.Repeat("44", 20)
	txHash := "0x" + strings.Repeat("55", 32)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var req struct{ Method string `json:"method"` }
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil { t.Fatal(err) }
		w.Header().Set("Content-Type", "application/json")
		if req.Method == "eth_sendTransaction" {
			_, _ = w.Write([]byte(`{"jsonrpc":"2.0","id":1,"result":"`+txHash+`"}`))
			return
		}
		_, _ = w.Write([]byte(`{"jsonrpc":"2.0","id":1,"result":{"status":"0x0","transactionHash":"`+txHash+`"}}`))
	}))
	defer server.Close()
	s := RPCProofSubmitter{Backend:RPCBackend{URL:server.URL,Client:server.Client()},Registry:registry,From:from,PollInterval:time.Millisecond,ReceiptWait:time.Second}
	proof := Proof{CommitmentID:"0x"+strings.Repeat("11",32),ChallengeID:"0x"+strings.Repeat("22",32),Epoch:time.Unix(1700000000,0).UTC(),Payload:[]byte("proof")}
	if err := s.SubmitProof(context.Background(), proof); err != ErrProofSubmission { t.Fatalf("err=%v", err) }
}

func TestRPCProofSubmitterValidatesConfigurationAndProof(t *testing.T) {
	s := RPCProofSubmitter{Registry:"0x1234",From:"0x5678"}
	if err := s.SubmitProof(context.Background(), Proof{}); err != ErrProofSubmission { t.Fatalf("err=%v", err) }
}

func hexSelector(sig string) string {
	h := keccak256([]byte(sig))
	const digits = "0123456789abcdef"
	b := make([]byte, 8)
	for i := 0; i < 4; i++ { b[i*2] = digits[h[i]>>4]; b[i*2+1] = digits[h[i]&15] }
	return string(b)
}

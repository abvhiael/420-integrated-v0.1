package orchestration

import (
	"context"
	"encoding/hex"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/420integrated/420-integrated/media/node/ethadapter"
)

type orchestrationAnvilSigner struct {
	rpc  ethadapter.RPC
	from string
}

func (s orchestrationAnvilSigner) SendTransaction(ctx context.Context, to string, data []byte) (string, error) {
	return sendAnvilTransaction(ctx, s.rpc, s.from, to, data)
}

func sendAnvilTransaction(ctx context.Context, rpc ethadapter.RPC, from, to string, data []byte) (string, error) {
	var txHash string
	if err := rpc.Call(ctx, "eth_sendTransaction", []any{map[string]any{"from": from, "to": to, "data": "0x" + hex.EncodeToString(data)}}, &txHash); err != nil { return "", err }
	deadline := time.Now().Add(10 * time.Second)
	for time.Now().Before(deadline) {
		var receipt *struct{ Status string `json:"status"` }
		if err := rpc.Call(ctx, "eth_getTransactionReceipt", []any{txHash}, &receipt); err == nil && receipt != nil {
			if receipt.Status != "0x1" { return "", ErrInvalidLifecycle }
			return txHash, nil
		}
		time.Sleep(25 * time.Millisecond)
	}
	return "", context.DeadlineExceeded
}

func TestAnvilOrchestrationUnlocksTranscoderAfterIngressSuccess(t *testing.T) {
	if os.Getenv("MEDIA420_ANVIL") != "1" { t.Skip("set MEDIA420_ANVIL=1 to run live orchestration integration") }
	rpc, err := ethadapter.NewHTTPRPC(requireEnv(t, "MEDIA420_RPC_URL"), nil); if err != nil { t.Fatal(err) }
	marketAddr := requireEnv(t, "MEDIA420_MARKET")
	settlementAddr := requireEnv(t, "MEDIA420_SETTLEMENT")
	gov := requireEnv(t, "MEDIA420_GOV_ACCOUNT")
	operatorAccount := requireEnv(t, "MEDIA420_OPERATOR_ACCOUNT")
	operatorID := parseEnvBytes32(t, "MEDIA420_OPERATOR_ID")
	secondOperatorID := parseEnvBytes32(t, "MEDIA420_ORCH_SECOND_OPERATOR_ID")
	capabilityID := parseEnvBytes32(t, "MEDIA420_CAP_ID")
	market, err := NewEthereumLifecycleMarket(EthereumLifecycleConfig{
		RPC: rpc,
		Signer: orchestrationAnvilSigner{rpc: rpc, from: gov},
		MarketAddress: marketAddr,
		JobsSelector: parseEnvSelector(t, "MEDIA420_JOBS_SELECTOR"),
		ReservedOperatorSelector: parseEnvSelector(t, "MEDIA420_RESERVED_OPERATOR_SELECTOR"),
		CreateAssignedSelector: parseEnvSelector(t, "MEDIA420_CREATE_ASSIGNED_SELECTOR"),
	}); if err != nil { t.Fatal(err) }

	streamID := parseEnvBytes32(t, "MEDIA420_ORCH_STREAM_ID")
	plan := Plan{
		StreamID: streamID,
		Assignments: []Assignment{{Role: RoleIngress, OperatorID: operatorID}, {Role: RoleTranscoder, OperatorID: secondOperatorID}},
		Jobs: []JobNode{
			{ID: "ingress", Role: RoleIngress, OperatorID: operatorID},
			{ID: "transcode:000:720p", Role: RoleTranscoder, OperatorID: secondOperatorID, DependsOn: []string{"ingress"}, Rendition: "720p"},
		},
	}
	cfg := LifecycleConfig{
		Capabilities: CapabilitySet{Ingress: capabilityID, Transcoder: capabilityID},
		JobKinds: map[Role][32]byte{RoleIngress: parseEnvBytes32(t, "MEDIA420_ORCH_INGRESS_KIND"), RoleTranscoder: parseEnvBytes32(t, "MEDIA420_ORCH_TRANSCODE_KIND")},
		MaxSpend: map[Role]uint64{RoleIngress: 420000000, RoleTranscoder: 420000000},
		Deadline: time.Now().Add(10*time.Minute),
		RootInputRef: parseEnvBytes32(t, "MEDIA420_ORCH_INPUT_REF"),
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second); defer cancel()
	coord := NewLifecycleCoordinator(market)

	created, err := coord.CreateReady(ctx, plan, cfg); if err != nil { t.Fatal(err) }
	if len(created) != 1 { t.Fatalf("created=%d want only ingress", len(created)) }
	ingressID := CanonicalJobID(streamID, "ingress")
	if created[0] != ingressID { t.Fatalf("job id mismatch got=%x want=%x", created[0], ingressID) }

	acceptData := abiStatic(parseEnvSelector(t, "MEDIA420_ACCEPT_SELECTOR"), ingressID[:], operatorID[:])
	if _, err := sendAnvilTransaction(ctx, rpc, operatorAccount, marketAddr, acceptData); err != nil { t.Fatal(err) }

	fundData := abiStatic(
		parseEnvSelector(t, "MEDIA420_CONFIRM_VAULT_FUNDING_SELECTOR"),
		ingressID[:], addressWord(t, gov), operatorID[:], addressWord(t, operatorAccount),
		parseEnvBytes32(t, "MEDIA420_ORCH_VAULT_REF")[:], parseEnvBytes32(t, "MEDIA420_ORCH_FUNDING_REF")[:], uintWord32(420000000),
	)
	if _, err := sendAnvilTransaction(ctx, rpc, gov, settlementAddr, fundData); err != nil { t.Fatal(err) }
	if _, err := sendAnvilTransaction(ctx, rpc, operatorAccount, marketAddr, abiStatic(parseEnvSelector(t, "MEDIA420_MARK_RUNNING_SELECTOR"), ingressID[:])); err != nil { t.Fatal(err) }
	outputRef := parseEnvBytes32(t, "MEDIA420_ORCH_OUTPUT_REF")
	if _, err := sendAnvilTransaction(ctx, rpc, operatorAccount, marketAddr, abiStatic(parseEnvSelector(t, "MEDIA420_COMMIT_RESULT_SELECTOR"), ingressID[:], outputRef[:])); err != nil { t.Fatal(err) }
	resolutionRef := parseEnvBytes32(t, "MEDIA420_ORCH_RESOLUTION_REF")
	if _, err := sendAnvilTransaction(ctx, rpc, gov, marketAddr, abiStatic(parseEnvSelector(t, "MEDIA420_FINALIZE_SELECTOR"), ingressID[:], resolutionRef[:])); err != nil { t.Fatal(err) }

	ingressSnap, err := market.Snapshot(ctx, ingressID); if err != nil { t.Fatal(err) }
	if ingressSnap.Status != LifecycleVerified || ingressSnap.OutputRef != outputRef { t.Fatalf("ingress snapshot=%+v", ingressSnap) }

	created, err = coord.CreateReady(ctx, plan, cfg); if err != nil { t.Fatal(err) }
	if len(created) != 1 { t.Fatalf("created=%d want one transcoder", len(created)) }
	transcoderID := CanonicalJobID(streamID, "transcode:000:720p")
	if created[0] != transcoderID { t.Fatalf("transcoder id mismatch got=%x want=%x", created[0], transcoderID) }
	transcoderSnap, err := market.Snapshot(ctx, transcoderID); if err != nil { t.Fatal(err) }
	if transcoderSnap.Status != LifecycleCreated || transcoderSnap.OperatorID != secondOperatorID { t.Fatalf("transcoder snapshot=%+v", transcoderSnap) }

	jobInput, err := readJobInputRef(ctx, rpc, marketAddr, parseEnvSelector(t, "MEDIA420_JOBS_SELECTOR"), transcoderID); if err != nil { t.Fatal(err) }
	if jobInput != outputRef { t.Fatalf("transcoder input=%x want verified ingress output=%x", jobInput, outputRef) }
}

func abiStatic(selector [4]byte, words ...[]byte) []byte {
	out := make([]byte, 4, 4+32*len(words)); copy(out, selector[:])
	for _, word := range words { if len(word) != 32 { panic("orchestration test ABI word must be 32 bytes") }; out = append(out, word...) }
	return out
}

func addressWord(t *testing.T, address string) []byte {
	t.Helper(); raw, err := hex.DecodeString(strings.TrimPrefix(address, "0x")); if err != nil || len(raw) != 20 { t.Fatalf("invalid address %q", address) }
	out := make([]byte, 32); copy(out[12:], raw); return out
}

func uintWord32(v uint64) []byte {
	out := make([]byte, 32); for i := 31; i >= 24; i-- { out[i] = byte(v); v >>= 8 }; return out
}

func readJobInputRef(ctx context.Context, rpc ethadapter.RPC, market string, selector [4]byte, jobID [32]byte) ([32]byte, error) {
	var out [32]byte
	var encoded string
	if err := rpc.Call(ctx, "eth_call", []any{map[string]any{"to": market, "data": "0x"+hex.EncodeToString(abiStatic(selector, jobID[:]))}, "latest"}, &encoded); err != nil { return out, err }
	raw, err := hex.DecodeString(strings.TrimPrefix(encoded, "0x")); if err != nil || len(raw) != 13*32 { return out, ErrInvalidLifecycle }
	copy(out[:], raw[5*32:6*32]); return out, nil
}

func requireEnv(t *testing.T, key string) string { t.Helper(); v := os.Getenv(key); if v == "" { t.Fatalf("missing %s", key) }; return v }
func parseEnvBytes32(t *testing.T, key string) [32]byte { t.Helper(); var out [32]byte; raw, err := hex.DecodeString(strings.TrimPrefix(requireEnv(t,key), "0x")); if err != nil || len(raw) != 32 { t.Fatalf("invalid %s", key) }; copy(out[:], raw); return out }
func parseEnvSelector(t *testing.T, key string) [4]byte { t.Helper(); var out [4]byte; raw, err := hex.DecodeString(strings.TrimPrefix(requireEnv(t,key), "0x")); if err != nil || len(raw) != 4 { t.Fatalf("invalid %s", key) }; copy(out[:], raw); return out }

package orchestration

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"os"
	"sort"
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

func TestAnvilOrchestrationCompletesMultiRenditionRelay(t *testing.T) {
	if os.Getenv("MEDIA420_ANVIL") != "1" { t.Skip("set MEDIA420_ANVIL=1 to run live orchestration integration") }
	rpc, err := ethadapter.NewHTTPRPC(requireEnv(t, "MEDIA420_RPC_URL"), nil); if err != nil { t.Fatal(err) }
	marketAddr := requireEnv(t, "MEDIA420_MARKET")
	settlementAddr := requireEnv(t, "MEDIA420_SETTLEMENT")
	gov := requireEnv(t, "MEDIA420_GOV_ACCOUNT")
	accounts := map[Role][]string{
		RoleIngress: {requireEnv(t, "MEDIA420_OPERATOR_ACCOUNT")},
		RoleTranscoder: {requireEnv(t, "MEDIA420_SECOND_OPERATOR_ACCOUNT"), requireEnv(t, "MEDIA420_THIRD_OPERATOR_ACCOUNT")},
		RoleRelay: {requireEnv(t, "MEDIA420_FOURTH_OPERATOR_ACCOUNT")},
	}
	ingressOp := parseEnvBytes32(t, "MEDIA420_OPERATOR_ID")
	transcodeOp720 := parseEnvBytes32(t, "MEDIA420_ORCH_SECOND_OPERATOR_ID")
	transcodeOp1080 := parseEnvBytes32(t, "MEDIA420_ORCH_THIRD_OPERATOR_ID")
	relayOp := parseEnvBytes32(t, "MEDIA420_ORCH_FOURTH_OPERATOR_ID")
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
		Assignments: []Assignment{
			{Role: RoleIngress, OperatorID: ingressOp},
			{Role: RoleTranscoder, OperatorID: transcodeOp720},
			{Role: RoleTranscoder, OperatorID: transcodeOp1080},
			{Role: RoleRelay, OperatorID: relayOp},
		},
		Jobs: []JobNode{
			{ID: "ingress", Role: RoleIngress, OperatorID: ingressOp},
			{ID: "transcode:000:720p", Role: RoleTranscoder, OperatorID: transcodeOp720, DependsOn: []string{"ingress"}, Rendition: "720p"},
			{ID: "transcode:001:1080p", Role: RoleTranscoder, OperatorID: transcodeOp1080, DependsOn: []string{"ingress"}, Rendition: "1080p"},
			{ID: "relay:000", Role: RoleRelay, OperatorID: relayOp, DependsOn: []string{"transcode:000:720p", "transcode:001:1080p"}},
		},
	}
	cfg := LifecycleConfig{
		Capabilities: CapabilitySet{Ingress: capabilityID, Transcoder: capabilityID, Relay: capabilityID},
		JobKinds: map[Role][32]byte{
			RoleIngress: parseEnvBytes32(t, "MEDIA420_ORCH_INGRESS_KIND"),
			RoleTranscoder: parseEnvBytes32(t, "MEDIA420_ORCH_TRANSCODE_KIND"),
			RoleRelay: parseEnvBytes32(t, "MEDIA420_ORCH_RELAY_KIND"),
		},
		MaxSpend: map[Role]uint64{RoleIngress: 420000000, RoleTranscoder: 420000000, RoleRelay: 420000000},
		Deadline: time.Now().Add(10*time.Minute),
		RootInputRef: parseEnvBytes32(t, "MEDIA420_ORCH_INPUT_REF"),
	}
	ctx, cancel := context.WithTimeout(context.Background(), 45*time.Second); defer cancel()
	coord := NewLifecycleCoordinator(market)

	created, err := coord.CreateReady(ctx, plan, cfg); if err != nil { t.Fatal(err) }
	if len(created) != 1 { t.Fatalf("initial created=%d want ingress only", len(created)) }
	ingressID := CanonicalJobID(streamID, "ingress")
	if created[0] != ingressID { t.Fatalf("ingress id mismatch got=%x want=%x", created[0], ingressID) }
	ingressOutput := parseEnvBytes32(t, "MEDIA420_ORCH_OUTPUT_REF")
	advanceLiveJob(t, ctx, rpc, marketAddr, settlementAddr, gov, accounts[RoleIngress][0], ingressID, ingressOp, ingressOutput, "ingress")

	created, err = coord.CreateReady(ctx, plan, cfg); if err != nil { t.Fatal(err) }
	if len(created) != 2 { t.Fatalf("created=%d want two transcoders", len(created)) }
	transcode720ID := CanonicalJobID(streamID, "transcode:000:720p")
	transcode1080ID := CanonicalJobID(streamID, "transcode:001:1080p")
	if !containsJobID(created, transcode720ID) || !containsJobID(created, transcode1080ID) { t.Fatalf("unexpected transcoder ids: %x", created) }
	for _, id := range [][32]byte{transcode720ID, transcode1080ID} {
		input, err := readJobInputRef(ctx, rpc, marketAddr, parseEnvSelector(t, "MEDIA420_JOBS_SELECTOR"), id); if err != nil { t.Fatal(err) }
		if input != ingressOutput { t.Fatalf("transcoder input=%x want ingress output=%x", input, ingressOutput) }
	}

	out720 := parseEnvBytes32(t, "MEDIA420_ORCH_OUTPUT_REF_720")
	out1080 := parseEnvBytes32(t, "MEDIA420_ORCH_OUTPUT_REF_1080")
	advanceLiveJob(t, ctx, rpc, marketAddr, settlementAddr, gov, accounts[RoleTranscoder][0], transcode720ID, transcodeOp720, out720, "720p")

	created, err = coord.CreateReady(ctx, plan, cfg); if err != nil { t.Fatal(err) }
	if len(created) != 0 { t.Fatalf("relay created before all renditions completed: %x", created) }

	advanceLiveJob(t, ctx, rpc, marketAddr, settlementAddr, gov, accounts[RoleTranscoder][1], transcode1080ID, transcodeOp1080, out1080, "1080p")
	created, err = coord.CreateReady(ctx, plan, cfg); if err != nil { t.Fatal(err) }
	if len(created) != 1 { t.Fatalf("created=%d want relay", len(created)) }
	relayID := CanonicalJobID(streamID, "relay:000")
	if created[0] != relayID { t.Fatalf("relay id mismatch got=%x want=%x", created[0], relayID) }
	relaySnap, err := market.Snapshot(ctx, relayID); if err != nil { t.Fatal(err) }
	if relaySnap.Status != LifecycleCreated || relaySnap.OperatorID != relayOp { t.Fatalf("relay snapshot=%+v", relaySnap) }
	relayInput, err := readJobInputRef(ctx, rpc, marketAddr, parseEnvSelector(t, "MEDIA420_JOBS_SELECTOR"), relayID); if err != nil { t.Fatal(err) }
	wantManifest := expectedRelayManifest(map[string][32]byte{"transcode:000:720p": out720, "transcode:001:1080p": out1080})
	if relayInput != wantManifest { t.Fatalf("relay input=%x want manifest=%x", relayInput, wantManifest) }
}

func advanceLiveJob(t *testing.T, ctx context.Context, rpc ethadapter.RPC, marketAddr, settlementAddr, gov, operatorAccount string, jobID, operatorID, outputRef [32]byte, label string) {
	t.Helper()
	if _, err := sendAnvilTransaction(ctx, rpc, operatorAccount, marketAddr, abiStatic(parseEnvSelector(t, "MEDIA420_ACCEPT_SELECTOR"), jobID[:], operatorID[:])); err != nil { t.Fatal(err) }
	vaultRef := sha256.Sum256([]byte("420MEDIA_ORCH_VAULT:" + label))
	fundingRef := sha256.Sum256([]byte("420MEDIA_ORCH_FUNDING:" + label))
	fundData := abiStatic(parseEnvSelector(t, "MEDIA420_CONFIRM_VAULT_FUNDING_SELECTOR"), jobID[:], addressWord(t, gov), operatorID[:], addressWord(t, operatorAccount), vaultRef[:], fundingRef[:], uintWord32(420000000))
	if _, err := sendAnvilTransaction(ctx, rpc, gov, settlementAddr, fundData); err != nil { t.Fatal(err) }
	if _, err := sendAnvilTransaction(ctx, rpc, operatorAccount, marketAddr, abiStatic(parseEnvSelector(t, "MEDIA420_MARK_RUNNING_SELECTOR"), jobID[:])); err != nil { t.Fatal(err) }
	if _, err := sendAnvilTransaction(ctx, rpc, operatorAccount, marketAddr, abiStatic(parseEnvSelector(t, "MEDIA420_COMMIT_RESULT_SELECTOR"), jobID[:], outputRef[:])); err != nil { t.Fatal(err) }
	resolutionRef := sha256.Sum256([]byte("420MEDIA_ORCH_RESOLUTION:" + label))
	if _, err := sendAnvilTransaction(ctx, rpc, gov, marketAddr, abiStatic(parseEnvSelector(t, "MEDIA420_FINALIZE_SELECTOR"), jobID[:], resolutionRef[:])); err != nil { t.Fatal(err) }
}

func expectedRelayManifest(outputs map[string][32]byte) [32]byte {
	ids := make([]string, 0, len(outputs)); for id := range outputs { ids = append(ids, id) }; sort.Strings(ids)
	h := sha256.New(); h.Write([]byte("420MEDIA_INPUT_MANIFEST_V1"))
	for _, id := range ids { h.Write([]byte(id + ":")); out := outputs[id]; h.Write(out[:]) }
	var result [32]byte; copy(result[:], h.Sum(nil)); return result
}

func containsJobID(ids [][32]byte, want [32]byte) bool { for _, id := range ids { if id == want { return true } }; return false }

func abiStatic(selector [4]byte, words ...[]byte) []byte {
	out := make([]byte, 4, 4+32*len(words)); copy(out, selector[:])
	for _, word := range words { if len(word) != 32 { panic("orchestration test ABI word must be 32 bytes") }; out = append(out, word...) }
	return out
}

func addressWord(t *testing.T, address string) []byte {
	t.Helper(); raw, err := hex.DecodeString(strings.TrimPrefix(address, "0x")); if err != nil || len(raw) != 20 { t.Fatalf("invalid address %q", address) }
	out := make([]byte, 32); copy(out[12:], raw); return out
}

func uintWord32(v uint64) []byte { out := make([]byte, 32); for i := 31; i >= 24; i-- { out[i] = byte(v); v >>= 8 }; return out }

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

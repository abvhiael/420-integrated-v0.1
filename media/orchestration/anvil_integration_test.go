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
	var txHash string
	if err := s.rpc.Call(ctx, "eth_sendTransaction", []any{map[string]any{"from": s.from, "to": to, "data": "0x" + hex.EncodeToString(data)}}, &txHash); err != nil { return "", err }
	deadline := time.Now().Add(10 * time.Second)
	for time.Now().Before(deadline) {
		var receipt *struct{ Status string `json:"status"` }
		if err := s.rpc.Call(ctx, "eth_getTransactionReceipt", []any{txHash}, &receipt); err == nil && receipt != nil {
			if receipt.Status != "0x1" { return "", ErrInvalidLifecycle }
			return txHash, nil
		}
		time.Sleep(25 * time.Millisecond)
	}
	return "", context.DeadlineExceeded
}

func TestAnvilOrchestrationCreatesReservedRootJob(t *testing.T) {
	if os.Getenv("MEDIA420_ANVIL") != "1" { t.Skip("set MEDIA420_ANVIL=1 to run live orchestration integration") }
	rpc, err := ethadapter.NewHTTPRPC(requireEnv(t, "MEDIA420_RPC_URL"), nil); if err != nil { t.Fatal(err) }
	marketAddr := requireEnv(t, "MEDIA420_MARKET")
	operatorID := parseEnvBytes32(t, "MEDIA420_OPERATOR_ID")
	capabilityID := parseEnvBytes32(t, "MEDIA420_CAP_ID")
	market, err := NewEthereumLifecycleMarket(EthereumLifecycleConfig{
		RPC: rpc,
		Signer: orchestrationAnvilSigner{rpc: rpc, from: requireEnv(t, "MEDIA420_GOV_ACCOUNT")},
		MarketAddress: marketAddr,
		JobsSelector: parseEnvSelector(t, "MEDIA420_JOBS_SELECTOR"),
		ReservedOperatorSelector: parseEnvSelector(t, "MEDIA420_RESERVED_OPERATOR_SELECTOR"),
		CreateAssignedSelector: parseEnvSelector(t, "MEDIA420_CREATE_ASSIGNED_SELECTOR"),
	}); if err != nil { t.Fatal(err) }

	streamID := parseEnvBytes32(t, "MEDIA420_ORCH_STREAM_ID")
	plan := Plan{
		StreamID: streamID,
		Assignments: []Assignment{{Role: RoleIngress, OperatorID: operatorID}, {Role: RoleTranscoder, OperatorID: parseEnvBytes32(t, "MEDIA420_ORCH_SECOND_OPERATOR_ID")}},
		Jobs: []JobNode{
			{ID: "ingress", Role: RoleIngress, OperatorID: operatorID},
			{ID: "transcode:000:720p", Role: RoleTranscoder, OperatorID: parseEnvBytes32(t, "MEDIA420_ORCH_SECOND_OPERATOR_ID"), DependsOn: []string{"ingress"}, Rendition: "720p"},
		},
	}
	cfg := LifecycleConfig{
		Capabilities: CapabilitySet{Ingress: capabilityID, Transcoder: capabilityID},
		JobKinds: map[Role][32]byte{RoleIngress: parseEnvBytes32(t, "MEDIA420_ORCH_INGRESS_KIND"), RoleTranscoder: parseEnvBytes32(t, "MEDIA420_ORCH_TRANSCODE_KIND")},
		MaxSpend: map[Role]uint64{RoleIngress: 420000000, RoleTranscoder: 420000000},
		Deadline: time.Now().Add(10*time.Minute),
		RootInputRef: parseEnvBytes32(t, "MEDIA420_ORCH_INPUT_REF"),
	}
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second); defer cancel()
	created, err := NewLifecycleCoordinator(market).CreateReady(ctx, plan, cfg); if err != nil { t.Fatal(err) }
	if len(created) != 1 { t.Fatalf("created=%d want only ingress", len(created)) }
	wantID := CanonicalJobID(streamID, "ingress")
	if created[0] != wantID { t.Fatalf("job id mismatch got=%x want=%x", created[0], wantID) }
	snap, err := market.Snapshot(ctx, wantID); if err != nil { t.Fatal(err) }
	if snap.Status != LifecycleCreated || snap.OperatorID != operatorID { t.Fatalf("snapshot=%+v", snap) }
}

func requireEnv(t *testing.T, key string) string { t.Helper(); v := os.Getenv(key); if v == "" { t.Fatalf("missing %s", key) }; return v }
func parseEnvBytes32(t *testing.T, key string) [32]byte { t.Helper(); var out [32]byte; raw, err := hex.DecodeString(strings.TrimPrefix(requireEnv(t,key), "0x")); if err != nil || len(raw) != 32 { t.Fatalf("invalid %s", key) }; copy(out[:], raw); return out }
func parseEnvSelector(t *testing.T, key string) [4]byte { t.Helper(); var out [4]byte; raw, err := hex.DecodeString(strings.TrimPrefix(requireEnv(t,key), "0x")); if err != nil || len(raw) != 4 { t.Fatalf("invalid %s", key) }; copy(out[:], raw); return out }

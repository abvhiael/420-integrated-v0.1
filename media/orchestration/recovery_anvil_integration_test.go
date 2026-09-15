package orchestration

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/420integrated/420-integrated/media/discovery"
	"github.com/420integrated/420-integrated/media/node/ethadapter"
)

func TestAnvilRecoveryPreservesOriginalAndExecutesReplacement(t *testing.T) {
	if os.Getenv("MEDIA420_ANVIL") != "1" { t.Skip("set MEDIA420_ANVIL=1 to run live recovery integration") }
	rpc, err := ethadapter.NewHTTPRPC(requireEnv(t, "MEDIA420_RPC_URL"), nil); if err != nil { t.Fatal(err) }
	marketAddr := requireEnv(t, "MEDIA420_MARKET")
	settlementAddr := requireEnv(t, "MEDIA420_SETTLEMENT")
	gov := requireEnv(t, "MEDIA420_GOV_ACCOUNT")
	replacementAccount := requireEnv(t, "MEDIA420_SECOND_OPERATOR_ACCOUNT")
	failedOperator := parseEnvBytes32(t, "MEDIA420_OPERATOR_ID")
	replacementOperator := parseEnvBytes32(t, "MEDIA420_ORCH_SECOND_OPERATOR_ID")
	capabilityID := parseEnvBytes32(t, "MEDIA420_CAP_ID")
	market, err := NewEthereumLifecycleMarket(EthereumLifecycleConfig{
		RPC: rpc,
		Signer: orchestrationAnvilSigner{rpc: rpc, from: gov},
		MarketAddress: marketAddr,
		JobsSelector: parseEnvSelector(t, "MEDIA420_JOBS_SELECTOR"),
		ReservedOperatorSelector: parseEnvSelector(t, "MEDIA420_RESERVED_OPERATOR_SELECTOR"),
		CreateAssignedSelector: parseEnvSelector(t, "MEDIA420_CREATE_ASSIGNED_SELECTOR"),
	}); if err != nil { t.Fatal(err) }

	streamID := parseEnvBytes32(t, "MEDIA420_RECOVERY_STREAM_ID")
	plan := Plan{
		StreamID: streamID,
		Assignments: []Assignment{{Role: RoleIngress, OperatorID: failedOperator}},
		Jobs: []JobNode{{ID: "ingress", Role: RoleIngress, OperatorID: failedOperator}},
	}
	cfg := LifecycleConfig{
		Capabilities: CapabilitySet{Ingress: capabilityID},
		JobKinds: map[Role][32]byte{RoleIngress: parseEnvBytes32(t, "MEDIA420_ORCH_INGRESS_KIND")},
		MaxSpend: map[Role]uint64{RoleIngress: 420000000},
		Deadline: time.Now().Add(2*time.Minute),
		RootInputRef: parseEnvBytes32(t, "MEDIA420_RECOVERY_INPUT_REF"),
	}
	ctx, cancel := context.WithTimeout(context.Background(), 45*time.Second); defer cancel()
	coord := NewLifecycleCoordinator(market)
	created, err := coord.CreateReady(ctx, plan, cfg); if err != nil { t.Fatal(err) }
	if len(created) != 1 { t.Fatalf("created=%d want canonical ingress", len(created)) }
	canonicalID := CanonicalJobID(streamID, "ingress")
	if created[0] != canonicalID { t.Fatalf("canonical id=%x want=%x", created[0], canonicalID) }

	var ignored any
	if err := rpc.Call(ctx, "evm_increaseTime", []any{uint64(180)}, &ignored); err != nil { t.Fatal(err) }
	if err := rpc.Call(ctx, "evm_mine", []any{}, &ignored); err != nil { t.Fatal(err) }
	if _, err := sendAnvilTransaction(ctx, rpc, gov, marketAddr, abiStatic(parseEnvSelector(t, "MEDIA420_EXPIRE_SELECTOR"), canonicalID[:])); err != nil { t.Fatal(err) }
	failedSnap, err := market.Snapshot(ctx, canonicalID); if err != nil { t.Fatal(err) }
	if failedSnap.Status != LifecycleExpired || failedSnap.OperatorID != failedOperator { t.Fatalf("failed snapshot=%+v", failedSnap) }

	selector := fakeRecoverySelector{selections: []discovery.Selection{
		{Provider: discovery.Provider{OperatorID: failedOperator, Active: true}, Score: 100},
		{Provider: discovery.Provider{OperatorID: replacementOperator, Active: true}, Score: 90},
	}}
	planner := NewRecoveryPlanner(selector, RecoveryPolicy{MaxAttempts: 3})
	decision, err := planner.SelectReplacement(ctx, RecoveryRequest{
		Node: plan.Jobs[0],
		Selection: discovery.Request{CapabilityID: capabilityID},
		FailedOperatorID: failedOperator,
		Attempt: 0,
	}); if err != nil { t.Fatal(err) }
	if decision.Replacement.Provider.OperatorID != replacementOperator || decision.Attempt != 1 { t.Fatalf("decision=%+v", decision) }

	cfg.Deadline = time.Now().Add(10*time.Minute)
	recoveryID, err := coord.CreateRecoveryAttempt(ctx, plan, "ingress", decision, cfg); if err != nil { t.Fatal(err) }
	if recoveryID == canonicalID || recoveryID != RecoveryJobID(streamID, "ingress", 1) { t.Fatalf("recovery id=%x", recoveryID) }
	recoverySnap, err := market.Snapshot(ctx, recoveryID); if err != nil { t.Fatal(err) }
	if recoverySnap.Status != LifecycleCreated || recoverySnap.OperatorID != replacementOperator { t.Fatalf("recovery snapshot=%+v", recoverySnap) }

	recoveryOutput := parseEnvBytes32(t, "MEDIA420_RECOVERY_OUTPUT_REF")
	advanceLiveJob(t, ctx, rpc, marketAddr, settlementAddr, gov, replacementAccount, recoveryID, replacementOperator, recoveryOutput, "recovery")
	recoverySnap, err = market.Snapshot(ctx, recoveryID); if err != nil { t.Fatal(err) }
	if recoverySnap.Status != LifecycleVerified || recoverySnap.OutputRef != recoveryOutput { t.Fatalf("completed recovery=%+v", recoverySnap) }
	failedSnap, err = market.Snapshot(ctx, canonicalID); if err != nil { t.Fatal(err) }
	if failedSnap.Status != LifecycleExpired || failedSnap.OperatorID != failedOperator { t.Fatalf("original mutated=%+v", failedSnap) }
}

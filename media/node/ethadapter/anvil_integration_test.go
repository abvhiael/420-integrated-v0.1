package ethadapter

import (
	"context"
	"encoding/hex"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	medianode "github.com/420integrated/420-integrated/media/node"
)

type anvilSigner struct {
	rpc  RPC
	from string
}

func (s anvilSigner) SendTransaction(ctx context.Context, to string, data []byte) (string, error) {
	var txHash string
	if err := s.rpc.Call(ctx, "eth_sendTransaction", []any{map[string]any{
		"from": s.from,
		"to":   to,
		"data": "0x" + hex.EncodeToString(data),
	}}, &txHash); err != nil {
		return "", err
	}
	deadline := time.Now().Add(10 * time.Second)
	for time.Now().Before(deadline) {
		var receipt *struct {
			Status string `json:"status"`
		}
		err := s.rpc.Call(ctx, "eth_getTransactionReceipt", []any{txHash}, &receipt)
		if err == nil && receipt != nil {
			if receipt.Status != "0x1" {
				return "", ErrInvalidJob
			}
			return txHash, nil
		}
		time.Sleep(25 * time.Millisecond)
	}
	return "", context.DeadlineExceeded
}

func TestAnvilMediaJobAdapterLifecycle(t *testing.T) {
	if os.Getenv("MEDIA420_ANVIL") != "1" {
		t.Skip("set MEDIA420_ANVIL=1 to run the live Anvil integration test")
	}

	rpcURL := mustEnv(t, "MEDIA420_RPC_URL")
	market := mustEnv(t, "MEDIA420_MARKET")
	operatorAccount := mustEnv(t, "MEDIA420_OPERATOR_ACCOUNT")
	operatorID := mustBytes32(t, mustEnv(t, "MEDIA420_OPERATOR_ID"))
	createdJob := mustBytes32(t, mustEnv(t, "MEDIA420_CREATED_JOB"))
	fundedJob := mustBytes32(t, mustEnv(t, "MEDIA420_FUNDED_JOB"))
	outputRef := mustBytes32(t, mustEnv(t, "MEDIA420_OUTPUT_REF"))

	rpc, err := NewHTTPRPC(rpcURL, nil)
	if err != nil { t.Fatal(err) }
	cursor, err := NewFileCursor(filepath.Join(t.TempDir(), "cursor.json"))
	if err != nil { t.Fatal(err) }
	abi := ABIConfig{
		JobsSelector:         mustSelector(t, mustEnv(t, "MEDIA420_JOBS_SELECTOR")),
		AcceptSelector:       mustSelector(t, mustEnv(t, "MEDIA420_ACCEPT_SELECTOR")),
		MarkRunningSelector:  mustSelector(t, mustEnv(t, "MEDIA420_MARK_RUNNING_SELECTOR")),
		CommitResultSelector: mustSelector(t, mustEnv(t, "MEDIA420_COMMIT_RESULT_SELECTOR")),
		JobCreatedTopic:      mustEnv(t, "MEDIA420_JOB_CREATED_TOPIC"),
	}
	backend, err := NewRPCBackend(rpc, anvilSigner{rpc: rpc, from: operatorAccount}, cursor, market, operatorID, abi, 1)
	if err != nil { t.Fatal(err) }
	adapter, err := New(backend)
	if err != nil { t.Fatal(err) }
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()

	pending, err := adapter.PendingJobs(ctx)
	if err != nil { t.Fatal(err) }
	found := false
	for _, job := range pending {
		if job.ID == createdJob {
			found = true
			if job.Status != medianode.JobCreated { t.Fatalf("created job status = %s", job.Status) }
		}
	}
	if !found { t.Fatal("created job was not discovered from JobCreated logs") }

	if err := adapter.AcceptJob(ctx, createdJob); err != nil { t.Fatal(err) }
	accepted, err := adapter.RefreshJob(ctx, createdJob)
	if err != nil { t.Fatal(err) }
	if accepted.Status != medianode.JobAccepted || accepted.OperatorID != operatorID {
		t.Fatalf("accepted job mismatch: status=%s operator=%x", accepted.Status, accepted.OperatorID)
	}

	funded, err := adapter.RefreshJob(ctx, fundedJob)
	if err != nil { t.Fatal(err) }
	if funded.Status != medianode.JobFunded || funded.FundedAmount == 0 {
		t.Fatalf("funded fixture mismatch: status=%s amount=%d", funded.Status, funded.FundedAmount)
	}
	if err := adapter.MarkRunning(ctx, fundedJob); err != nil { t.Fatal(err) }
	running, err := adapter.RefreshJob(ctx, fundedJob)
	if err != nil { t.Fatal(err) }
	if running.Status != medianode.JobRunning { t.Fatalf("running status = %s", running.Status) }
	if err := adapter.CommitResult(ctx, fundedJob, outputRef); err != nil { t.Fatal(err) }
	committed, err := adapter.RefreshJob(ctx, fundedJob)
	if err != nil { t.Fatal(err) }
	if committed.Status != medianode.JobResultCommitted { t.Fatalf("committed status = %s", committed.Status) }
}

func mustEnv(t *testing.T, key string) string {
	t.Helper()
	v := os.Getenv(key)
	if v == "" { t.Fatalf("missing %s", key) }
	return v
}

func mustBytes32(t *testing.T, v string) [32]byte {
	t.Helper()
	var out [32]byte
	raw, err := hex.DecodeString(strings.TrimPrefix(v, "0x"))
	if err != nil || len(raw) != 32 { t.Fatalf("invalid bytes32 %q", v) }
	copy(out[:], raw)
	return out
}

func mustSelector(t *testing.T, v string) [4]byte {
	t.Helper()
	var out [4]byte
	raw, err := hex.DecodeString(strings.TrimPrefix(v, "0x"))
	if err != nil || len(raw) != 4 { t.Fatalf("invalid selector %q", v) }
	copy(out[:], raw)
	return out
}

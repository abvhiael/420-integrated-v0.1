package worker

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"os"
	"strings"
	"testing"
	"time"
)

func TestResultCommitmentDockerIntegration(t *testing.T) {
	image := strings.TrimSpace(os.Getenv("CMP_RESULT_INTEGRATION_IMAGE"))
	if image == "" {
		t.Skip("CMP_RESULT_INTEGRATION_IMAGE not set")
	}

	cfg := lifecycleConfig(t)
	artifact := writeLifecycleArtifact(t, cfg, []byte("cmp-3.8-result-work-unit"))
	command := []string{"/probe"}
	auth := executionFixture(t, cfg, artifact, image, command)
	authority := CanonicalExecutionAuthorityFunc(func(_ context.Context, ref string) (ExecutionAuthorization, error) {
		if ref != auth.AuthorizationRef {
			return ExecutionAuthorization{}, errors.New("unknown authorization")
		}
		return auth, nil
	})

	policy := DefaultSandboxPolicy("docker")
	policy.MaxOutputBytes = 64 << 10
	sandbox, err := NewSandbox(policy, OSCommandRunner{})
	if err != nil {
		t.Fatal(err)
	}
	lifecycle, err := NewExecutionLifecycle(cfg, authority, sandbox)
	if err != nil {
		t.Fatal(err)
	}
	results, err := NewResultStore(cfg, authority)
	if err != nil {
		t.Fatal(err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	outcome, err := lifecycle.Execute(ctx, ExecutionPlan{
		AuthorizationRef: auth.AuthorizationRef,
		Artifact: artifact,
		Sandbox: SandboxRequest{Image: image, Command: command},
	})
	if err != nil {
		t.Fatalf("real result execution failed: %v; outcome=%+v", err, outcome)
	}

	payload := make([]byte, 96<<10)
	for i := range payload {
		payload[i] = 'R'
	}
	sum := sha256.Sum256(payload)
	wantDigest := hex.EncodeToString(sum[:])
	if outcome.Sandbox.StdoutBytes != uint64(len(payload)) ||
		outcome.Sandbox.StdoutSHA256 != wantDigest {
		t.Fatalf("complete stdout commitment mismatch: bytes=%d hash=%q", outcome.Sandbox.StdoutBytes, outcome.Sandbox.StdoutSHA256)
	}
	if !outcome.Sandbox.OutputTruncated {
		t.Fatal("diagnostic capture unexpectedly retained entire >64KiB output")
	}
	if outcome.Sandbox.StdoutSHA256 == digestBytes([]byte(outcome.Sandbox.Output)) {
		t.Fatal("stdout commitment collapsed to truncated diagnostic capture")
	}

	material, err := results.Commit(context.Background(), outcome)
	if err != nil {
		t.Fatal(err)
	}
	if material.OutputSHA256 != wantDigest ||
		material.OutputHash != "0x"+wantDigest ||
		material.OutputBytes != uint64(len(payload)) {
		t.Fatalf("result material output mismatch: %+v", material)
	}
	if material.Signed || material.Authoritative || material.ResultCorrectnessEvidence || material.CanonicalResultCommitted {
		t.Fatal("result material crossed receipt/correctness/canonical authority boundary")
	}
}

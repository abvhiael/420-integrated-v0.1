package worker

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func resultFixture(t *testing.T, runner CommandRunner) (*ExecutionLifecycle, *ResultStore, ExecutionPlan, ExecutionAuthorization) {
	t.Helper()
	cfg := lifecycleConfig(t)
	artifact := writeLifecycleArtifact(t, cfg, []byte("result-work-unit"))
	image := "sha256:" + strings.Repeat("8", 64)
	command := []string{"/worker", "--result"}
	auth := executionFixture(t, cfg, artifact, image, command)
	authority := CanonicalExecutionAuthorityFunc(func(_ context.Context, ref string) (ExecutionAuthorization, error) {
		if ref != auth.AuthorizationRef {
			return ExecutionAuthorization{}, errors.New("unknown authorization")
		}
		return auth, nil
	})
	sandbox, err := NewSandbox(DefaultSandboxPolicy("docker"), runner)
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
	plan := ExecutionPlan{
		AuthorizationRef: auth.AuthorizationRef,
		Artifact: artifact,
		Sandbox: SandboxRequest{Image: image, Command: command},
	}
	return lifecycle, results, plan, auth
}

func TestResultCommitmentBindsDurableSuccessfulExecution(t *testing.T) {
	runner := &inputCapturingRunner{}
	lifecycle, results, plan, auth := resultFixture(t, runner)
	outcome, err := lifecycle.Execute(context.Background(), plan)
	if err != nil {
		t.Fatal(err)
	}
	material, err := results.Commit(context.Background(), outcome)
	if err != nil {
		t.Fatal(err)
	}
	if material.SchemaVersion != ResultMaterialSchemaV1 ||
		material.Domain != ResultMaterialDomainV1 ||
		material.AuthorizationRef != auth.AuthorizationRef ||
		material.AttemptRef != auth.AttemptRef ||
		material.AttemptNonce != auth.AttemptNonce {
		t.Fatalf("bad result material: %+v", material)
	}
	if material.OutputSHA256 != digestBytes([]byte("sandbox-output-not-persisted")) ||
		material.OutputBytes != uint64(len("sandbox-output-not-persisted")) {
		t.Fatalf("bad output commitment: %+v", material)
	}
	if material.Authoritative || material.Signed || material.ResultCorrectnessEvidence || material.CanonicalResultCommitted {
		t.Fatal("local unsigned result material escalated authority")
	}
	if len(material.ResultCommitment) != 66 || !strings.HasPrefix(material.ResultCommitment, "0x") {
		t.Fatalf("result commitment=%q", material.ResultCommitment)
	}
	if err := VerifyResultMaterial(auth, material); err != nil {
		t.Fatal(err)
	}

	loaded, err := results.Load(context.Background(), auth.AuthorizationRef)
	if err != nil {
		t.Fatal(err)
	}
	if loaded.ResultCommitment != material.ResultCommitment {
		t.Fatal("persisted result commitment drifted")
	}

	path := results.resultPath(auth.AttemptRef)
	info, err := os.Stat(path)
	if err != nil {
		t.Fatal(err)
	}
	if info.Mode().Perm() != 0o600 {
		t.Fatalf("result material mode=%o", info.Mode().Perm())
	}
	raw, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if bytes.Contains(raw, []byte("sandbox-output-not-persisted")) ||
		bytes.Contains(raw, []byte("result-work-unit")) {
		t.Fatal("raw customer input/output persisted in result material")
	}
}

func TestResultCommitmentIsIdempotentForSameAttempt(t *testing.T) {
	runner := &inputCapturingRunner{}
	lifecycle, results, plan, _ := resultFixture(t, runner)
	outcome, err := lifecycle.Execute(context.Background(), plan)
	if err != nil {
		t.Fatal(err)
	}
	first, err := results.Commit(context.Background(), outcome)
	if err != nil {
		t.Fatal(err)
	}
	second, err := results.Commit(context.Background(), outcome)
	if err != nil {
		t.Fatal(err)
	}
	if first.ResultCommitment != second.ResultCommitment {
		t.Fatal("idempotent result commitment changed")
	}
}

func TestResultCommitmentRejectsInMemoryOutputSubstitution(t *testing.T) {
	runner := &inputCapturingRunner{}
	lifecycle, results, plan, _ := resultFixture(t, runner)
	outcome, err := lifecycle.Execute(context.Background(), plan)
	if err != nil {
		t.Fatal(err)
	}
	outcome.Sandbox.StdoutSHA256 = digestBytes([]byte("forged"))
	outcome.Sandbox.StdoutBytes = 6
	if _, err := results.Commit(context.Background(), outcome); err == nil {
		t.Fatal("fabricated in-memory stdout commitment accepted")
	}
}

func TestResultCommitmentRejectsFailedOrNonzeroExecution(t *testing.T) {
	for _, tc := range []struct{
		name string
		runner CommandRunner
	}{
		{"runner-failure", &inputCapturingRunner{err: errors.New("failed")}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			lifecycle, results, plan, _ := resultFixture(t, tc.runner)
			outcome, runErr := lifecycle.Execute(context.Background(), plan)
			if runErr == nil {
				t.Fatal("expected execution failure")
			}
			if _, err := results.Commit(context.Background(), outcome); err == nil {
				t.Fatal("failed execution produced result commitment")
			}
		})
	}
}

func TestResultCommitmentBindsResumeCheckpoint(t *testing.T) {
	runner := &resumeCapturingRunner{}
	cfg := lifecycleConfig(t)
	work := []byte("resume-result-work")
	artifact := writeLifecycleArtifact(t, cfg, work)
	image := "sha256:" + strings.Repeat("8", 64)
	command := []string{"/worker", "--resume-aware"}
	auth := executionFixture(t, cfg, artifact, image, command)
	authority := CanonicalExecutionAuthorityFunc(func(context.Context, string) (ExecutionAuthorization, error) { return auth, nil })
	sandbox, err := NewSandbox(DefaultSandboxPolicy("docker"), runner)
	if err != nil {
		t.Fatal(err)
	}
	lifecycle, err := NewExecutionLifecycle(cfg, authority, sandbox)
	if err != nil {
		t.Fatal(err)
	}
	checkpoints, err := NewCheckpointStore(cfg, authority, 1<<20)
	if err != nil {
		t.Fatal(err)
	}
	results, err := NewResultStore(cfg, authority)
	if err != nil {
		t.Fatal(err)
	}
	seedInterruptedRecord(t, lifecycle, auth)
	checkpoint, err := checkpoints.Save(context.Background(), auth.AuthorizationRef, 1, bytes.NewReader([]byte("resume-state")))
	if err != nil {
		t.Fatal(err)
	}
	plan := ExecutionPlan{
		AuthorizationRef: auth.AuthorizationRef,
		Artifact: artifact,
		Sandbox: SandboxRequest{Image: image, Command: command},
	}
	outcome, err := lifecycle.Resume(context.Background(), plan, checkpoints)
	if err != nil {
		t.Fatal(err)
	}
	material, err := results.Commit(context.Background(), outcome)
	if err != nil {
		t.Fatal(err)
	}
	if material.ResumeCheckpointCommitment != checkpoint.Metadata.CheckpointCommitment {
		t.Fatalf("resume checkpoint binding=%q want=%q", material.ResumeCheckpointCommitment, checkpoint.Metadata.CheckpointCommitment)
	}
}

func TestResultMaterialTamperingFailsVerification(t *testing.T) {
	runner := &inputCapturingRunner{}
	lifecycle, results, plan, auth := resultFixture(t, runner)
	outcome, err := lifecycle.Execute(context.Background(), plan)
	if err != nil {
		t.Fatal(err)
	}
	material, err := results.Commit(context.Background(), outcome)
	if err != nil {
		t.Fatal(err)
	}
	material.OutputSHA256 = digestBytes([]byte("other-output"))
	if err := VerifyResultMaterial(auth, material); err == nil {
		t.Fatal("tampered output commitment verified")
	}
	material.OutputSHA256 = outcome.Sandbox.StdoutSHA256
	material.Signed = true
	if err := VerifyResultMaterial(auth, material); err == nil {
		t.Fatal("worker-local material self-escalated to signed")
	}
}

func TestResultStoreRejectsUnsafePersistedRecord(t *testing.T) {
	runner := &inputCapturingRunner{}
	lifecycle, results, plan, auth := resultFixture(t, runner)
	outcome, err := lifecycle.Execute(context.Background(), plan)
	if err != nil {
		t.Fatal(err)
	}
	material, err := results.Commit(context.Background(), outcome)
	if err != nil {
		t.Fatal(err)
	}
	path := results.resultPath(auth.AttemptRef)
	raw, err := json.MarshalIndent(material, "", "  ")
	if err != nil {
		t.Fatal(err)
	}
	outside := filepath.Join(t.TempDir(), "outside.json")
	if err := os.WriteFile(outside, raw, 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.Remove(path); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink(outside, path); err != nil {
		t.Skipf("symlinks unavailable: %v", err)
	}
	if _, err := results.Load(context.Background(), auth.AuthorizationRef); err == nil {
		t.Fatal("symlink result material trusted")
	}
}

func TestResultCommitmentAcceptsLegitimateEmptyStdout(t *testing.T) {
	runner := &fakeCommandRunner{}
	lifecycle, results, plan, _ := resultFixture(t, runner)
	outcome, err := lifecycle.Execute(context.Background(), plan)
	if err != nil {
		t.Fatal(err)
	}
	if outcome.Sandbox.StdoutBytes != 0 || outcome.Sandbox.StdoutSHA256 != digestBytes(nil) {
		t.Fatalf("empty stdout commitment invalid: %+v", outcome.Sandbox)
	}
	material, err := results.Commit(context.Background(), outcome)
	if err != nil {
		t.Fatal(err)
	}
	if material.OutputBytes != 0 || material.OutputSHA256 != digestBytes(nil) {
		t.Fatalf("empty result commitment invalid: %+v", material)
	}
}

func TestResultCommitmentConflictingDurableAttemptFailsClosed(t *testing.T) {
	runner := &inputCapturingRunner{}
	lifecycle, results, plan, auth := resultFixture(t, runner)
	outcome, err := lifecycle.Execute(context.Background(), plan)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := results.Commit(context.Background(), outcome); err != nil {
		t.Fatal(err)
	}

	recordPath := lifecycle.recordPath(auth.AttemptRef)
	record, err := lifecycle.readRecord(recordPath)
	if err != nil {
		t.Fatal(err)
	}
	record.StdoutSHA256 = digestBytes([]byte("different-output"))
	record.StdoutBytes = uint64(len("different-output"))
	if err := lifecycle.persistRecord(recordPath, record); err != nil {
		t.Fatal(err)
	}
	outcome.Record = record
	outcome.Sandbox.StdoutSHA256 = record.StdoutSHA256
	outcome.Sandbox.StdoutBytes = record.StdoutBytes
	if _, err := results.Commit(context.Background(), outcome); !errors.Is(err, ErrConflictingResult) {
		t.Fatalf("conflicting result not rejected: %v", err)
	}
}

func TestResultCommitmentRejectsMutatedCanonicalAuthorizationSnapshot(t *testing.T) {
	runner := &inputCapturingRunner{}
	cfg := lifecycleConfig(t)
	artifact := writeLifecycleArtifact(t, cfg, []byte("work"))
	image := "sha256:" + strings.Repeat("8", 64)
	command := []string{"/worker"}
	auth := executionFixture(t, cfg, artifact, image, command)
	current := auth
	authority := CanonicalExecutionAuthorityFunc(func(context.Context, string) (ExecutionAuthorization, error) { return current, nil })
	sandbox, _ := NewSandbox(DefaultSandboxPolicy("docker"), runner)
	lifecycle, err := NewExecutionLifecycle(cfg, authority, sandbox)
	if err != nil {
		t.Fatal(err)
	}
	results, err := NewResultStore(cfg, authority)
	if err != nil {
		t.Fatal(err)
	}
	plan := ExecutionPlan{AuthorizationRef: auth.AuthorizationRef, Artifact: artifact, Sandbox: SandboxRequest{Image:image, Command:command}}
	outcome, err := lifecycle.Execute(context.Background(), plan)
	if err != nil {
		t.Fatal(err)
	}
	current.LeaseExpiresAt = time.Now().Add(-time.Second)
	if _, err := results.Commit(context.Background(), outcome); err == nil {
		t.Fatal("invalid canonical authorization snapshot accepted after mutation")
	}
}

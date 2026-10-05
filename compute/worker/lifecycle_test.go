package worker

import (
	"context"
	"errors"
	"io"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func testBytes32(ch string) string {
	return "0x" + strings.Repeat(ch, 64)
}

func lifecycleConfig(t *testing.T) Config {
	t.Helper()
	cfg := DefaultConfig()
	cfg.StateDir = t.TempDir()
	cfg.Identity = Identity{
		ChainID: 420,
		ProviderID: testBytes32("1"),
		NodeID: testBytes32("2"),
		ResourceID: testBytes32("3"),
		WorkerID: testBytes32("4"),
	}
	return cfg
}

func writeLifecycleArtifact(t *testing.T, cfg Config, payload []byte) WorkUnitArtifact {
	t.Helper()
	root, err := cfg.PrepareStateDir()
	if err != nil { t.Fatal(err) }
	digest := digestBytes(payload)
	dir := filepath.Join(root, "work-units", "sha256")
	if err := os.MkdirAll(dir, 0o700); err != nil { t.Fatal(err) }
	path := filepath.Join(dir, digest+".bin")
	if err := os.WriteFile(path, payload, 0o600); err != nil { t.Fatal(err) }
	return WorkUnitArtifact{SchemaVersion: WorkUnitDownloadSchemaV1, SHA256: digest, SizeBytes: uint64(len(payload)), Path: path}
}

func executionFixture(t *testing.T, cfg Config, artifact WorkUnitArtifact, image string, command []string) ExecutionAuthorization {
	t.Helper()
	commandHash, err := CommandSHA256(command)
	if err != nil { t.Fatal(err) }
	now := time.Now().UTC()
	return ExecutionAuthorization{
		SchemaVersion: ExecutionAuthorizationSchemaV1,
		AuthorizationRef: testBytes32("a"),
		ChainID: cfg.Identity.ChainID,
		JobID: testBytes32("b"),
		UnitID: testBytes32("c"),
		RootAssignmentRef: testBytes32("d"),
		AttemptRef: testBytes32("e"),
		AttemptNonce: 1,
		ProviderID: cfg.Identity.ProviderID,
		NodeID: cfg.Identity.NodeID,
		ResourceID: cfg.Identity.ResourceID,
		WorkerID: cfg.Identity.WorkerID,
		ManifestHash: testBytes32("5"),
		ConstraintCommitment: testBytes32("6"),
		InputAccessRef: testBytes32("7"),
		WorkUnitSHA256: artifact.SHA256,
		WorkUnitSize: artifact.SizeBytes,
		SandboxImage: image,
		CommandSHA256: commandHash,
		Deadline: now.Add(time.Hour),
		LeaseExpiresAt: now.Add(30 * time.Minute),
	}
}

type inputCapturingRunner struct {
	input string
	err error
	block bool
}

func (r *inputCapturingRunner) Run(ctx context.Context, _ string, _ []string, stdin io.Reader, stdout, _ io.Writer) error {
	if stdin != nil {
		data, err := io.ReadAll(stdin)
		if err != nil { return err }
		r.input = string(data)
	}
	if r.block && stdin != nil {
		<-ctx.Done()
		return ctx.Err()
	}
	if stdout != nil {
		_, _ = io.WriteString(stdout, "sandbox-output-not-persisted")
	}
	return r.err
}

func newLifecycleFixture(t *testing.T, runner CommandRunner) (*ExecutionLifecycle, ExecutionPlan, ExecutionAuthorization) {
	t.Helper()
	cfg := lifecycleConfig(t)
	payload := []byte("verified-work-unit-input")
	artifact := writeLifecycleArtifact(t, cfg, payload)
	image := "sha256:" + strings.Repeat("8", 64)
	command := []string{"/worker", "--stdin"}
	auth := executionFixture(t, cfg, artifact, image, command)
	authority := CanonicalExecutionAuthorityFunc(func(_ context.Context, ref string) (ExecutionAuthorization, error) {
		if ref != auth.AuthorizationRef { return ExecutionAuthorization{}, errors.New("unknown authorization") }
		return auth, nil
	})
	sandbox, err := NewSandbox(DefaultSandboxPolicy("docker"), runner)
	if err != nil { t.Fatal(err) }
	lifecycle, err := NewExecutionLifecycle(cfg, authority, sandbox)
	if err != nil { t.Fatal(err) }
	return lifecycle, ExecutionPlan{
		AuthorizationRef: auth.AuthorizationRef,
		Artifact: artifact,
		Sandbox: SandboxRequest{Image: image, Command: command},
	}, auth
}

func TestExecutionLifecycleRunsVerifiedArtifactThroughSandbox(t *testing.T) {
	runner := &inputCapturingRunner{}
	lifecycle, plan, _ := newLifecycleFixture(t, runner)
	outcome, err := lifecycle.Execute(context.Background(), plan)
	if err != nil { t.Fatal(err) }
	if outcome.Record.Status != ExecutionExited || outcome.Record.ExitCode != 0 {
		t.Fatalf("unexpected outcome: %+v", outcome)
	}
	if runner.input != "verified-work-unit-input" {
		t.Fatalf("sandbox stdin=%q", runner.input)
	}
	if outcome.Record.ExecutionCommitment == "" {
		t.Fatal("execution commitment missing")
	}
	recordBytes, err := os.ReadFile(lifecycle.recordPath(outcome.Record.AttemptRef))
	if err != nil { t.Fatal(err) }
	if strings.Contains(string(recordBytes), "sandbox-output-not-persisted") || strings.Contains(string(recordBytes), "verified-work-unit-input") {
		t.Fatal("attempt record persisted customer input/output")
	}
}

func TestExecutionLifecycleRequiresCanonicalAuthorityAndExactBindings(t *testing.T) {
	lifecycle, plan, auth := newLifecycleFixture(t, &inputCapturingRunner{})
	bad := []struct{
		name string
		edit func(*ExecutionPlan)
	}{
		{"image", func(p *ExecutionPlan){ p.Sandbox.Image = "sha256:" + strings.Repeat("9", 64) }},
		{"command", func(p *ExecutionPlan){ p.Sandbox.Command = []string{"/different"} }},
		{"artifact-digest", func(p *ExecutionPlan){ p.Artifact.SHA256 = digestBytes([]byte("other")) }},
		{"authorization-ref", func(p *ExecutionPlan){ p.AuthorizationRef = testBytes32("f") }},
	}
	for _, tc := range bad {
		t.Run(tc.name, func(t *testing.T) {
			candidate := plan
			tc.edit(&candidate)
			if _, err := lifecycle.Execute(context.Background(), candidate); err == nil {
				t.Fatal("mismatched execution plan accepted")
			}
		})
	}

	cfg := lifecycle.config
	wrongAuth := auth
	wrongAuth.WorkerID = testBytes32("9")
	authority := CanonicalExecutionAuthorityFunc(func(context.Context, string) (ExecutionAuthorization, error) { return wrongAuth, nil })
	sandbox, _ := NewSandbox(DefaultSandboxPolicy("docker"), &inputCapturingRunner{})
	other, err := NewExecutionLifecycle(cfg, authority, sandbox)
	if err != nil { t.Fatal(err) }
	if _, err := other.Execute(context.Background(), plan); err == nil {
		t.Fatal("wrong canonical worker identity accepted")
	}
}

func TestExecutionLifecycleRevalidatesArtifactImmediatelyBeforeRun(t *testing.T) {
	runner := &inputCapturingRunner{}
	lifecycle, plan, _ := newLifecycleFixture(t, runner)
	if err := os.WriteFile(plan.Artifact.Path, []byte("tampered-after-download"), 0o600); err != nil {
		t.Fatal(err)
	}
	if _, err := lifecycle.Execute(context.Background(), plan); err == nil {
		t.Fatal("tampered work unit executed")
	}
	if runner.input != "" {
		t.Fatal("sandbox ran despite artifact tampering")
	}
}

func TestExecutionLifecycleRejectsExpiredOrInvalidLease(t *testing.T) {
	cfg := lifecycleConfig(t)
	artifact := writeLifecycleArtifact(t, cfg, []byte("payload"))
	image := "sha256:" + strings.Repeat("8", 64)
	command := []string{"/worker"}
	auth := executionFixture(t, cfg, artifact, image, command)
	auth.LeaseExpiresAt = time.Now().Add(-time.Second)
	authority := CanonicalExecutionAuthorityFunc(func(context.Context, string) (ExecutionAuthorization, error) { return auth, nil })
	runner := &inputCapturingRunner{}
	sandbox, _ := NewSandbox(DefaultSandboxPolicy("docker"), runner)
	lifecycle, err := NewExecutionLifecycle(cfg, authority, sandbox)
	if err != nil { t.Fatal(err) }
	plan := ExecutionPlan{AuthorizationRef: auth.AuthorizationRef, Artifact: artifact, Sandbox: SandboxRequest{Image:image, Command:command}}
	outcome, err := lifecycle.Execute(context.Background(), plan)
	if err == nil || outcome.Record.Status != ExecutionExpired {
		t.Fatalf("expired authorization accepted: outcome=%+v err=%v", outcome, err)
	}
	if runner.input != "" {
		t.Fatal("expired authorization reached sandbox")
	}
}

func TestExecutionLifecycleDoesNotReplayFinalizedAttempt(t *testing.T) {
	runner := &inputCapturingRunner{}
	lifecycle, plan, _ := newLifecycleFixture(t, runner)
	if _, err := lifecycle.Execute(context.Background(), plan); err != nil { t.Fatal(err) }
	runner.input = ""
	outcome, err := lifecycle.Execute(context.Background(), plan)
	if !errors.Is(err, ErrAttemptReplay) || outcome.Record.Status != ExecutionExited {
		t.Fatalf("expected replay rejection, outcome=%+v err=%v", outcome, err)
	}
	if runner.input != "" {
		t.Fatal("replayed attempt executed twice")
	}
}

func TestExecutionLifecycleCancellationPersistsTerminalLocalState(t *testing.T) {
	runner := &inputCapturingRunner{block:true}
	lifecycle, plan, _ := newLifecycleFixture(t, runner)
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	outcome, err := lifecycle.Execute(ctx, plan)
	if err == nil || outcome.Record.Status != ExecutionCancelled {
		t.Fatalf("expected cancelled state: outcome=%+v err=%v", outcome, err)
	}
}

func TestExecutionLifecycleRestartMarksRunningAttemptInterrupted(t *testing.T) {
	runner := &inputCapturingRunner{}
	lifecycle, plan, auth := newLifecycleFixture(t, runner)
	now := time.Now().UTC()
	record := lifecycle.newRecord(auth, ExecutionRunning, now, "")
	record.StartedAt = now
	path := lifecycle.recordPath(auth.AttemptRef)
	if err := lifecycle.persistRecord(path, record); err != nil { t.Fatal(err) }

	authority := lifecycle.authority
	sandbox := lifecycle.sandbox
	recovered, err := NewExecutionLifecycle(lifecycle.config, authority, sandbox)
	if err != nil { t.Fatal(err) }
	got, err := recovered.readRecord(path)
	if err != nil { t.Fatal(err) }
	if got.Status != ExecutionInterrupted {
		t.Fatalf("status=%s", got.Status)
	}
	if _, err := recovered.Execute(context.Background(), plan); !errors.Is(err, ErrAttemptReplay) {
		t.Fatalf("interrupted attempt implicitly reran: %v", err)
	}
}

func TestExecutionLifecycleFailureIsLocalEvidenceNotCorrectness(t *testing.T) {
	runner := &inputCapturingRunner{err: errors.New("sandbox failed")}
	lifecycle, plan, _ := newLifecycleFixture(t, runner)
	outcome, err := lifecycle.Execute(context.Background(), plan)
	if err == nil || outcome.Record.Status != ExecutionFailed {
		t.Fatalf("failure not persisted: outcome=%+v err=%v", outcome, err)
	}
	if outcome.Record.Status == ExecutionExited {
		t.Fatal("failed sandbox marked exited")
	}
	for _, transition := range outcome.Record.Transitions {
		if strings.Contains(strings.ToLower(transition.Code), "verified") || strings.Contains(strings.ToLower(transition.Code), "settled") {
			t.Fatal("local lifecycle claimed correctness/settlement authority")
		}
	}
}

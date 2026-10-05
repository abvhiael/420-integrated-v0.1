package worker

import (
	"bytes"
	"context"
	"errors"
	"io"
	"os"
	"strings"
	"testing"
	"time"
)

type resumeCapturingRunner struct {
	work       []byte
	checkpoint []byte
	calls      int
	err        error
	block      bool
}

func (r *resumeCapturingRunner) Run(ctx context.Context, _ string, _ []string, stdin io.Reader, stdout, _ io.Writer) error {
	r.calls++
	if stdin != nil {
		work, checkpoint, err := ParseResumeInput(stdin, 1<<20, 1<<20)
		if err != nil {
			return err
		}
		r.work = work
		r.checkpoint = checkpoint
	}
	if r.block && stdin != nil {
		<-ctx.Done()
		return ctx.Err()
	}
	if stdout != nil {
		_, _ = io.WriteString(stdout, "resume-ok")
	}
	return r.err
}

func newResumeFixture(t *testing.T, runner CommandRunner) (*ExecutionLifecycle, *CheckpointStore, ExecutionPlan, ExecutionAuthorization) {
	t.Helper()
	cfg := lifecycleConfig(t)
	work := []byte("resume-work-unit")
	artifact := writeLifecycleArtifact(t, cfg, work)
	image := "sha256:" + strings.Repeat("8", 64)
	command := []string{"/worker", "--resume-aware"}
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
	checkpoints, err := NewCheckpointStore(cfg, authority, 1<<20)
	if err != nil {
		t.Fatal(err)
	}
	plan := ExecutionPlan{
		AuthorizationRef: auth.AuthorizationRef,
		Artifact: artifact,
		Sandbox: SandboxRequest{Image: image, Command: command},
	}
	return lifecycle, checkpoints, plan, auth
}

func seedInterruptedRecord(t *testing.T, lifecycle *ExecutionLifecycle, auth ExecutionAuthorization) {
	t.Helper()
	now := time.Now().UTC()
	record := lifecycle.newRecord(auth, ExecutionInterrupted, now, "worker-restart")
	record.StartedAt = now.Add(-time.Minute)
	record.EndedAt = now
	if err := lifecycle.persistRecord(lifecycle.recordPath(auth.AttemptRef), record); err != nil {
		t.Fatal(err)
	}
}

func TestExecutionResumeUsesExactVerifiedCheckpointAndWorkUnit(t *testing.T) {
	runner := &resumeCapturingRunner{}
	lifecycle, checkpoints, plan, auth := newResumeFixture(t, runner)
	seedInterruptedRecord(t, lifecycle, auth)

	state := []byte("checkpoint-state-1")
	checkpoint, err := checkpoints.Save(context.Background(), auth.AuthorizationRef, 1, bytes.NewReader(state))
	if err != nil {
		t.Fatal(err)
	}
	outcome, err := lifecycle.Resume(context.Background(), plan, checkpoints)
	if err != nil {
		t.Fatal(err)
	}
	if outcome.Record.Status != ExecutionExited || outcome.Record.ExitCode != 0 {
		t.Fatalf("unexpected outcome: %+v", outcome)
	}
	if !bytes.Equal(runner.work, []byte("resume-work-unit")) || !bytes.Equal(runner.checkpoint, state) {
		t.Fatalf("resume input changed: work=%q checkpoint=%q", runner.work, runner.checkpoint)
	}
	if runner.calls != 1 {
		t.Fatalf("sandbox calls=%d", runner.calls)
	}
	found := false
	for _, transition := range outcome.Record.Transitions {
		if transition.Status == ExecutionResuming && strings.Contains(transition.Code, "checkpoint-"+string(rune('0'+checkpoint.Metadata.Sequence))) {
			found = true
		}
	}
	if !found {
		t.Fatal("resume transition/checkpoint sequence missing")
	}
}

func TestExecutionResumeRejectsTerminalOrLiveLocalStates(t *testing.T) {
	for _, status := range []ExecutionStatus{ExecutionExited, ExecutionFailed, ExecutionCancelled, ExecutionExpired} {
		t.Run(string(status), func(t *testing.T) {
			runner := &resumeCapturingRunner{}
			lifecycle, checkpoints, plan, auth := newResumeFixture(t, runner)
			record := lifecycle.newRecord(auth, status, time.Now().UTC(), "terminal")
			if err := lifecycle.persistRecord(lifecycle.recordPath(auth.AttemptRef), record); err != nil {
				t.Fatal(err)
			}
			if _, err := checkpoints.Save(context.Background(), auth.AuthorizationRef, 1, bytes.NewReader([]byte("state"))); err != nil {
				t.Fatal(err)
			}
			if _, err := lifecycle.Resume(context.Background(), plan, checkpoints); !errors.Is(err, ErrAttemptReplay) {
				t.Fatalf("terminal state reopened: %v", err)
			}
			if runner.calls != 0 {
				t.Fatal("terminal state reached sandbox")
			}
		})
	}

	for _, status := range []ExecutionStatus{ExecutionPrepared, ExecutionResuming, ExecutionRunning} {
		t.Run(string(status), func(t *testing.T) {
			runner := &resumeCapturingRunner{}
			lifecycle, checkpoints, plan, auth := newResumeFixture(t, runner)
			record := lifecycle.newRecord(auth, status, time.Now().UTC(), "active")
			if err := lifecycle.persistRecord(lifecycle.recordPath(auth.AttemptRef), record); err != nil {
				t.Fatal(err)
			}
			if _, err := lifecycle.Resume(context.Background(), plan, checkpoints); !errors.Is(err, ErrAttemptInProgress) {
				t.Fatalf("live state resume not rejected: %v", err)
			}
		})
	}
}

func TestExecutionResumeRejectsTamperedCheckpointBeforeSandbox(t *testing.T) {
	runner := &resumeCapturingRunner{}
	lifecycle, checkpoints, plan, auth := newResumeFixture(t, runner)
	seedInterruptedRecord(t, lifecycle, auth)
	checkpoint, err := checkpoints.Save(context.Background(), auth.AuthorizationRef, 1, bytes.NewReader([]byte("valid-state")))
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(checkpoint.Path, []byte("tampered-state"), 0o600); err != nil {
		t.Fatal(err)
	}
	if _, err := lifecycle.Resume(context.Background(), plan, checkpoints); err == nil {
		t.Fatal("tampered checkpoint resumed")
	}
	if runner.calls != 0 {
		t.Fatal("tampered checkpoint reached sandbox")
	}
}

func TestExecutionResumeRejectsTamperedWorkUnitBeforeSandbox(t *testing.T) {
	runner := &resumeCapturingRunner{}
	lifecycle, checkpoints, plan, auth := newResumeFixture(t, runner)
	seedInterruptedRecord(t, lifecycle, auth)
	if _, err := checkpoints.Save(context.Background(), auth.AuthorizationRef, 1, bytes.NewReader([]byte("state"))); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(plan.Artifact.Path, []byte("tampered-work"), 0o600); err != nil {
		t.Fatal(err)
	}
	if _, err := lifecycle.Resume(context.Background(), plan, checkpoints); err == nil {
		t.Fatal("tampered work unit resumed")
	}
	if runner.calls != 0 {
		t.Fatal("tampered work unit reached sandbox")
	}
}

func TestExecutionResumeRequiresLiveSameCanonicalAuthorization(t *testing.T) {
	cfg := lifecycleConfig(t)
	artifact := writeLifecycleArtifact(t, cfg, []byte("work"))
	image := "sha256:" + strings.Repeat("8", 64)
	command := []string{"/worker"}
	auth := executionFixture(t, cfg, artifact, image, command)
	current := auth
	authority := CanonicalExecutionAuthorityFunc(func(context.Context, string) (ExecutionAuthorization, error) { return current, nil })
	runner := &resumeCapturingRunner{}
	sandbox, _ := NewSandbox(DefaultSandboxPolicy("docker"), runner)
	lifecycle, err := NewExecutionLifecycle(cfg, authority, sandbox)
	if err != nil {
		t.Fatal(err)
	}
	checkpoints, err := NewCheckpointStore(cfg, authority, 1<<20)
	if err != nil {
		t.Fatal(err)
	}
	seedInterruptedRecord(t, lifecycle, auth)
	if _, err := checkpoints.Save(context.Background(), auth.AuthorizationRef, 1, bytes.NewReader([]byte("state"))); err != nil {
		t.Fatal(err)
	}
	plan := ExecutionPlan{AuthorizationRef: auth.AuthorizationRef, Artifact: artifact, Sandbox: SandboxRequest{Image:image, Command:command}}

	current = auth
	current.AttemptNonce = 2
	if _, err := lifecycle.Resume(context.Background(), plan, checkpoints); err == nil {
		t.Fatal("changed canonical attempt nonce resumed old checkpoint")
	}
	if runner.calls != 0 {
		t.Fatal("stale canonical authorization reached sandbox")
	}
}

func TestExecutionResumeCancellationPersistsCancellation(t *testing.T) {
	runner := &resumeCapturingRunner{block:true}
	lifecycle, checkpoints, plan, auth := newResumeFixture(t, runner)
	seedInterruptedRecord(t, lifecycle, auth)
	if _, err := checkpoints.Save(context.Background(), auth.AuthorizationRef, 1, bytes.NewReader([]byte("state"))); err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	outcome, err := lifecycle.Resume(ctx, plan, checkpoints)
	if err == nil || outcome.Record.Status != ExecutionCancelled {
		t.Fatalf("resume cancellation not persisted: outcome=%+v err=%v", outcome, err)
	}
}

func TestRestartDuringResumingReturnsToInterrupted(t *testing.T) {
	runner := &resumeCapturingRunner{}
	lifecycle, _, _, auth := newResumeFixture(t, runner)
	record := lifecycle.newRecord(auth, ExecutionResuming, time.Now().UTC(), "checkpoint-1")
	if err := lifecycle.persistRecord(lifecycle.recordPath(auth.AttemptRef), record); err != nil {
		t.Fatal(err)
	}
	recovered, err := NewExecutionLifecycle(lifecycle.config, lifecycle.authority, lifecycle.sandbox)
	if err != nil {
		t.Fatal(err)
	}
	got, err := recovered.readRecord(recovered.recordPath(auth.AttemptRef))
	if err != nil {
		t.Fatal(err)
	}
	if got.Status != ExecutionInterrupted {
		t.Fatalf("resuming crash recovered as %q", got.Status)
	}
}

package worker

import (
	"bytes"
	"context"
	"errors"
	"net/http"
	"os"
	"strings"
	"testing"
	"time"
)

func TestCheckpointResumeDockerIntegration(t *testing.T) {
	image := strings.TrimSpace(os.Getenv("CMP_CHECKPOINT_INTEGRATION_IMAGE"))
	if image == "" {
		t.Skip("CMP_CHECKPOINT_INTEGRATION_IMAGE not set")
	}

	cfg := lifecycleConfig(t)
	work := []byte("cmp-3.7-real-resume-work-unit")
	workDigest := digestBytes(work)
	state := []byte("cmp-3.7-checkpoint-state")
	stateDigest := digestBytes(state)

	server, client := tlsDownloadFixture(t, http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/octet-stream")
		_, _ = w.Write(work)
	}))
	downloader, err := NewWorkUnitDownloader(cfg.StateDir, client, nil, 1<<20)
	if err != nil {
		t.Fatal(err)
	}
	artifact, err := downloader.Fetch(context.Background(), WorkUnitSource{
		URL: server.URL + "/work",
		SHA256: workDigest,
		SizeBytes: uint64(len(work)),
		MediaType: "application/octet-stream",
		Purpose: "compute-work-unit",
	})
	if err != nil {
		t.Fatal(err)
	}

	command := []string{"/probe"}
	auth := executionFixture(t, cfg, artifact, image, command)
	authority := CanonicalExecutionAuthorityFunc(func(_ context.Context, ref string) (ExecutionAuthorization, error) {
		if ref != auth.AuthorizationRef {
			return ExecutionAuthorization{}, errors.New("unknown authorization")
		}
		return auth, nil
	})
	sandbox, err := NewSandbox(DefaultSandboxPolicy("docker"), OSCommandRunner{})
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
	seedInterruptedRecord(t, lifecycle, auth)
	if _, err := checkpoints.Save(context.Background(), auth.AuthorizationRef, 1, bytes.NewReader(state)); err != nil {
		t.Fatal(err)
	}

	plan := ExecutionPlan{
		AuthorizationRef: auth.AuthorizationRef,
		Artifact: artifact,
		Sandbox: SandboxRequest{Image: image, Command: command},
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	outcome, err := lifecycle.Resume(ctx, plan, checkpoints)
	if err != nil {
		t.Fatalf("real checkpoint resume failed: %v; outcome=%+v", err, outcome)
	}
	if outcome.Record.Status != ExecutionExited || outcome.Record.ExitCode != 0 {
		t.Fatalf("unexpected resume result: %+v", outcome)
	}
	want := "cmp-checkpoint-resume-ok " + workDigest + " " + stateDigest
	if !strings.Contains(outcome.Sandbox.Output, want) {
		t.Fatalf("resume probe mismatch: %q want %q", outcome.Sandbox.Output, want)
	}

	replayed, err := lifecycle.Resume(context.Background(), plan, checkpoints)
	if !errors.Is(err, ErrAttemptReplay) || replayed.Record.Status != ExecutionExited {
		t.Fatalf("resumed attempt replay accepted: record=%+v err=%v", replayed.Record, err)
	}
}

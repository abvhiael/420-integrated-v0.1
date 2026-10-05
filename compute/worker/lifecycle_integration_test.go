package worker

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"testing"
	"time"
)

func TestExecutionLifecycleDockerIntegration(t *testing.T) {
	image := strings.TrimSpace(getenv("CMP_LIFECYCLE_INTEGRATION_IMAGE"))
	if image == "" {
		t.Skip("CMP_LIFECYCLE_INTEGRATION_IMAGE not set")
	}

	cfg := lifecycleConfig(t)
	payload := []byte("cmp-3.6-real-pipeline-work-unit")
	digest := digestBytes(payload)

	server, client := tlsDownloadFixture(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("X-420-Artifact-SHA256") != digest {
			t.Errorf("unexpected digest header %q", r.Header.Get("X-420-Artifact-SHA256"))
		}
		w.Header().Set("Content-Type", "application/octet-stream")
		_, _ = w.Write(payload)
	}))

	downloader, err := NewWorkUnitDownloader(cfg.StateDir, client, nil, 1<<20)
	if err != nil {
		t.Fatal(err)
	}
	artifact, err := downloader.Fetch(context.Background(), WorkUnitSource{
		URL:       server.URL + "/work-unit",
		SHA256:    digest,
		SizeBytes: uint64(len(payload)),
		MediaType: "application/octet-stream",
		Purpose:   "compute-work-unit",
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

	plan := ExecutionPlan{
		AuthorizationRef: auth.AuthorizationRef,
		Artifact:         artifact,
		Sandbox:          SandboxRequest{Image: image, Command: command},
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	outcome, err := lifecycle.Execute(ctx, plan)
	if err != nil {
		t.Fatalf("real lifecycle failed: %v; outcome=%+v", err, outcome)
	}
	if outcome.Record.Status != ExecutionExited || outcome.Record.ExitCode != 0 {
		t.Fatalf("unexpected lifecycle record: %+v", outcome.Record)
	}
	if !strings.Contains(outcome.Sandbox.Output, "cmp-lifecycle-probe-ok "+digest) {
		t.Fatalf("container did not receive exact verified work unit: %q", outcome.Sandbox.Output)
	}

	replayed, err := lifecycle.Execute(context.Background(), plan)
	if !errors.Is(err, ErrAttemptReplay) || replayed.Record.Status != ExecutionExited {
		t.Fatalf("exact attempt replay was not rejected: record=%+v err=%v", replayed.Record, err)
	}
}

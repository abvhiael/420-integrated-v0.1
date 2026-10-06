package worker

import (
	"context"
	"os"
	"strings"
	"testing"
	"time"
)

func TestSandboxDockerIntegration(t *testing.T) {
	image := os.Getenv("CMP_SANDBOX_INTEGRATION_IMAGE")
	if image == "" {
		t.Skip("CMP_SANDBOX_INTEGRATION_IMAGE not set")
	}

	policy := DefaultSandboxPolicy("docker")
	policy.Timeout = 20 * time.Second
	sandbox, err := NewSandbox(policy, OSCommandRunner{})
	if err != nil {
		t.Fatal(err)
	}

	result, err := sandbox.Run(context.Background(), SandboxRequest{
		Image: image,
		Command: []string{"/probe"},
	})
	if err != nil {
		t.Fatalf("sandbox run failed: %v; result=%+v", err, result)
	}
	if result.ExitCode != 0 || result.TimedOut {
		t.Fatalf("unexpected sandbox result: %+v", result)
	}
	if !strings.Contains(result.Output, "cmp-sandbox-probe-ok") {
		t.Fatalf("probe success marker missing: %q", result.Output)
	}
}

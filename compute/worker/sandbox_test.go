package worker

import (
	"context"
	"errors"
	"io"
	"slices"
	"strings"
	"testing"
	"time"
)

type runnerCall struct {
	name string
	args []string
}

type fakeCommandRunner struct {
	calls []runnerCall
	err   error
	write string
	block bool
}

func (r *fakeCommandRunner) Run(ctx context.Context, name string, args []string, stdin io.Reader, stdout, stderr io.Writer) error {
	r.calls = append(r.calls, runnerCall{name: name, args: append([]string(nil), args...)})
	if r.write != "" {
		_, _ = io.WriteString(stdout, r.write)
	}
	if r.block && len(r.calls) == 1 {
		<-ctx.Done()
		return ctx.Err()
	}
	return r.err
}

func sandboxRequestFixture() SandboxRequest {
	return SandboxRequest{
		Image: "example.invalid/worker@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
		Command: []string{"/bin/worker", "--task", "fixture"},
	}
}

func TestSandboxPolicyMandatoryControlsFailClosed(t *testing.T) {
	base := DefaultSandboxPolicy("docker")
	tests := []struct{
		name string
		mutate func(*SandboxPolicy)
	}{
		{"network", func(p *SandboxPolicy){ p.NetworkDisabled = false }},
		{"read-only", func(p *SandboxPolicy){ p.ReadOnlyRootFS = false }},
		{"capabilities", func(p *SandboxPolicy){ p.DropAllCaps = false }},
		{"no-new-privileges", func(p *SandboxPolicy){ p.NoNewPrivileges = false }},
		{"root-user", func(p *SandboxPolicy){ p.User = "0:0" }},
		{"no-timeout", func(p *SandboxPolicy){ p.Timeout = 0 }},
		{"no-memory", func(p *SandboxPolicy){ p.MemoryBytes = 0 }},
		{"no-pids", func(p *SandboxPolicy){ p.PidsLimit = 0 }},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			p := base
			tc.mutate(&p)
			if err := p.Validate(); err == nil {
				t.Fatal("unsafe sandbox policy accepted")
			}
		})
	}
}

func TestSandboxRejectsUnpinnedOrMutableImages(t *testing.T) {
	for _, image := range []string{
		"ubuntu:latest",
		"ubuntu@sha256:abc",
		"ubuntu@sha256:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
		"",
	} {
		req := sandboxRequestFixture()
		req.Image = image
		if err := ValidateSandboxRequest(req); err == nil {
			t.Fatalf("mutable/invalid image accepted: %q", image)
		}
	}
}

func TestSandboxCommandHasMandatoryIsolationFlagsAndNoHostMounts(t *testing.T) {
	runner := &fakeCommandRunner{}
	s, err := NewSandbox(DefaultSandboxPolicy("docker"), runner)
	if err != nil { t.Fatal(err) }

	req := sandboxRequestFixture()
	result, err := s.Run(context.Background(), req)
	if err != nil { t.Fatal(err) }
	if result.ExitCode != 0 || len(runner.calls) != 1 {
		t.Fatalf("result=%+v calls=%+v", result, runner.calls)
	}

	args := runner.calls[0].args
	required := [][]string{
		{"--network", "none"},
		{"--read-only"},
		{"--cap-drop", "ALL"},
		{"--security-opt", "no-new-privileges"},
		{"--pids-limit", "128"},
		{"--memory", "536870912"},
		{"--cpus", "1"},
		{"--user", DefaultSandboxUser},
	}
	for _, want := range required {
		if !containsSequence(args, want) {
			t.Fatalf("missing sandbox args %v in %v", want, args)
		}
	}
	for _, forbidden := range []string{"--privileged", "--device", "--volume", "-v", "--mount", "--network=host", "--pid=host", "--ipc=host"} {
		if slices.Contains(args, forbidden) {
			t.Fatalf("forbidden host escape flag present: %q", forbidden)
		}
	}
	if !slices.Contains(args, req.Image) {
		t.Fatal("digest-pinned image missing")
	}
}

func TestSandboxArgumentsDoNotUseShellInterpolation(t *testing.T) {
	runner := &fakeCommandRunner{}
	s, err := NewSandbox(DefaultSandboxPolicy("podman"), runner)
	if err != nil { t.Fatal(err) }
	req := sandboxRequestFixture()
	req.Command = []string{"/bin/echo", "$(touch /host-pwned)", "; rm -rf /"}
	if _, err := s.Run(context.Background(), req); err != nil { t.Fatal(err) }
	if runner.calls[0].name != "podman" {
		t.Fatalf("engine=%q", runner.calls[0].name)
	}
	if !containsSequence(runner.calls[0].args, req.Command) {
		t.Fatalf("command args were altered/interpolated: %v", runner.calls[0].args)
	}
}

func TestSandboxTimeoutTriggersBestEffortForcedCleanup(t *testing.T) {
	runner := &fakeCommandRunner{block: true}
	policy := DefaultSandboxPolicy("docker")
	policy.Timeout = 5 * time.Millisecond
	s, err := NewSandbox(policy, runner)
	if err != nil { t.Fatal(err) }

	result, err := s.Run(context.Background(), sandboxRequestFixture())
	if err == nil || !result.TimedOut {
		t.Fatalf("expected timeout, result=%+v err=%v", result, err)
	}
	if len(runner.calls) != 2 {
		t.Fatalf("expected run + cleanup calls, got %d", len(runner.calls))
	}
	if len(runner.calls[1].args) != 3 || runner.calls[1].args[0] != "rm" || runner.calls[1].args[1] != "-f" {
		t.Fatalf("unexpected cleanup: %+v", runner.calls[1])
	}
}

func TestSandboxOutputIsBounded(t *testing.T) {
	runner := &fakeCommandRunner{write: strings.Repeat("x", 4096)}
	policy := DefaultSandboxPolicy("docker")
	policy.MaxOutputBytes = 1024
	s, err := NewSandbox(policy, runner)
	if err != nil { t.Fatal(err) }

	result, err := s.Run(context.Background(), sandboxRequestFixture())
	if err != nil { t.Fatal(err) }
	if len(result.Output) != 1024 || !result.OutputTruncated {
		t.Fatalf("output limit failed: len=%d truncated=%v", len(result.Output), result.OutputTruncated)
	}
}

func TestSandboxRejectsNULAndEmptyCommands(t *testing.T) {
	req := sandboxRequestFixture()
	req.Command = nil
	if err := ValidateSandboxRequest(req); err == nil {
		t.Fatal("empty command accepted")
	}
	req = sandboxRequestFixture()
	req.Command = []string{"/bin/echo", "bad\x00arg"}
	if err := ValidateSandboxRequest(req); err == nil {
		t.Fatal("NUL command accepted")
	}
}

func TestSandboxRunnerFailureIsVisible(t *testing.T) {
	runner := &fakeCommandRunner{err: errors.New("engine failure")}
	s, err := NewSandbox(DefaultSandboxPolicy("docker"), runner)
	if err != nil { t.Fatal(err) }
	result, err := s.Run(context.Background(), sandboxRequestFixture())
	if err == nil || result.ExitCode != -1 {
		t.Fatalf("engine failure not visible: result=%+v err=%v", result, err)
	}
}

func containsSequence(haystack, needle []string) bool {
	if len(needle) == 0 || len(needle) > len(haystack) {
		return false
	}
	for i := 0; i <= len(haystack)-len(needle); i++ {
		if slices.Equal(haystack[i:i+len(needle)], needle) {
			return true
		}
	}
	return false
}


func TestSandboxHashesCompleteStdoutBeyondDiagnosticCapture(t *testing.T) {
	payload := strings.Repeat("z", 4096)
	runner := &fakeCommandRunner{write: payload}
	policy := DefaultSandboxPolicy("docker")
	policy.MaxOutputBytes = 1024
	sandbox, err := NewSandbox(policy, runner)
	if err != nil {
		t.Fatal(err)
	}
	result, err := sandbox.Run(context.Background(), sandboxRequestFixture())
	if err != nil {
		t.Fatal(err)
	}
	if result.StdoutBytes != uint64(len(payload)) {
		t.Fatalf("stdout bytes=%d want=%d", result.StdoutBytes, len(payload))
	}
	if result.StdoutSHA256 != digestBytes([]byte(payload)) {
		t.Fatalf("stdout digest=%q", result.StdoutSHA256)
	}
	if len(result.Output) != 1024 || !result.OutputTruncated {
		t.Fatalf("diagnostic capture not bounded: len=%d truncated=%v", len(result.Output), result.OutputTruncated)
	}
}

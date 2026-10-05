package worker

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func maliciousFixture(t *testing.T) (*ExecutionLifecycle, ExecutionPlan, ExecutionAuthorization, *WorkloadSecurityGuard, *inputCapturingRunner) {
	t.Helper()
	runner := &inputCapturingRunner{}
	lifecycle, plan, auth := newLifecycleFixture(t, runner)
	policy := DefaultMaliciousWorkloadPolicy()
	guard, err := NewWorkloadSecurityGuard(lifecycle.config, policy)
	if err != nil {
		t.Fatal(err)
	}
	return lifecycle, plan, auth, guard, runner
}

func TestMaliciousWorkloadPolicyValidation(t *testing.T) {
	base := DefaultMaliciousWorkloadPolicy()
	if err := base.Validate(); err != nil {
		t.Fatal(err)
	}
	cases := []MaliciousWorkloadPolicy{base, base, base, base, base}
	cases[0].MaxCommandBytes = 0
	cases[1].MaxArgumentBytes = base.MaxCommandBytes + 1
	cases[2].MaxViolations = 0
	cases[3].QuarantineDuration = 0
	cases[4].DenyCommandSHA256 = map[string]bool{"ABC": true}
	for i, candidate := range cases {
		if err := candidate.Validate(); err == nil {
			t.Fatalf("invalid policy case %d accepted", i)
		}
	}
}

func TestMaliciousWorkloadPreflightBindsCanonicalImageAndCommand(t *testing.T) {
	_, plan, auth, guard, _ := maliciousFixture(t)
	if err := guard.Preflight(auth, plan.Sandbox); err != nil {
		t.Fatal(err)
	}
	badImage := plan.Sandbox
	badImage.Image = "sha256:" + strings.Repeat("9", 64)
	if err := guard.Preflight(auth, badImage); !errors.Is(err, ErrMaliciousWorkloadRejected) {
		t.Fatalf("image substitution accepted: %v", err)
	}
	badCommand := plan.Sandbox
	badCommand.Command = []string{"/different"}
	if err := guard.Preflight(auth, badCommand); !errors.Is(err, ErrMaliciousWorkloadRejected) {
		t.Fatalf("command substitution accepted: %v", err)
	}
}

func TestMaliciousWorkloadPreflightEnforcesCommandBoundsAndDenyDigests(t *testing.T) {
	lifecycle, plan, auth, _, _ := maliciousFixture(t)
	commandHash, err := CommandSHA256(plan.Sandbox.Command)
	if err != nil {
		t.Fatal(err)
	}
	policy := DefaultMaliciousWorkloadPolicy()
	policy.MaxArgumentBytes = 4
	policy.MaxCommandBytes = 16
	guard, err := NewWorkloadSecurityGuard(lifecycle.config, policy)
	if err != nil {
		t.Fatal(err)
	}
	if err := guard.Preflight(auth, plan.Sandbox); !errors.Is(err, ErrMaliciousWorkloadRejected) {
		t.Fatalf("oversized command argument accepted: %v", err)
	}

	policy = DefaultMaliciousWorkloadPolicy()
	policy.DenyImageDigests = map[string]bool{plan.Sandbox.Image: true}
	guard, err = NewWorkloadSecurityGuard(lifecycle.config, policy)
	if err != nil {
		t.Fatal(err)
	}
	if err := guard.Preflight(auth, plan.Sandbox); !errors.Is(err, ErrMaliciousWorkloadRejected) {
		t.Fatalf("denied image accepted: %v", err)
	}

	policy = DefaultMaliciousWorkloadPolicy()
	policy.DenyCommandSHA256 = map[string]bool{commandHash: true}
	guard, err = NewWorkloadSecurityGuard(lifecycle.config, policy)
	if err != nil {
		t.Fatal(err)
	}
	if err := guard.Preflight(auth, plan.Sandbox); !errors.Is(err, ErrMaliciousWorkloadRejected) {
		t.Fatalf("denied command accepted: %v", err)
	}
}

func TestSecurityGuardQuarantinesRepeatedAbuseAndPersistsAcrossRestart(t *testing.T) {
	lifecycle, plan, auth, _, _ := maliciousFixture(t)
	policy := DefaultMaliciousWorkloadPolicy()
	policy.MaxViolations = 2
	policy.QuarantineDuration = time.Hour
	guard, err := NewWorkloadSecurityGuard(lifecycle.config, policy)
	if err != nil {
		t.Fatal(err)
	}
	now := time.Date(2026, 10, 5, 5, 0, 0, 0, time.UTC)
	guard.now = func() time.Time { return now }
	abusive := ExecutionOutcome{
		Record: ExecutionRecord{Status: ExecutionFailed, OutputTruncated: true},
		Sandbox: SandboxResult{OutputTruncated: true},
	}
	if err := guard.Observe(auth, plan.Sandbox, abusive, errors.New("sandbox failed")); err != nil {
		t.Fatal(err)
	}
	now = now.Add(time.Second)
	if err := guard.Observe(auth, plan.Sandbox, abusive, errors.New("sandbox failed")); err != nil {
		t.Fatal(err)
	}
	if err := guard.Preflight(auth, plan.Sandbox); !errors.Is(err, ErrWorkloadQuarantined) {
		t.Fatalf("repeated abusive workload not quarantined: %v", err)
	}

	restarted, err := NewWorkloadSecurityGuard(lifecycle.config, policy)
	if err != nil {
		t.Fatal(err)
	}
	restarted.now = func() time.Time { return now }
	if err := restarted.Preflight(auth, plan.Sandbox); !errors.Is(err, ErrWorkloadQuarantined) {
		t.Fatalf("restart lost quarantine state: %v", err)
	}
}

func TestSecurityIncidentEvidenceIsPrivateNonAuthoritativeAndPayloadFree(t *testing.T) {
	lifecycle, plan, auth, guard, _ := maliciousFixture(t)
	outcome := ExecutionOutcome{
		Record: ExecutionRecord{Status: ExecutionFailed, OutputTruncated: true},
		Sandbox: SandboxResult{Output: "secret-output", OutputTruncated: true},
	}
	if err := guard.Observe(auth, plan.Sandbox, outcome, errors.New("sandbox failure")); err != nil {
		t.Fatal(err)
	}
	entries, err := os.ReadDir(guard.root)
	if err != nil {
		t.Fatal(err)
	}
	if len(entries) != 1 {
		t.Fatalf("incident files=%d", len(entries))
	}
	path := filepath.Join(guard.root, entries[0].Name())
	info, err := os.Stat(path)
	if err != nil {
		t.Fatal(err)
	}
	if info.Mode().Perm() != 0o600 {
		t.Fatalf("incident mode=%o", info.Mode().Perm())
	}
	raw, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(raw), "secret-output") || strings.Contains(string(raw), strings.Join(plan.Sandbox.Command, " ")) {
		t.Fatal("incident persisted raw command/output")
	}
	var incident SecurityIncident
	if err := json.Unmarshal(raw, &incident); err != nil {
		t.Fatal(err)
	}
	if incident.Authoritative || incident.AuthorizationRef != auth.AuthorizationRef ||
		incident.Image != plan.Sandbox.Image || incident.CommandSHA256 != auth.CommandSHA256 {
		t.Fatalf("bad incident evidence: %+v", incident)
	}
}

func TestSecurityGuardFailsClosedOnTamperedIncidentState(t *testing.T) {
	lifecycle, _, _, guard, _ := maliciousFixture(t)
	path := filepath.Join(guard.root, "tampered.json")
	if err := os.WriteFile(path, []byte("{bad-json"), 0o600); err != nil {
		t.Fatal(err)
	}
	if _, err := NewWorkloadSecurityGuard(lifecycle.config, DefaultMaliciousWorkloadPolicy()); err == nil {
		t.Fatal("tampered incident state ignored")
	}
}

func TestProtectedExecutionLifecycleRejectsDeniedWorkloadBeforeSandbox(t *testing.T) {
	lifecycle, plan, _, _, runner := maliciousFixture(t)
	policy := DefaultMaliciousWorkloadPolicy()
	policy.DenyImageDigests = map[string]bool{plan.Sandbox.Image: true}
	guard, err := NewWorkloadSecurityGuard(lifecycle.config, policy)
	if err != nil {
		t.Fatal(err)
	}
	protected, err := NewProtectedExecutionLifecycle(lifecycle, guard)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := protected.Execute(context.Background(), plan); !errors.Is(err, ErrMaliciousWorkloadRejected) {
		t.Fatalf("denied workload reached lifecycle: %v", err)
	}
	if runner.input != "" {
		t.Fatal("denied workload reached sandbox")
	}
}

func TestProtectedExecutionLifecycleObservesSandboxAbuse(t *testing.T) {
	runner := &fakeCommandRunner{write: strings.Repeat("x", 4096)}
	cfg := lifecycleConfig(t)
	artifact := writeLifecycleArtifact(t, cfg, []byte("malicious-output-work"))
	image := "sha256:" + strings.Repeat("8", 64)
	command := []string{"/worker"}
	auth := executionFixture(t, cfg, artifact, image, command)
	authority := CanonicalExecutionAuthorityFunc(func(context.Context, string) (ExecutionAuthorization, error) { return auth, nil })
	sandboxPolicy := DefaultSandboxPolicy("docker")
	sandboxPolicy.MaxOutputBytes = 1024
	sandbox, err := NewSandbox(sandboxPolicy, runner)
	if err != nil {
		t.Fatal(err)
	}
	lifecycle, err := NewExecutionLifecycle(cfg, authority, sandbox)
	if err != nil {
		t.Fatal(err)
	}
	policy := DefaultMaliciousWorkloadPolicy()
	policy.MaxViolations = 1
	guard, err := NewWorkloadSecurityGuard(cfg, policy)
	if err != nil {
		t.Fatal(err)
	}
	protected, err := NewProtectedExecutionLifecycle(lifecycle, guard)
	if err != nil {
		t.Fatal(err)
	}
	plan := ExecutionPlan{
		AuthorizationRef: auth.AuthorizationRef,
		Artifact: artifact,
		Sandbox: SandboxRequest{Image: image, Command: command},
	}
	if _, err := protected.Execute(context.Background(), plan); err != nil {
		t.Fatal(err)
	}
	if err := guard.Preflight(auth, plan.Sandbox); !errors.Is(err, ErrWorkloadQuarantined) {
		t.Fatalf("output-abusive workload not quarantined: %v", err)
	}
}

func TestSandboxIncludesMaliciousWorkloadHardeningFlags(t *testing.T) {
	runner := &fakeCommandRunner{}
	sandbox, err := NewSandbox(DefaultSandboxPolicy("docker"), runner)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := sandbox.Run(context.Background(), sandboxRequestFixture()); err != nil {
		t.Fatal(err)
	}
	args := strings.Join(runner.calls[0].args, " ")
	for _, want := range []string{
		"--ipc none",
		"--ulimit core=0:0",
		"--ulimit nofile=1024:1024",
		"--pids-limit 128",
		"--network none",
		"--cap-drop ALL",
		"--security-opt no-new-privileges",
	} {
		if !strings.Contains(args, want) {
			t.Fatalf("missing hardening %q in %q", want, args)
		}
	}
}

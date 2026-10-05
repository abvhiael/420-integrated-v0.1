package worker

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

const (
	MaliciousWorkloadPolicySchemaV1 = "420-compute-worker-malicious-workload-policy-v1"
	SecurityIncidentSchemaV1        = "420-compute-worker-security-incident-v1"
	DefaultMaxCommandBytes          = 64 << 10
	DefaultMaxArgumentBytes         = 8 << 10
)

var (
	ErrInvalidMaliciousWorkloadPolicy = errors.New("invalid compute worker malicious workload policy")
	ErrMaliciousWorkloadRejected      = errors.New("compute worker workload rejected by local security policy")
	ErrWorkloadQuarantined            = errors.New("compute worker workload locally quarantined")
)

type MaliciousWorkloadPolicy struct {
	SchemaVersion              string
	MaxCommandBytes            int
	MaxArgumentBytes           int
	MaxViolations   uint32
	QuarantineDuration         time.Duration
	DenyImageDigests           map[string]bool
	DenyCommandSHA256          map[string]bool
	QuarantineOnTimeout        bool
	QuarantineOnOutputAbuse    bool
	QuarantineOnSandboxFailure bool
}

func DefaultMaliciousWorkloadPolicy() MaliciousWorkloadPolicy {
	return MaliciousWorkloadPolicy{
		SchemaVersion:              MaliciousWorkloadPolicySchemaV1,
		MaxCommandBytes:            DefaultMaxCommandBytes,
		MaxArgumentBytes:           DefaultMaxArgumentBytes,
		MaxViolations:   3,
		QuarantineDuration:         30 * time.Minute,
		DenyImageDigests:           map[string]bool{},
		DenyCommandSHA256:          map[string]bool{},
		QuarantineOnTimeout:        true,
		QuarantineOnOutputAbuse:    true,
		QuarantineOnSandboxFailure: true,
	}
}

func (p MaliciousWorkloadPolicy) Validate() error {
	if p.SchemaVersion != MaliciousWorkloadPolicySchemaV1 {
		return fmt.Errorf("%w: unsupported schema", ErrInvalidMaliciousWorkloadPolicy)
	}
	if p.MaxCommandBytes <= 0 || p.MaxCommandBytes > 1<<20 ||
		p.MaxArgumentBytes <= 0 || p.MaxArgumentBytes > p.MaxCommandBytes {
		return fmt.Errorf("%w: invalid command bounds", ErrInvalidMaliciousWorkloadPolicy)
	}
	if p.MaxViolations == 0 || p.MaxViolations > 100 {
		return fmt.Errorf("%w: invalid violation threshold", ErrInvalidMaliciousWorkloadPolicy)
	}
	if p.QuarantineDuration <= 0 || p.QuarantineDuration > 30*24*time.Hour {
		return fmt.Errorf("%w: invalid quarantine duration", ErrInvalidMaliciousWorkloadPolicy)
	}
	for digest, denied := range p.DenyImageDigests {
		if denied && !digestImagePattern.MatchString(digest) {
			return fmt.Errorf("%w: invalid denied image digest", ErrInvalidMaliciousWorkloadPolicy)
		}
	}
	for digest, denied := range p.DenyCommandSHA256 {
		if !denied {
			continue
		}
		if !sha256HexPattern.MatchString(strings.ToLower(digest)) || digest != strings.ToLower(digest) {
			return fmt.Errorf("%w: invalid denied command digest", ErrInvalidMaliciousWorkloadPolicy)
		}
	}
	return nil
}

type WorkloadSecurityKey struct {
	Image         string
	CommandSHA256 string
}

type SecurityIncident struct {
	SchemaVersion    string    `json:"schemaVersion"`
	AuthorizationRef string    `json:"authorizationRef"`
	AttemptRef       string    `json:"attemptRef"`
	Image            string    `json:"image"`
	CommandSHA256    string    `json:"commandSha256"`
	Reason           string    `json:"reason"`
	ObservedAt       time.Time `json:"observedAt"`
	ViolationCount   uint32    `json:"violationCount"`
	QuarantinedUntil time.Time `json:"quarantinedUntil,omitempty"`
	Authoritative    bool      `json:"authoritative"`
}

type quarantineEntry struct {
	Count uint32
	Until time.Time
}

type WorkloadSecurityGuard struct {
	config Config
	root   string
	policy MaliciousWorkloadPolicy
	now    func() time.Time
	mu     sync.Mutex
	state  map[WorkloadSecurityKey]quarantineEntry
}

func NewWorkloadSecurityGuard(config Config, policy MaliciousWorkloadPolicy) (*WorkloadSecurityGuard, error) {
	if err := policy.Validate(); err != nil {
		return nil, err
	}
	stateRoot, err := config.PrepareStateDir()
	if err != nil {
		return nil, err
	}
	root := filepath.Join(stateRoot, "security-incidents")
	if err := os.MkdirAll(root, 0o700); err != nil {
		return nil, err
	}
	if err := os.Chmod(root, 0o700); err != nil {
		return nil, err
	}
	guard := &WorkloadSecurityGuard{
		config: config, root: root, policy: policy, now: time.Now,
		state: make(map[WorkloadSecurityKey]quarantineEntry),
	}
	if err := guard.recoverState(); err != nil {
		return nil, err
	}
	return guard, nil
}

func (g *WorkloadSecurityGuard) recoverState() error {
	entries, err := os.ReadDir(g.root)
	if err != nil {
		return err
	}
	latest := make(map[WorkloadSecurityKey]SecurityIncident)
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".json") {
			continue
		}
		path := filepath.Join(g.root, entry.Name())
		info, err := os.Lstat(path)
		if err != nil {
			return err
		}
		if !info.Mode().IsRegular() || info.Mode()&os.ModeSymlink != 0 || info.Mode().Perm()&0o077 != 0 {
			return ErrInvalidMaliciousWorkloadPolicy
		}
		raw, err := os.ReadFile(path)
		if err != nil {
			return err
		}
		var incident SecurityIncident
		if err := json.Unmarshal(raw, &incident); err != nil {
			return err
		}
		if incident.SchemaVersion != SecurityIncidentSchemaV1 || incident.Authoritative ||
			incident.ObservedAt.IsZero() ||
			!digestImagePattern.MatchString(incident.Image) ||
			!sha256HexPattern.MatchString(incident.CommandSHA256) {
			return ErrInvalidMaliciousWorkloadPolicy
		}
		key := WorkloadSecurityKey{Image: incident.Image, CommandSHA256: incident.CommandSHA256}
		if current, ok := latest[key]; !ok || incident.ObservedAt.After(current.ObservedAt) {
			latest[key] = incident
		}
	}
	for key, incident := range latest {
		g.state[key] = quarantineEntry{Count: incident.ViolationCount, Until: incident.QuarantinedUntil}
	}
	return nil
}

func (g *WorkloadSecurityGuard) Preflight(auth ExecutionAuthorization, request SandboxRequest) error {
	if g == nil {
		return ErrInvalidMaliciousWorkloadPolicy
	}
	if err := ValidateExecutionAuthorization(auth); err != nil {
		return err
	}
	if err := ValidateSandboxRequest(request); err != nil {
		return err
	}
	commandHash, err := CommandSHA256(request.Command)
	if err != nil {
		return err
	}
	if commandHash != auth.CommandSHA256 || request.Image != auth.SandboxImage {
		return fmt.Errorf("%w: executable/command differs from canonical authorization", ErrMaliciousWorkloadRejected)
	}
	total := 0
	for _, arg := range request.Command {
		if len(arg) > g.policy.MaxArgumentBytes {
			return fmt.Errorf("%w: command argument exceeds local security bound", ErrMaliciousWorkloadRejected)
		}
		total += len(arg)
		if total > g.policy.MaxCommandBytes {
			return fmt.Errorf("%w: command exceeds local security bound", ErrMaliciousWorkloadRejected)
		}
	}
	if g.policy.DenyImageDigests[request.Image] {
		return fmt.Errorf("%w: image digest denied by local policy", ErrMaliciousWorkloadRejected)
	}
	if g.policy.DenyCommandSHA256[commandHash] {
		return fmt.Errorf("%w: command digest denied by local policy", ErrMaliciousWorkloadRejected)
	}
	key := WorkloadSecurityKey{Image: request.Image, CommandSHA256: commandHash}
	g.mu.Lock()
	entry := g.state[key]
	now := g.now().UTC()
	if !entry.Until.IsZero() && !now.Before(entry.Until) {
		entry.Until = time.Time{}
		entry.Count = 0
		g.state[key] = entry
	}
	g.mu.Unlock()
	if !entry.Until.IsZero() && now.Before(entry.Until) {
		return fmt.Errorf("%w: until %s", ErrWorkloadQuarantined, entry.Until.Format(time.RFC3339))
	}
	return nil
}

func (g *WorkloadSecurityGuard) Observe(auth ExecutionAuthorization, request SandboxRequest, outcome ExecutionOutcome, runErr error) error {
	if g == nil {
		return ErrInvalidMaliciousWorkloadPolicy
	}
	commandHash, err := CommandSHA256(request.Command)
	if err != nil {
		return err
	}
	reason := ""
	switch {
	case g.policy.QuarantineOnTimeout && (outcome.Sandbox.TimedOut || outcome.Record.TimedOut):
		reason = "timeout"
	case g.policy.QuarantineOnOutputAbuse && (outcome.Sandbox.OutputTruncated || outcome.Record.OutputTruncated):
		reason = "output-limit"
	case g.policy.QuarantineOnSandboxFailure && runErr != nil &&
		(outcome.Record.Status == ExecutionFailed || outcome.Record.Status == ExecutionInterrupted):
		reason = "sandbox-failure"
	}
	key := WorkloadSecurityKey{Image: request.Image, CommandSHA256: commandHash}
	g.mu.Lock()
	entry := g.state[key]
	if reason == "" {
		g.mu.Unlock()
		return nil
	}
	entry.Count++
	now := g.now().UTC()
	if entry.Count >= g.policy.MaxViolations {
		entry.Until = now.Add(g.policy.QuarantineDuration)
	}
	g.state[key] = entry
	g.mu.Unlock()
	return g.persistIncident(SecurityIncident{
		SchemaVersion: SecurityIncidentSchemaV1,
		AuthorizationRef: auth.AuthorizationRef,
		AttemptRef: auth.AttemptRef,
		Image: request.Image,
		CommandSHA256: commandHash,
		Reason: reason,
		ObservedAt: now,
		ViolationCount: entry.Count,
		QuarantinedUntil: entry.Until,
		Authoritative: false,
	})
}

func (g *WorkloadSecurityGuard) persistIncident(incident SecurityIncident) error {
	payload, err := json.MarshalIndent(incident, "", "  ")
	if err != nil {
		return err
	}
	name := strings.TrimPrefix(strings.ToLower(incident.AttemptRef), "0x") + "-" +
		fmt.Sprintf("%d", incident.ObservedAt.UnixNano()) + ".json"
	path := filepath.Join(g.root, name)
	tmp, err := os.CreateTemp(g.root, ".incident-*")
	if err != nil {
		return err
	}
	tmpName := tmp.Name()
	cleanup := func() {
		_ = tmp.Close()
		_ = os.Remove(tmpName)
	}
	if err := tmp.Chmod(0o600); err != nil {
		cleanup()
		return err
	}
	if _, err := tmp.Write(payload); err != nil {
		cleanup()
		return err
	}
	if err := tmp.Sync(); err != nil {
		cleanup()
		return err
	}
	if err := tmp.Close(); err != nil {
		_ = os.Remove(tmpName)
		return err
	}
	if err := os.Rename(tmpName, path); err != nil {
		_ = os.Remove(tmpName)
		return err
	}
	return syncDirectory(g.root)
}

type ProtectedExecutionLifecycle struct {
	inner *ExecutionLifecycle
	guard *WorkloadSecurityGuard
}

func NewProtectedExecutionLifecycle(inner *ExecutionLifecycle, guard *WorkloadSecurityGuard) (*ProtectedExecutionLifecycle, error) {
	if inner == nil || guard == nil {
		return nil, fmt.Errorf("%w: lifecycle and guard required", ErrInvalidMaliciousWorkloadPolicy)
	}
	return &ProtectedExecutionLifecycle{inner: inner, guard: guard}, nil
}

func (p *ProtectedExecutionLifecycle) Execute(ctx context.Context, plan ExecutionPlan) (ExecutionOutcome, error) {
	auth, err := p.inner.authority.ResolveExecutionAuthorization(ctx, plan.AuthorizationRef)
	if err != nil {
		return ExecutionOutcome{}, err
	}
	if err := p.guard.Preflight(auth, plan.Sandbox); err != nil {
		return ExecutionOutcome{}, err
	}
	outcome, runErr := p.inner.Execute(ctx, plan)
	observeErr := p.guard.Observe(auth, plan.Sandbox, outcome, runErr)
	if runErr != nil && observeErr != nil {
		return outcome, fmt.Errorf("%v; security evidence: %w", runErr, observeErr)
	}
	if runErr != nil {
		return outcome, runErr
	}
	return outcome, observeErr
}

func (p *ProtectedExecutionLifecycle) Resume(ctx context.Context, plan ExecutionPlan, checkpoints *CheckpointStore) (ExecutionOutcome, error) {
	auth, err := p.inner.authority.ResolveExecutionAuthorization(ctx, plan.AuthorizationRef)
	if err != nil {
		return ExecutionOutcome{}, err
	}
	if err := p.guard.Preflight(auth, plan.Sandbox); err != nil {
		return ExecutionOutcome{}, err
	}
	outcome, runErr := p.inner.Resume(ctx, plan, checkpoints)
	observeErr := p.guard.Observe(auth, plan.Sandbox, outcome, runErr)
	if runErr != nil && observeErr != nil {
		return outcome, fmt.Errorf("%v; security evidence: %w", runErr, observeErr)
	}
	if runErr != nil {
		return outcome, runErr
	}
	return outcome, observeErr
}

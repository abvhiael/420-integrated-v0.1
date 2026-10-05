package worker

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

const (
	ExecutionAuthorizationSchemaV1 = "420-compute-worker-execution-authorization-v1"
	ExecutionRecordSchemaV1        = "420-compute-worker-execution-record-v1"
)

var (
	ErrInvalidExecutionAuthorization = errors.New("invalid compute worker execution authorization")
	ErrAttemptReplay                 = errors.New("compute worker attempt already finalized")
	ErrAttemptInProgress             = errors.New("compute worker attempt already in progress")
)

type ExecutionAuthorization struct {
	SchemaVersion        string    `json:"schemaVersion"`
	AuthorizationRef     string    `json:"authorizationRef"`
	ChainID              uint64    `json:"chainId"`
	JobID                string    `json:"jobId"`
	UnitID               string    `json:"unitId"`
	RootAssignmentRef    string    `json:"rootAssignmentRef"`
	AttemptRef           string    `json:"attemptRef"`
	AttemptNonce         uint64    `json:"attemptNonce"`
	ProviderID           string    `json:"providerId"`
	NodeID               string    `json:"nodeId"`
	ResourceID           string    `json:"resourceId"`
	WorkerID             string    `json:"workerId"`
	ManifestHash         string    `json:"manifestHash"`
	ConstraintCommitment string    `json:"constraintCommitment"`
	InputAccessRef       string    `json:"inputAccessRef"`
	WorkUnitSHA256       string    `json:"workUnitSha256"`
	WorkUnitSize         uint64    `json:"workUnitSize"`
	SandboxImage         string    `json:"sandboxImage"`
	CommandSHA256        string    `json:"commandSha256"`
	Deadline             time.Time `json:"deadline"`
	LeaseExpiresAt       time.Time `json:"leaseExpiresAt"`
}

type CanonicalExecutionAuthority interface {
	ResolveExecutionAuthorization(context.Context, string) (ExecutionAuthorization, error)
}

type CanonicalExecutionAuthorityFunc func(context.Context, string) (ExecutionAuthorization, error)

func (f CanonicalExecutionAuthorityFunc) ResolveExecutionAuthorization(ctx context.Context, ref string) (ExecutionAuthorization, error) {
	return f(ctx, ref)
}

type ExecutionStatus string

const (
	ExecutionPrepared    ExecutionStatus = "prepared"
	ExecutionResuming    ExecutionStatus = "resuming"
	ExecutionRunning     ExecutionStatus = "running"
	ExecutionExited      ExecutionStatus = "exited"
	ExecutionFailed      ExecutionStatus = "failed"
	ExecutionCancelled   ExecutionStatus = "cancelled"
	ExecutionExpired     ExecutionStatus = "expired"
	ExecutionInterrupted ExecutionStatus = "interrupted"
)

type ExecutionTransition struct {
	Status ExecutionStatus `json:"status"`
	At     time.Time       `json:"at"`
	Code   string          `json:"code,omitempty"`
}

type ExecutionRecord struct {
	SchemaVersion       string                `json:"schemaVersion"`
	AuthorizationRef    string                `json:"authorizationRef"`
	ExecutionCommitment string                `json:"executionCommitment"`
	JobID               string                `json:"jobId"`
	UnitID              string                `json:"unitId"`
	AttemptRef           string                `json:"attemptRef"`
	AttemptNonce         uint64                `json:"attemptNonce"`
	WorkerID             string                `json:"workerId"`
	ResourceID           string                `json:"resourceId"`
	WorkUnitSHA256       string                `json:"workUnitSha256"`
	SandboxImage         string                `json:"sandboxImage"`
	CommandSHA256        string                `json:"commandSha256"`
	Status               ExecutionStatus       `json:"status"`
	ExitCode             int                   `json:"exitCode,omitempty"`
	TimedOut             bool                  `json:"timedOut,omitempty"`
	OutputTruncated      bool                  `json:"outputTruncated,omitempty"`
	StdoutSHA256         string                `json:"stdoutSha256,omitempty"`
	StdoutBytes          uint64                `json:"stdoutBytes,omitempty"`
	ResumeCheckpointCommitment string          `json:"resumeCheckpointCommitment,omitempty"`
	StartedAt            time.Time             `json:"startedAt,omitempty"`
	EndedAt              time.Time             `json:"endedAt,omitempty"`
	Transitions          []ExecutionTransition `json:"transitions"`
}

type ExecutionPlan struct {
	AuthorizationRef string
	Artifact         WorkUnitArtifact
	Sandbox          SandboxRequest
}

type ExecutionOutcome struct {
	Record  ExecutionRecord
	Sandbox SandboxResult
}

type ExecutionLifecycle struct {
	config    Config
	stateRoot string
	attempts  string
	authority CanonicalExecutionAuthority
	sandbox   *Sandbox
	now       func() time.Time
	mu        sync.Mutex
}

func NewExecutionLifecycle(config Config, authority CanonicalExecutionAuthority, sandbox *Sandbox) (*ExecutionLifecycle, error) {
	if authority == nil || sandbox == nil {
		return nil, fmt.Errorf("%w: canonical authority and sandbox required", ErrInvalidExecutionAuthorization)
	}
	root, err := config.PrepareStateDir()
	if err != nil {
		return nil, err
	}
	attempts := filepath.Join(root, "attempts")
	if err := os.MkdirAll(attempts, 0o700); err != nil {
		return nil, err
	}
	if err := os.Chmod(attempts, 0o700); err != nil {
		return nil, err
	}
	lifecycle := &ExecutionLifecycle{
		config: config, stateRoot: root, attempts: attempts,
		authority: authority, sandbox: sandbox, now: time.Now,
	}
	if err := lifecycle.recoverInterrupted(); err != nil {
		return nil, err
	}
	return lifecycle, nil
}

func CommandSHA256(command []string) (string, error) {
	if len(command) == 0 {
		return "", fmt.Errorf("%w: empty command", ErrInvalidExecutionAuthorization)
	}
	payload, err := json.Marshal(command)
	if err != nil {
		return "", err
	}
	sum := sha256.Sum256(payload)
	return hex.EncodeToString(sum[:]), nil
}

func ValidateExecutionAuthorization(auth ExecutionAuthorization) error {
	if auth.SchemaVersion != ExecutionAuthorizationSchemaV1 {
		return fmt.Errorf("%w: unsupported schema", ErrInvalidExecutionAuthorization)
	}
	for name, value := range map[string]string{
		"authorization ref": auth.AuthorizationRef,
		"job id": auth.JobID,
		"unit id": auth.UnitID,
		"root assignment ref": auth.RootAssignmentRef,
		"attempt ref": auth.AttemptRef,
		"provider id": auth.ProviderID,
		"node id": auth.NodeID,
		"resource id": auth.ResourceID,
		"worker id": auth.WorkerID,
		"manifest hash": auth.ManifestHash,
		"constraint commitment": auth.ConstraintCommitment,
		"input access ref": auth.InputAccessRef,
	} {
		if err := validateBytes32(name, value); err != nil {
			return fmt.Errorf("%w: %v", ErrInvalidExecutionAuthorization, err)
		}
	}
	if auth.ChainID == 0 || auth.AttemptNonce == 0 {
		return fmt.Errorf("%w: chain and attempt nonce must be non-zero", ErrInvalidExecutionAuthorization)
	}
	if !sha256HexPattern.MatchString(auth.WorkUnitSHA256) || !sha256HexPattern.MatchString(auth.CommandSHA256) {
		return fmt.Errorf("%w: canonical SHA-256 commitments required", ErrInvalidExecutionAuthorization)
	}
	if auth.WorkUnitSize == 0 {
		return fmt.Errorf("%w: work-unit size required", ErrInvalidExecutionAuthorization)
	}
	if !digestImagePattern.MatchString(auth.SandboxImage) {
		return fmt.Errorf("%w: immutable sandbox image required", ErrInvalidExecutionAuthorization)
	}
	if auth.Deadline.IsZero() || auth.LeaseExpiresAt.IsZero() || auth.LeaseExpiresAt.After(auth.Deadline) {
		return fmt.Errorf("%w: invalid deadline/lease", ErrInvalidExecutionAuthorization)
	}
	return nil
}

func (l *ExecutionLifecycle) Execute(ctx context.Context, plan ExecutionPlan) (ExecutionOutcome, error) {
	if l == nil || l.authority == nil || l.sandbox == nil {
		return ExecutionOutcome{}, ErrInvalidExecutionAuthorization
	}
	if err := validateBytes32("authorization ref", plan.AuthorizationRef); err != nil {
		return ExecutionOutcome{}, fmt.Errorf("%w: %v", ErrInvalidExecutionAuthorization, err)
	}
	auth, err := l.authority.ResolveExecutionAuthorization(ctx, plan.AuthorizationRef)
	if err != nil {
		return ExecutionOutcome{}, fmt.Errorf("%w: resolve canonical authorization: %v", ErrInvalidExecutionAuthorization, err)
	}
	if err := l.validatePlan(auth, plan); err != nil {
		return ExecutionOutcome{}, err
	}

	recordPath := l.recordPath(auth.AttemptRef)
	l.mu.Lock()
	if existing, err := l.readRecord(recordPath); err == nil {
		l.mu.Unlock()
		if existing.Status == ExecutionPrepared || existing.Status == ExecutionRunning {
			return ExecutionOutcome{}, ErrAttemptInProgress
		}
		return ExecutionOutcome{Record: existing}, ErrAttemptReplay
	} else if !errors.Is(err, os.ErrNotExist) {
		l.mu.Unlock()
		return ExecutionOutcome{}, err
	}

	now := l.now().UTC()
	if !now.Before(auth.Deadline) || !now.Before(auth.LeaseExpiresAt) {
		record := l.newRecord(auth, ExecutionExpired, now, "authorization-expired")
		record.EndedAt = now
		if err := l.persistRecord(recordPath, record); err != nil {
			l.mu.Unlock()
			return ExecutionOutcome{}, err
		}
		l.mu.Unlock()
		return ExecutionOutcome{Record: record}, fmt.Errorf("%w: authorization expired", ErrInvalidExecutionAuthorization)
	}

	artifact, err := l.openVerifiedArtifact(auth, plan.Artifact)
	if err != nil {
		l.mu.Unlock()
		return ExecutionOutcome{}, err
	}

	record := l.newRecord(auth, ExecutionPrepared, now, "")
	if err := l.persistRecord(recordPath, record); err != nil {
		_ = artifact.Close()
		l.mu.Unlock()
		return ExecutionOutcome{}, err
	}
	record.Status = ExecutionRunning
	record.StartedAt = l.now().UTC()
	record.Transitions = append(record.Transitions, ExecutionTransition{Status: ExecutionRunning, At: record.StartedAt})
	if err := l.persistRecord(recordPath, record); err != nil {
		_ = artifact.Close()
		l.mu.Unlock()
		return ExecutionOutcome{}, err
	}
	l.mu.Unlock()
	defer artifact.Close()

	executionDeadline := auth.Deadline
	if auth.LeaseExpiresAt.Before(executionDeadline) {
		executionDeadline = auth.LeaseExpiresAt
	}
	runCtx, cancel := context.WithDeadline(ctx, executionDeadline)
	defer cancel()

	sandboxResult, runErr := l.sandbox.RunWithInput(runCtx, plan.Sandbox, artifact)
	ended := l.now().UTC()
	record.EndedAt = ended
	record.ExitCode = sandboxResult.ExitCode
	record.TimedOut = sandboxResult.TimedOut
	record.OutputTruncated = sandboxResult.OutputTruncated
	record.StdoutSHA256 = sandboxResult.StdoutSHA256
	record.StdoutBytes = sandboxResult.StdoutBytes

	switch {
	case errors.Is(runCtx.Err(), context.DeadlineExceeded):
		record.Status = ExecutionExpired
		record.Transitions = append(record.Transitions, ExecutionTransition{Status: ExecutionExpired, At: ended, Code: "lease-or-deadline"})
	case errors.Is(runCtx.Err(), context.Canceled):
		record.Status = ExecutionCancelled
		record.Transitions = append(record.Transitions, ExecutionTransition{Status: ExecutionCancelled, At: ended, Code: "context-cancelled"})
	case runErr != nil:
		record.Status = ExecutionFailed
		record.Transitions = append(record.Transitions, ExecutionTransition{Status: ExecutionFailed, At: ended, Code: "sandbox-failed"})
	default:
		record.Status = ExecutionExited
		record.Transitions = append(record.Transitions, ExecutionTransition{Status: ExecutionExited, At: ended, Code: "process-exited"})
	}
	if err := l.persistRecord(recordPath, record); err != nil {
		return ExecutionOutcome{}, err
	}
	outcome := ExecutionOutcome{Record: record, Sandbox: sandboxResult}
	if runErr != nil {
		return outcome, runErr
	}
	if record.Status != ExecutionExited {
		return outcome, fmt.Errorf("execution ended with local status %s", record.Status)
	}
	return outcome, nil
}


func (l *ExecutionLifecycle) Resume(
	ctx context.Context,
	plan ExecutionPlan,
	checkpoints *CheckpointStore,
) (ExecutionOutcome, error) {
	if l == nil || l.authority == nil || l.sandbox == nil || checkpoints == nil {
		return ExecutionOutcome{}, ErrInvalidExecutionAuthorization
	}
	if err := validateBytes32("authorization ref", plan.AuthorizationRef); err != nil {
		return ExecutionOutcome{}, fmt.Errorf("%w: %v", ErrInvalidExecutionAuthorization, err)
	}
	auth, err := l.authority.ResolveExecutionAuthorization(ctx, plan.AuthorizationRef)
	if err != nil {
		return ExecutionOutcome{}, fmt.Errorf("%w: resolve canonical authorization: %v", ErrInvalidExecutionAuthorization, err)
	}
	if err := l.validatePlan(auth, plan); err != nil {
		return ExecutionOutcome{}, err
	}
	if checkpoints.authority == nil || checkpoints.config.Identity != l.config.Identity {
		return ExecutionOutcome{}, fmt.Errorf("%w: checkpoint store identity mismatch", ErrInvalidExecutionAuthorization)
	}

	recordPath := l.recordPath(auth.AttemptRef)
	l.mu.Lock()
	record, err := l.readRecord(recordPath)
	if err != nil {
		l.mu.Unlock()
		return ExecutionOutcome{}, err
	}
	if record.Status != ExecutionInterrupted {
		l.mu.Unlock()
		if record.Status == ExecutionPrepared || record.Status == ExecutionResuming || record.Status == ExecutionRunning {
			return ExecutionOutcome{Record: record}, ErrAttemptInProgress
		}
		return ExecutionOutcome{Record: record}, ErrAttemptReplay
	}

	now := l.now().UTC()
	if !now.Before(auth.Deadline) || !now.Before(auth.LeaseExpiresAt) {
		record.Status = ExecutionExpired
		record.EndedAt = now
		record.Transitions = append(record.Transitions, ExecutionTransition{
			Status: ExecutionExpired, At: now, Code: "resume-authorization-expired",
		})
		if err := l.persistRecord(recordPath, record); err != nil {
			l.mu.Unlock()
			return ExecutionOutcome{}, err
		}
		l.mu.Unlock()
		return ExecutionOutcome{Record: record}, fmt.Errorf("%w: resume authorization expired", ErrInvalidExecutionAuthorization)
	}

	artifact, err := l.openVerifiedArtifact(auth, plan.Artifact)
	if err != nil {
		l.mu.Unlock()
		return ExecutionOutcome{}, err
	}
	checkpoint, err := checkpoints.LoadLatest(ctx, plan.AuthorizationRef)
	if err != nil {
		_ = artifact.Close()
		l.mu.Unlock()
		return ExecutionOutcome{}, err
	}
	if !strings.EqualFold(checkpoint.Metadata.AttemptRef, auth.AttemptRef) ||
		checkpoint.Metadata.AttemptNonce != auth.AttemptNonce ||
		checkpoint.Metadata.WorkUnitSHA256 != auth.WorkUnitSHA256 {
		_ = artifact.Close()
		l.mu.Unlock()
		return ExecutionOutcome{}, fmt.Errorf("%w: checkpoint attempt binding mismatch", ErrInvalidExecutionAuthorization)
	}
	checkpointFile, err := checkpoints.OpenVerified(checkpoint)
	if err != nil {
		_ = artifact.Close()
		l.mu.Unlock()
		return ExecutionOutcome{}, err
	}
	resumeInput, err := NewResumeInput(
		artifact, auth.WorkUnitSize,
		checkpointFile, checkpoint.Metadata.SizeBytes,
	)
	if err != nil {
		_ = artifact.Close()
		_ = checkpointFile.Close()
		l.mu.Unlock()
		return ExecutionOutcome{}, err
	}

	record.Status = ExecutionResuming
	record.EndedAt = time.Time{}
	record.ResumeCheckpointCommitment = checkpoint.Metadata.CheckpointCommitment
	record.Transitions = append(record.Transitions, ExecutionTransition{
		Status: ExecutionResuming, At: now, Code: fmt.Sprintf("checkpoint-%d", checkpoint.Metadata.Sequence),
	})
	if err := l.persistRecord(recordPath, record); err != nil {
		_ = artifact.Close()
		_ = checkpointFile.Close()
		l.mu.Unlock()
		return ExecutionOutcome{}, err
	}
	record.Status = ExecutionRunning
	record.StartedAt = l.now().UTC()
	record.Transitions = append(record.Transitions, ExecutionTransition{
		Status: ExecutionRunning, At: record.StartedAt, Code: "resume-running",
	})
	if err := l.persistRecord(recordPath, record); err != nil {
		_ = artifact.Close()
		_ = checkpointFile.Close()
		l.mu.Unlock()
		return ExecutionOutcome{}, err
	}
	l.mu.Unlock()
	defer artifact.Close()
	defer checkpointFile.Close()

	executionDeadline := auth.Deadline
	if auth.LeaseExpiresAt.Before(executionDeadline) {
		executionDeadline = auth.LeaseExpiresAt
	}
	runCtx, cancel := context.WithDeadline(ctx, executionDeadline)
	defer cancel()

	sandboxResult, runErr := l.sandbox.RunWithInput(runCtx, plan.Sandbox, resumeInput)
	ended := l.now().UTC()
	record.EndedAt = ended
	record.ExitCode = sandboxResult.ExitCode
	record.TimedOut = sandboxResult.TimedOut
	record.OutputTruncated = sandboxResult.OutputTruncated
	record.StdoutSHA256 = sandboxResult.StdoutSHA256
	record.StdoutBytes = sandboxResult.StdoutBytes

	switch {
	case errors.Is(runCtx.Err(), context.DeadlineExceeded):
		record.Status = ExecutionExpired
		record.Transitions = append(record.Transitions, ExecutionTransition{Status: ExecutionExpired, At: ended, Code: "resume-lease-or-deadline"})
	case errors.Is(runCtx.Err(), context.Canceled):
		record.Status = ExecutionCancelled
		record.Transitions = append(record.Transitions, ExecutionTransition{Status: ExecutionCancelled, At: ended, Code: "resume-context-cancelled"})
	case runErr != nil:
		record.Status = ExecutionFailed
		record.Transitions = append(record.Transitions, ExecutionTransition{Status: ExecutionFailed, At: ended, Code: "resume-sandbox-failed"})
	default:
		record.Status = ExecutionExited
		record.Transitions = append(record.Transitions, ExecutionTransition{Status: ExecutionExited, At: ended, Code: "resume-process-exited"})
	}
	if err := l.persistRecord(recordPath, record); err != nil {
		return ExecutionOutcome{}, err
	}
	outcome := ExecutionOutcome{Record: record, Sandbox: sandboxResult}
	if runErr != nil {
		return outcome, runErr
	}
	if record.Status != ExecutionExited {
		return outcome, fmt.Errorf("resumed execution ended with local status %s", record.Status)
	}
	return outcome, nil
}

func (l *ExecutionLifecycle) validatePlan(auth ExecutionAuthorization, plan ExecutionPlan) error {
	if err := ValidateExecutionAuthorization(auth); err != nil {
		return err
	}
	id := l.config.Identity
	if auth.ChainID != id.ChainID ||
		!strings.EqualFold(auth.ProviderID, id.ProviderID) ||
		!strings.EqualFold(auth.NodeID, id.NodeID) ||
		!strings.EqualFold(auth.ResourceID, id.ResourceID) ||
		!strings.EqualFold(auth.WorkerID, id.WorkerID) {
		return fmt.Errorf("%w: worker identity mismatch", ErrInvalidExecutionAuthorization)
	}
	if !strings.EqualFold(auth.AuthorizationRef, plan.AuthorizationRef) {
		return fmt.Errorf("%w: authorization reference mismatch", ErrInvalidExecutionAuthorization)
	}
	if plan.Artifact.SchemaVersion != WorkUnitDownloadSchemaV1 ||
		plan.Artifact.SHA256 != auth.WorkUnitSHA256 ||
		plan.Artifact.SizeBytes != auth.WorkUnitSize {
		return fmt.Errorf("%w: work-unit commitment mismatch", ErrInvalidExecutionAuthorization)
	}
	if plan.Sandbox.Image != auth.SandboxImage {
		return fmt.Errorf("%w: sandbox image mismatch", ErrInvalidExecutionAuthorization)
	}
	commandHash, err := CommandSHA256(plan.Sandbox.Command)
	if err != nil || commandHash != auth.CommandSHA256 {
		return fmt.Errorf("%w: command commitment mismatch", ErrInvalidExecutionAuthorization)
	}
	return nil
}

func (l *ExecutionLifecycle) openVerifiedArtifact(auth ExecutionAuthorization, artifact WorkUnitArtifact) (*os.File, error) {
	expected := filepath.Join(l.stateRoot, "work-units", "sha256", auth.WorkUnitSHA256+".bin")
	actual, err := filepath.Abs(filepath.Clean(artifact.Path))
	if err != nil || actual != expected {
		return nil, fmt.Errorf("%w: artifact path is not canonical worker state", ErrInvalidExecutionAuthorization)
	}
	info, err := os.Lstat(actual)
	if err != nil || !info.Mode().IsRegular() || info.Mode()&os.ModeSymlink != 0 || uint64(info.Size()) != auth.WorkUnitSize {
		return nil, fmt.Errorf("%w: artifact metadata mismatch", ErrInvalidExecutionAuthorization)
	}
	file, err := os.Open(actual)
	if err != nil {
		return nil, err
	}
	hasher := sha256.New()
	written, err := io.Copy(hasher, io.LimitReader(file, int64(auth.WorkUnitSize)+1))
	if err != nil || uint64(written) != auth.WorkUnitSize || hex.EncodeToString(hasher.Sum(nil)) != auth.WorkUnitSHA256 {
		_ = file.Close()
		return nil, fmt.Errorf("%w: artifact integrity changed after download", ErrInvalidExecutionAuthorization)
	}
	if _, err := file.Seek(0, io.SeekStart); err != nil {
		_ = file.Close()
		return nil, err
	}
	return file, nil
}

func (l *ExecutionLifecycle) newRecord(auth ExecutionAuthorization, status ExecutionStatus, at time.Time, code string) ExecutionRecord {
	executionCommitment, _ := commitment(auth)
	record := ExecutionRecord{
		SchemaVersion: ExecutionRecordSchemaV1,
		AuthorizationRef: auth.AuthorizationRef,
		ExecutionCommitment: executionCommitment,
		JobID: auth.JobID,
		UnitID: auth.UnitID,
		AttemptRef: auth.AttemptRef,
		AttemptNonce: auth.AttemptNonce,
		WorkerID: auth.WorkerID,
		ResourceID: auth.ResourceID,
		WorkUnitSHA256: auth.WorkUnitSHA256,
		SandboxImage: auth.SandboxImage,
		CommandSHA256: auth.CommandSHA256,
		Status: status,
		Transitions: []ExecutionTransition{{Status: status, At: at, Code: code}},
	}
	return record
}

func (l *ExecutionLifecycle) recordPath(attemptRef string) string {
	return filepath.Join(l.attempts, strings.ToLower(strings.TrimPrefix(attemptRef, "0x"))+".json")
}

func (l *ExecutionLifecycle) persistRecord(path string, record ExecutionRecord) error {
	payload, err := json.MarshalIndent(record, "", "  ")
	if err != nil {
		return err
	}
	tmp, err := os.CreateTemp(l.attempts, ".attempt-*")
	if err != nil {
		return err
	}
	name := tmp.Name()
	cleanup := func() {
		_ = tmp.Close()
		_ = os.Remove(name)
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
		_ = os.Remove(name)
		return err
	}
	if err := os.Rename(name, path); err != nil {
		_ = os.Remove(name)
		return err
	}
	dir, err := os.Open(l.attempts)
	if err != nil {
		return err
	}
	defer dir.Close()
	return dir.Sync()
}

func (l *ExecutionLifecycle) readRecord(path string) (ExecutionRecord, error) {
	info, err := os.Lstat(path)
	if err != nil {
		return ExecutionRecord{}, err
	}
	if !info.Mode().IsRegular() || info.Mode()&os.ModeSymlink != 0 || info.Mode().Perm()&0o077 != 0 {
		return ExecutionRecord{}, fmt.Errorf("%w: invalid attempt record file", ErrInvalidExecutionAuthorization)
	}
	payload, err := os.ReadFile(path)
	if err != nil {
		return ExecutionRecord{}, err
	}
	var record ExecutionRecord
	if err := json.Unmarshal(payload, &record); err != nil {
		return ExecutionRecord{}, err
	}
	if record.SchemaVersion != ExecutionRecordSchemaV1 {
		return ExecutionRecord{}, fmt.Errorf("%w: invalid attempt record schema", ErrInvalidExecutionAuthorization)
	}
	if err := validateBytes32("attempt ref", record.AttemptRef); err != nil {
		return ExecutionRecord{}, fmt.Errorf("%w: invalid attempt record identity", ErrInvalidExecutionAuthorization)
	}
	expectedName := strings.ToLower(strings.TrimPrefix(record.AttemptRef, "0x")) + ".json"
	if filepath.Base(path) != expectedName {
		return ExecutionRecord{}, fmt.Errorf("%w: attempt record filename mismatch", ErrInvalidExecutionAuthorization)
	}
	return record, nil
}

func (l *ExecutionLifecycle) recoverInterrupted() error {
	entries, err := os.ReadDir(l.attempts)
	if err != nil {
		return err
	}
	now := l.now().UTC()
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".json") {
			continue
		}
		path := filepath.Join(l.attempts, entry.Name())
		record, err := l.readRecord(path)
		if err != nil {
			return err
		}
		if record.Status != ExecutionPrepared && record.Status != ExecutionResuming && record.Status != ExecutionRunning {
			continue
		}
		record.Status = ExecutionInterrupted
		record.EndedAt = now
		record.Transitions = append(record.Transitions, ExecutionTransition{
			Status: ExecutionInterrupted, At: now, Code: "worker-restart",
		})
		if err := l.persistRecord(path, record); err != nil {
			return err
		}
	}
	return nil
}

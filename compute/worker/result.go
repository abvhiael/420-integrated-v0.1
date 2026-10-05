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
	ResultMaterialSchemaV1 = "420-compute-worker-result-material-v1"
	ResultMaterialDomainV1 = "420/COMPUTE/WORKER_LOCAL_RESULT/V1"
)

var (
	ErrInvalidResultMaterial = errors.New("invalid compute worker result material")
	ErrConflictingResult     = errors.New("conflicting compute worker result material")
)

type ResultMaterial struct {
	SchemaVersion              string    `json:"schemaVersion"`
	Domain                     string    `json:"domain"`
	HashAlgorithm              string    `json:"hashAlgorithm"`
	AuthorizationRef           string    `json:"authorizationRef"`
	AuthorizationCommitment    string    `json:"authorizationCommitment"`
	ExecutionCommitment        string    `json:"executionCommitment"`
	ChainID                    uint64    `json:"chainId"`
	JobID                      string    `json:"jobId"`
	UnitID                     string    `json:"unitId"`
	RootAssignmentRef          string    `json:"rootAssignmentRef"`
	AttemptRef                 string    `json:"attemptRef"`
	AttemptNonce               uint64    `json:"attemptNonce"`
	ProviderID                 string    `json:"providerId"`
	NodeID                     string    `json:"nodeId"`
	ResourceID                 string    `json:"resourceId"`
	WorkerID                   string    `json:"workerId"`
	ManifestHash               string    `json:"manifestHash"`
	ConstraintCommitment       string    `json:"constraintCommitment"`
	WorkUnitSHA256             string    `json:"workUnitSha256"`
	SandboxImage               string    `json:"sandboxImage"`
	CommandSHA256              string    `json:"commandSha256"`
	ResumeCheckpointCommitment string    `json:"resumeCheckpointCommitment,omitempty"`
	OutputSHA256               string    `json:"outputSha256"`
	OutputBytes                uint64    `json:"outputBytes"`
	ExitCode                   int       `json:"exitCode"`
	ExecutionStartedAt         time.Time `json:"executionStartedAt"`
	ExecutionEndedAt           time.Time `json:"executionEndedAt"`
	Authoritative              bool      `json:"authoritative"`
	Signed                     bool      `json:"signed"`
	ResultCorrectnessEvidence  bool      `json:"resultCorrectnessEvidence"`
	CanonicalResultCommitted   bool      `json:"canonicalResultCommitted"`
	ResultCommitment           string    `json:"resultCommitment"`
}

type resultMaterialPreimage struct {
	SchemaVersion              string    `json:"schemaVersion"`
	Domain                     string    `json:"domain"`
	HashAlgorithm              string    `json:"hashAlgorithm"`
	AuthorizationCommitment    string    `json:"authorizationCommitment"`
	ExecutionCommitment        string    `json:"executionCommitment"`
	ChainID                    uint64    `json:"chainId"`
	JobID                      string    `json:"jobId"`
	UnitID                     string    `json:"unitId"`
	RootAssignmentRef          string    `json:"rootAssignmentRef"`
	AttemptRef                 string    `json:"attemptRef"`
	AttemptNonce               uint64    `json:"attemptNonce"`
	ProviderID                 string    `json:"providerId"`
	NodeID                     string    `json:"nodeId"`
	ResourceID                 string    `json:"resourceId"`
	WorkerID                   string    `json:"workerId"`
	ManifestHash               string    `json:"manifestHash"`
	ConstraintCommitment       string    `json:"constraintCommitment"`
	WorkUnitSHA256             string    `json:"workUnitSha256"`
	SandboxImage               string    `json:"sandboxImage"`
	CommandSHA256              string    `json:"commandSha256"`
	ResumeCheckpointCommitment string    `json:"resumeCheckpointCommitment,omitempty"`
	OutputSHA256               string    `json:"outputSha256"`
	OutputBytes                uint64    `json:"outputBytes"`
	ExitCode                   int       `json:"exitCode"`
	ExecutionStartedAt         time.Time `json:"executionStartedAt"`
	ExecutionEndedAt           time.Time `json:"executionEndedAt"`
}

type ResultStore struct {
	config    Config
	root      string
	authority CanonicalExecutionAuthority
	mu        sync.Mutex
}

func NewResultStore(config Config, authority CanonicalExecutionAuthority) (*ResultStore, error) {
	if authority == nil {
		return nil, fmt.Errorf("%w: canonical authority required", ErrInvalidResultMaterial)
	}
	stateRoot, err := config.PrepareStateDir()
	if err != nil {
		return nil, err
	}
	root := filepath.Join(stateRoot, "results")
	if err := os.MkdirAll(root, 0o700); err != nil {
		return nil, err
	}
	if err := os.Chmod(root, 0o700); err != nil {
		return nil, err
	}
	return &ResultStore{config: config, root: root, authority: authority}, nil
}

func (s *ResultStore) Commit(ctx context.Context, outcome ExecutionOutcome) (ResultMaterial, error) {
	if s == nil || s.authority == nil {
		return ResultMaterial{}, ErrInvalidResultMaterial
	}
	candidate := outcome.Record
	if candidate.SchemaVersion != ExecutionRecordSchemaV1 ||
		candidate.Status != ExecutionExited ||
		candidate.AttemptRef == "" ||
		candidate.AuthorizationRef == "" {
		return ResultMaterial{}, fmt.Errorf("%w: execution is not a successful exited attempt", ErrInvalidResultMaterial)
	}
	recordPath := filepath.Join(s.config.StateDir, "attempts", strings.ToLower(strings.TrimPrefix(candidate.AttemptRef, "0x"))+".json")
	recordPath, err := filepath.Abs(filepath.Clean(recordPath))
	if err != nil {
		return ResultMaterial{}, err
	}
	info, err := os.Lstat(recordPath)
	if err != nil || !info.Mode().IsRegular() || info.Mode()&os.ModeSymlink != 0 || info.Mode().Perm()&0o077 != 0 {
		return ResultMaterial{}, fmt.Errorf("%w: durable execution record missing", ErrInvalidResultMaterial)
	}
	payload, err := os.ReadFile(recordPath)
	if err != nil {
		return ResultMaterial{}, err
	}
	var record ExecutionRecord
	if err := json.Unmarshal(payload, &record); err != nil {
		return ResultMaterial{}, err
	}
	if record.SchemaVersion != ExecutionRecordSchemaV1 ||
		record.Status != ExecutionExited ||
		record.ExitCode != 0 ||
		record.TimedOut ||
		record.AttemptRef != candidate.AttemptRef ||
		record.AuthorizationRef != candidate.AuthorizationRef ||
		!sha256HexPattern.MatchString(record.StdoutSHA256) {
		return ResultMaterial{}, fmt.Errorf("%w: durable execution is not a successful committed attempt", ErrInvalidResultMaterial)
	}
	if outcome.Sandbox.SchemaVersion != SandboxSchemaV1 ||
		outcome.Sandbox.StdoutSHA256 != record.StdoutSHA256 ||
		outcome.Sandbox.StdoutBytes != record.StdoutBytes {
		return ResultMaterial{}, fmt.Errorf("%w: in-memory sandbox output does not match durable record", ErrInvalidResultMaterial)
	}
	if record.StartedAt.IsZero() || record.EndedAt.IsZero() || record.EndedAt.Before(record.StartedAt) {
		return ResultMaterial{}, fmt.Errorf("%w: execution timestamps invalid", ErrInvalidResultMaterial)
	}
	auth, err := s.authority.ResolveExecutionAuthorization(ctx, record.AuthorizationRef)
	if err != nil {
		return ResultMaterial{}, fmt.Errorf("%w: resolve canonical authorization: %v", ErrInvalidResultMaterial, err)
	}
	if err := ValidateExecutionAuthorization(auth); err != nil {
		return ResultMaterial{}, fmt.Errorf("%w: %v", ErrInvalidResultMaterial, err)
	}
	if err := s.validateBindings(auth, record); err != nil {
		return ResultMaterial{}, err
	}

	authCommitment, err := commitment(auth)
	if err != nil {
		return ResultMaterial{}, err
	}
	expectedExecutionCommitment, err := commitment(auth)
	if err != nil {
		return ResultMaterial{}, err
	}
	if record.ExecutionCommitment != expectedExecutionCommitment {
		return ResultMaterial{}, fmt.Errorf("%w: execution commitment mismatch", ErrInvalidResultMaterial)
	}
	if record.ResumeCheckpointCommitment != "" &&
		(len(record.ResumeCheckpointCommitment) != 66 || !strings.HasPrefix(record.ResumeCheckpointCommitment, "0x")) {
		return ResultMaterial{}, fmt.Errorf("%w: malformed resume checkpoint commitment", ErrInvalidResultMaterial)
	}

	preimage := resultMaterialPreimage{
		SchemaVersion: ResultMaterialSchemaV1,
		Domain: ResultMaterialDomainV1,
		HashAlgorithm: CommitmentAlgorithmV1,
		AuthorizationCommitment: authCommitment,
		ExecutionCommitment: record.ExecutionCommitment,
		ChainID: auth.ChainID,
		JobID: auth.JobID,
		UnitID: auth.UnitID,
		RootAssignmentRef: auth.RootAssignmentRef,
		AttemptRef: auth.AttemptRef,
		AttemptNonce: auth.AttemptNonce,
		ProviderID: auth.ProviderID,
		NodeID: auth.NodeID,
		ResourceID: auth.ResourceID,
		WorkerID: auth.WorkerID,
		ManifestHash: auth.ManifestHash,
		ConstraintCommitment: auth.ConstraintCommitment,
		WorkUnitSHA256: auth.WorkUnitSHA256,
		SandboxImage: auth.SandboxImage,
		CommandSHA256: auth.CommandSHA256,
		ResumeCheckpointCommitment: record.ResumeCheckpointCommitment,
		OutputSHA256: record.StdoutSHA256,
		OutputBytes: record.StdoutBytes,
		ExitCode: record.ExitCode,
		ExecutionStartedAt: record.StartedAt.UTC(),
		ExecutionEndedAt: record.EndedAt.UTC(),
	}
	resultCommitment, err := commitment(preimage)
	if err != nil {
		return ResultMaterial{}, err
	}
	material := ResultMaterial{
		SchemaVersion: preimage.SchemaVersion,
		Domain: preimage.Domain,
		HashAlgorithm: preimage.HashAlgorithm,
		AuthorizationRef: auth.AuthorizationRef,
		AuthorizationCommitment: preimage.AuthorizationCommitment,
		ExecutionCommitment: preimage.ExecutionCommitment,
		ChainID: preimage.ChainID,
		JobID: preimage.JobID,
		UnitID: preimage.UnitID,
		RootAssignmentRef: preimage.RootAssignmentRef,
		AttemptRef: preimage.AttemptRef,
		AttemptNonce: preimage.AttemptNonce,
		ProviderID: preimage.ProviderID,
		NodeID: preimage.NodeID,
		ResourceID: preimage.ResourceID,
		WorkerID: preimage.WorkerID,
		ManifestHash: preimage.ManifestHash,
		ConstraintCommitment: preimage.ConstraintCommitment,
		WorkUnitSHA256: preimage.WorkUnitSHA256,
		SandboxImage: preimage.SandboxImage,
		CommandSHA256: preimage.CommandSHA256,
		ResumeCheckpointCommitment: preimage.ResumeCheckpointCommitment,
		OutputSHA256: preimage.OutputSHA256,
		OutputBytes: preimage.OutputBytes,
		ExitCode: preimage.ExitCode,
		ExecutionStartedAt: preimage.ExecutionStartedAt,
		ExecutionEndedAt: preimage.ExecutionEndedAt,
		Authoritative: false,
		Signed: false,
		ResultCorrectnessEvidence: false,
		CanonicalResultCommitted: false,
		ResultCommitment: resultCommitment,
	}

	s.mu.Lock()
	defer s.mu.Unlock()
	path := s.resultPath(auth.AttemptRef)
	if existing, err := s.read(path); err == nil {
		if existing.ResultCommitment == material.ResultCommitment {
			return existing, nil
		}
		return ResultMaterial{}, ErrConflictingResult
	} else if !errors.Is(err, os.ErrNotExist) {
		return ResultMaterial{}, err
	}
	if err := s.persist(path, material); err != nil {
		return ResultMaterial{}, err
	}
	return material, nil
}

func (s *ResultStore) Load(ctx context.Context, authorizationRef string) (ResultMaterial, error) {
	if s == nil || s.authority == nil {
		return ResultMaterial{}, ErrInvalidResultMaterial
	}
	auth, err := s.authority.ResolveExecutionAuthorization(ctx, authorizationRef)
	if err != nil {
		return ResultMaterial{}, fmt.Errorf("%w: resolve canonical authorization: %v", ErrInvalidResultMaterial, err)
	}
	if err := ValidateExecutionAuthorization(auth); err != nil {
		return ResultMaterial{}, err
	}
	material, err := s.read(s.resultPath(auth.AttemptRef))
	if err != nil {
		return ResultMaterial{}, err
	}
	if err := VerifyResultMaterial(auth, material); err != nil {
		return ResultMaterial{}, err
	}
	return material, nil
}

func VerifyResultMaterial(auth ExecutionAuthorization, material ResultMaterial) error {
	if err := ValidateExecutionAuthorization(auth); err != nil {
		return err
	}
	if material.SchemaVersion != ResultMaterialSchemaV1 ||
		material.Domain != ResultMaterialDomainV1 ||
		material.HashAlgorithm != CommitmentAlgorithmV1 ||
		material.Authoritative ||
		material.Signed ||
		material.ResultCorrectnessEvidence ||
		material.CanonicalResultCommitted ||
		material.ExitCode != 0 ||
		!sha256HexPattern.MatchString(material.OutputSHA256) {
		return ErrInvalidResultMaterial
	}
	authCommitment, err := commitment(auth)
	if err != nil {
		return err
	}
	expectedExecutionCommitment, err := commitment(auth)
	if err != nil {
		return err
	}
	if material.AuthorizationRef != auth.AuthorizationRef ||
		material.AuthorizationCommitment != authCommitment ||
		material.ExecutionCommitment != expectedExecutionCommitment ||
		material.ChainID != auth.ChainID ||
		material.JobID != auth.JobID ||
		material.UnitID != auth.UnitID ||
		material.RootAssignmentRef != auth.RootAssignmentRef ||
		material.AttemptRef != auth.AttemptRef ||
		material.AttemptNonce != auth.AttemptNonce ||
		material.ProviderID != auth.ProviderID ||
		material.NodeID != auth.NodeID ||
		material.ResourceID != auth.ResourceID ||
		material.WorkerID != auth.WorkerID ||
		material.ManifestHash != auth.ManifestHash ||
		material.ConstraintCommitment != auth.ConstraintCommitment ||
		material.WorkUnitSHA256 != auth.WorkUnitSHA256 ||
		material.SandboxImage != auth.SandboxImage ||
		material.CommandSHA256 != auth.CommandSHA256 ||
		material.ExecutionStartedAt.IsZero() ||
		material.ExecutionEndedAt.IsZero() ||
		material.ExecutionEndedAt.Before(material.ExecutionStartedAt) {
		return fmt.Errorf("%w: result binding mismatch", ErrInvalidResultMaterial)
	}
	preimage := resultMaterialPreimage{
		SchemaVersion: material.SchemaVersion,
		Domain: material.Domain,
		HashAlgorithm: material.HashAlgorithm,
		AuthorizationCommitment: material.AuthorizationCommitment,
		ExecutionCommitment: material.ExecutionCommitment,
		ChainID: material.ChainID,
		JobID: material.JobID,
		UnitID: material.UnitID,
		RootAssignmentRef: material.RootAssignmentRef,
		AttemptRef: material.AttemptRef,
		AttemptNonce: material.AttemptNonce,
		ProviderID: material.ProviderID,
		NodeID: material.NodeID,
		ResourceID: material.ResourceID,
		WorkerID: material.WorkerID,
		ManifestHash: material.ManifestHash,
		ConstraintCommitment: material.ConstraintCommitment,
		WorkUnitSHA256: material.WorkUnitSHA256,
		SandboxImage: material.SandboxImage,
		CommandSHA256: material.CommandSHA256,
		ResumeCheckpointCommitment: material.ResumeCheckpointCommitment,
		OutputSHA256: material.OutputSHA256,
		OutputBytes: material.OutputBytes,
		ExitCode: material.ExitCode,
		ExecutionStartedAt: material.ExecutionStartedAt,
		ExecutionEndedAt: material.ExecutionEndedAt,
	}
	expected, err := commitment(preimage)
	if err != nil || expected != material.ResultCommitment {
		return fmt.Errorf("%w: result commitment mismatch", ErrInvalidResultMaterial)
	}
	return nil
}

func (s *ResultStore) validateBindings(auth ExecutionAuthorization, record ExecutionRecord) error {
	id := s.config.Identity
	if auth.ChainID != id.ChainID ||
		auth.ProviderID != id.ProviderID ||
		auth.NodeID != id.NodeID ||
		auth.ResourceID != id.ResourceID ||
		auth.WorkerID != id.WorkerID ||
		record.AuthorizationRef != auth.AuthorizationRef ||
		record.JobID != auth.JobID ||
		record.UnitID != auth.UnitID ||
		record.AttemptRef != auth.AttemptRef ||
		record.AttemptNonce != auth.AttemptNonce ||
		record.WorkerID != auth.WorkerID ||
		record.ResourceID != auth.ResourceID ||
		record.WorkUnitSHA256 != auth.WorkUnitSHA256 ||
		record.SandboxImage != auth.SandboxImage ||
		record.CommandSHA256 != auth.CommandSHA256 {
		return fmt.Errorf("%w: execution/result binding mismatch", ErrInvalidResultMaterial)
	}
	return nil
}

func (s *ResultStore) resultPath(attemptRef string) string {
	return filepath.Join(s.root, strings.ToLower(strings.TrimPrefix(attemptRef, "0x"))+".json")
}

func (s *ResultStore) persist(path string, material ResultMaterial) error {
	payload, err := json.MarshalIndent(material, "", "  ")
	if err != nil {
		return err
	}
	tmp, err := os.CreateTemp(s.root, ".result-*")
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
	return syncDirectory(s.root)
}

func (s *ResultStore) read(path string) (ResultMaterial, error) {
	info, err := os.Lstat(path)
	if err != nil {
		return ResultMaterial{}, err
	}
	if !info.Mode().IsRegular() || info.Mode()&os.ModeSymlink != 0 || info.Mode().Perm()&0o077 != 0 {
		return ResultMaterial{}, ErrInvalidResultMaterial
	}
	payload, err := os.ReadFile(path)
	if err != nil {
		return ResultMaterial{}, err
	}
	var material ResultMaterial
	if err := json.Unmarshal(payload, &material); err != nil {
		return ResultMaterial{}, err
	}
	if err := validateBytes32("attempt ref", material.AttemptRef); err != nil {
		return ResultMaterial{}, ErrInvalidResultMaterial
	}
	expectedName := strings.ToLower(strings.TrimPrefix(material.AttemptRef, "0x")) + ".json"
	if filepath.Base(path) != expectedName {
		return ResultMaterial{}, ErrInvalidResultMaterial
	}
	return material, nil
}

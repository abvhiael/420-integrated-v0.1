package worker

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/binary"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"
)

const (
	CheckpointSchemaV1      = "420-compute-worker-checkpoint-v1"
	ResumeInputMagicV1      = "CMP420R1"
	DefaultCheckpointMaxBytes = uint64(256 << 20)
)

var (
	ErrInvalidCheckpoint = errors.New("invalid compute worker checkpoint")
	ErrCheckpointReplay  = errors.New("compute worker checkpoint sequence replay")
)

type CheckpointMetadata struct {
	SchemaVersion           string    `json:"schemaVersion"`
	AuthorizationRef        string    `json:"authorizationRef"`
	AuthorizationCommitment string    `json:"authorizationCommitment"`
	AttemptRef              string    `json:"attemptRef"`
	AttemptNonce            uint64    `json:"attemptNonce"`
	WorkUnitSHA256          string    `json:"workUnitSha256"`
	Sequence                uint64    `json:"sequence"`
	PayloadSHA256           string    `json:"payloadSha256"`
	SizeBytes               uint64    `json:"sizeBytes"`
	CreatedAt               time.Time `json:"createdAt"`
	CheckpointCommitment    string    `json:"checkpointCommitment"`
}

type checkpointPreimage struct {
	SchemaVersion           string    `json:"schemaVersion"`
	AuthorizationCommitment string    `json:"authorizationCommitment"`
	AttemptRef              string    `json:"attemptRef"`
	AttemptNonce            uint64    `json:"attemptNonce"`
	WorkUnitSHA256          string    `json:"workUnitSha256"`
	Sequence                uint64    `json:"sequence"`
	PayloadSHA256           string    `json:"payloadSha256"`
	SizeBytes               uint64    `json:"sizeBytes"`
	CreatedAt               time.Time `json:"createdAt"`
}

type Checkpoint struct {
	Metadata CheckpointMetadata
	Path     string
}

type CheckpointStore struct {
	config    Config
	root      string
	authority CanonicalExecutionAuthority
	maxBytes  uint64
	now       func() time.Time
	mu        sync.Mutex
}

func NewCheckpointStore(config Config, authority CanonicalExecutionAuthority, maxBytes uint64) (*CheckpointStore, error) {
	if authority == nil {
		return nil, fmt.Errorf("%w: canonical authority required", ErrInvalidCheckpoint)
	}
	stateRoot, err := config.PrepareStateDir()
	if err != nil {
		return nil, err
	}
	if maxBytes == 0 {
		maxBytes = DefaultCheckpointMaxBytes
	}
	root := filepath.Join(stateRoot, "checkpoints")
	if err := os.MkdirAll(root, 0o700); err != nil {
		return nil, err
	}
	if err := os.Chmod(root, 0o700); err != nil {
		return nil, err
	}
	return &CheckpointStore{
		config: config,
		root: root,
		authority: authority,
		maxBytes: maxBytes,
		now: time.Now,
	}, nil
}

func (s *CheckpointStore) Save(
	ctx context.Context,
	authorizationRef string,
	sequence uint64,
	payload io.Reader,
) (Checkpoint, error) {
	if s == nil || s.authority == nil || payload == nil || sequence == 0 {
		return Checkpoint{}, ErrInvalidCheckpoint
	}
	auth, err := s.resolve(ctx, authorizationRef)
	if err != nil {
		return Checkpoint{}, err
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	attemptDir, err := s.attemptDir(auth.AttemptRef)
	if err != nil {
		return Checkpoint{}, err
	}
	latest, found, err := s.readLatest(attemptDir)
	if err != nil {
		return Checkpoint{}, err
	}
	if found && sequence <= latest.Sequence {
		return Checkpoint{}, ErrCheckpointReplay
	}
	if found && sequence != latest.Sequence+1 {
		return Checkpoint{}, fmt.Errorf("%w: checkpoint sequence must advance exactly once", ErrInvalidCheckpoint)
	}
	if !found && sequence != 1 {
		return Checkpoint{}, fmt.Errorf("%w: first checkpoint sequence must be one", ErrInvalidCheckpoint)
	}

	tmp, err := os.CreateTemp(attemptDir, ".checkpoint-payload-*")
	if err != nil {
		return Checkpoint{}, err
	}
	tmpName := tmp.Name()
	cleanup := func() {
		_ = tmp.Close()
		_ = os.Remove(tmpName)
	}
	if err := tmp.Chmod(0o600); err != nil {
		cleanup()
		return Checkpoint{}, err
	}

	hasher := sha256.New()
	limited := io.LimitReader(payload, int64(s.maxBytes)+1)
	written, err := io.Copy(io.MultiWriter(tmp, hasher), limited)
	if err != nil {
		cleanup()
		return Checkpoint{}, err
	}
	if err := ctx.Err(); err != nil {
		cleanup()
		return Checkpoint{}, err
	}
	if written <= 0 || uint64(written) > s.maxBytes {
		cleanup()
		return Checkpoint{}, fmt.Errorf("%w: checkpoint size out of bounds", ErrInvalidCheckpoint)
	}
	if err := tmp.Sync(); err != nil {
		cleanup()
		return Checkpoint{}, err
	}
	if err := tmp.Close(); err != nil {
		_ = os.Remove(tmpName)
		return Checkpoint{}, err
	}

	authCommitment, err := commitment(auth)
	if err != nil {
		_ = os.Remove(tmpName)
		return Checkpoint{}, err
	}
	createdAt := s.now().UTC()
	meta := CheckpointMetadata{
		SchemaVersion: CheckpointSchemaV1,
		AuthorizationRef: auth.AuthorizationRef,
		AuthorizationCommitment: authCommitment,
		AttemptRef: auth.AttemptRef,
		AttemptNonce: auth.AttemptNonce,
		WorkUnitSHA256: auth.WorkUnitSHA256,
		Sequence: sequence,
		PayloadSHA256: hex.EncodeToString(hasher.Sum(nil)),
		SizeBytes: uint64(written),
		CreatedAt: createdAt,
	}
	checkpointCommitment, err := commitment(checkpointPreimage{
		SchemaVersion: meta.SchemaVersion,
		AuthorizationCommitment: meta.AuthorizationCommitment,
		AttemptRef: meta.AttemptRef,
		AttemptNonce: meta.AttemptNonce,
		WorkUnitSHA256: meta.WorkUnitSHA256,
		Sequence: meta.Sequence,
		PayloadSHA256: meta.PayloadSHA256,
		SizeBytes: meta.SizeBytes,
		CreatedAt: meta.CreatedAt,
	})
	if err != nil {
		_ = os.Remove(tmpName)
		return Checkpoint{}, err
	}
	meta.CheckpointCommitment = checkpointCommitment

	payloadPath := filepath.Join(attemptDir, checkpointPayloadName(sequence))
	metaPath := filepath.Join(attemptDir, checkpointMetadataName(sequence))
	if err := os.Rename(tmpName, payloadPath); err != nil {
		_ = os.Remove(tmpName)
		return Checkpoint{}, err
	}
	if err := s.persistJSON(metaPath, meta); err != nil {
		_ = os.Remove(payloadPath)
		return Checkpoint{}, err
	}
	if err := s.persistJSON(filepath.Join(attemptDir, "latest.json"), meta); err != nil {
		_ = os.Remove(payloadPath)
		_ = os.Remove(metaPath)
		return Checkpoint{}, err
	}
	if err := syncDirectory(attemptDir); err != nil {
		return Checkpoint{}, err
	}
	return Checkpoint{Metadata: meta, Path: payloadPath}, nil
}

func (s *CheckpointStore) LoadLatest(ctx context.Context, authorizationRef string) (Checkpoint, error) {
	if s == nil || s.authority == nil {
		return Checkpoint{}, ErrInvalidCheckpoint
	}
	auth, err := s.resolve(ctx, authorizationRef)
	if err != nil {
		return Checkpoint{}, err
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	attemptDir, err := s.attemptDir(auth.AttemptRef)
	if err != nil {
		return Checkpoint{}, err
	}
	meta, found, err := s.readLatest(attemptDir)
	if err != nil {
		return Checkpoint{}, err
	}
	if !found {
		return Checkpoint{}, os.ErrNotExist
	}
	if err := s.validateMetadata(auth, meta); err != nil {
		return Checkpoint{}, err
	}
	payloadPath := filepath.Join(attemptDir, checkpointPayloadName(meta.Sequence))
	if err := verifyPrivateRegularFile(payloadPath, meta.SizeBytes); err != nil {
		return Checkpoint{}, err
	}
	file, err := os.Open(payloadPath)
	if err != nil {
		return Checkpoint{}, err
	}
	defer file.Close()
	hasher := sha256.New()
	written, err := io.Copy(hasher, io.LimitReader(file, int64(meta.SizeBytes)+1))
	if err != nil || uint64(written) != meta.SizeBytes || hex.EncodeToString(hasher.Sum(nil)) != meta.PayloadSHA256 {
		return Checkpoint{}, fmt.Errorf("%w: checkpoint payload integrity mismatch", ErrInvalidCheckpoint)
	}
	return Checkpoint{Metadata: meta, Path: payloadPath}, nil
}

func (s *CheckpointStore) OpenVerified(checkpoint Checkpoint) (*os.File, error) {
	if checkpoint.Metadata.SchemaVersion != CheckpointSchemaV1 {
		return nil, ErrInvalidCheckpoint
	}
	if err := verifyPrivateRegularFile(checkpoint.Path, checkpoint.Metadata.SizeBytes); err != nil {
		return nil, err
	}
	file, err := os.Open(checkpoint.Path)
	if err != nil {
		return nil, err
	}
	hasher := sha256.New()
	written, err := io.Copy(hasher, io.LimitReader(file, int64(checkpoint.Metadata.SizeBytes)+1))
	if err != nil || uint64(written) != checkpoint.Metadata.SizeBytes ||
		hex.EncodeToString(hasher.Sum(nil)) != checkpoint.Metadata.PayloadSHA256 {
		_ = file.Close()
		return nil, fmt.Errorf("%w: checkpoint payload integrity mismatch", ErrInvalidCheckpoint)
	}
	if _, err := file.Seek(0, io.SeekStart); err != nil {
		_ = file.Close()
		return nil, err
	}
	return file, nil
}

func (s *CheckpointStore) resolve(ctx context.Context, authorizationRef string) (ExecutionAuthorization, error) {
	if err := validateBytes32("authorization ref", authorizationRef); err != nil {
		return ExecutionAuthorization{}, fmt.Errorf("%w: %v", ErrInvalidCheckpoint, err)
	}
	auth, err := s.authority.ResolveExecutionAuthorization(ctx, authorizationRef)
	if err != nil {
		return ExecutionAuthorization{}, fmt.Errorf("%w: resolve canonical authorization: %v", ErrInvalidCheckpoint, err)
	}
	if err := ValidateExecutionAuthorization(auth); err != nil {
		return ExecutionAuthorization{}, fmt.Errorf("%w: %v", ErrInvalidCheckpoint, err)
	}
	id := s.config.Identity
	if auth.ChainID != id.ChainID ||
		!strings.EqualFold(auth.ProviderID, id.ProviderID) ||
		!strings.EqualFold(auth.NodeID, id.NodeID) ||
		!strings.EqualFold(auth.ResourceID, id.ResourceID) ||
		!strings.EqualFold(auth.WorkerID, id.WorkerID) {
		return ExecutionAuthorization{}, fmt.Errorf("%w: worker identity mismatch", ErrInvalidCheckpoint)
	}
	now := s.now().UTC()
	if !now.Before(auth.Deadline) || !now.Before(auth.LeaseExpiresAt) {
		return ExecutionAuthorization{}, fmt.Errorf("%w: authorization expired", ErrInvalidCheckpoint)
	}
	return auth, nil
}

func (s *CheckpointStore) validateMetadata(auth ExecutionAuthorization, meta CheckpointMetadata) error {
	if meta.SchemaVersion != CheckpointSchemaV1 || meta.Sequence == 0 || meta.SizeBytes == 0 || meta.SizeBytes > s.maxBytes {
		return ErrInvalidCheckpoint
	}
	authCommitment, err := commitment(auth)
	if err != nil {
		return err
	}
	if !strings.EqualFold(meta.AuthorizationRef, auth.AuthorizationRef) ||
		meta.AuthorizationCommitment != authCommitment ||
		!strings.EqualFold(meta.AttemptRef, auth.AttemptRef) ||
		meta.AttemptNonce != auth.AttemptNonce ||
		meta.WorkUnitSHA256 != auth.WorkUnitSHA256 ||
		!sha256HexPattern.MatchString(meta.PayloadSHA256) ||
		meta.CheckpointCommitment == "" {
		return fmt.Errorf("%w: checkpoint authorization binding mismatch", ErrInvalidCheckpoint)
	}
	expectedCommitment, err := commitment(checkpointPreimage{
		SchemaVersion: meta.SchemaVersion,
		AuthorizationCommitment: meta.AuthorizationCommitment,
		AttemptRef: meta.AttemptRef,
		AttemptNonce: meta.AttemptNonce,
		WorkUnitSHA256: meta.WorkUnitSHA256,
		Sequence: meta.Sequence,
		PayloadSHA256: meta.PayloadSHA256,
		SizeBytes: meta.SizeBytes,
		CreatedAt: meta.CreatedAt,
	})
	if err != nil || expectedCommitment != meta.CheckpointCommitment {
		return fmt.Errorf("%w: checkpoint commitment mismatch", ErrInvalidCheckpoint)
	}
	return nil
}

func (s *CheckpointStore) attemptDir(attemptRef string) (string, error) {
	if err := validateBytes32("attempt ref", attemptRef); err != nil {
		return "", fmt.Errorf("%w: %v", ErrInvalidCheckpoint, err)
	}
	dir := filepath.Join(s.root, strings.ToLower(strings.TrimPrefix(attemptRef, "0x")))
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return "", err
	}
	if err := os.Chmod(dir, 0o700); err != nil {
		return "", err
	}
	return dir, nil
}

func (s *CheckpointStore) readLatest(attemptDir string) (CheckpointMetadata, bool, error) {
	path := filepath.Join(attemptDir, "latest.json")
	info, err := os.Lstat(path)
	if errors.Is(err, os.ErrNotExist) {
		return CheckpointMetadata{}, false, nil
	}
	if err != nil {
		return CheckpointMetadata{}, false, err
	}
	if !info.Mode().IsRegular() || info.Mode()&os.ModeSymlink != 0 || info.Mode().Perm()&0o077 != 0 {
		return CheckpointMetadata{}, false, ErrInvalidCheckpoint
	}
	payload, err := os.ReadFile(path)
	if err != nil {
		return CheckpointMetadata{}, false, err
	}
	var meta CheckpointMetadata
	if err := json.Unmarshal(payload, &meta); err != nil {
		return CheckpointMetadata{}, false, err
	}
	return meta, true, nil
}

func (s *CheckpointStore) persistJSON(path string, value any) error {
	payload, err := json.MarshalIndent(value, "", "  ")
	if err != nil {
		return err
	}
	tmp, err := os.CreateTemp(filepath.Dir(path), ".checkpoint-meta-*")
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
	return nil
}

func checkpointPayloadName(sequence uint64) string {
	return fmt.Sprintf("%020d.bin", sequence)
}

func checkpointMetadataName(sequence uint64) string {
	return fmt.Sprintf("%020d.json", sequence)
}

func verifyPrivateRegularFile(path string, expectedSize uint64) error {
	info, err := os.Lstat(path)
	if err != nil {
		return err
	}
	if !info.Mode().IsRegular() || info.Mode()&os.ModeSymlink != 0 || info.Mode().Perm()&0o077 != 0 ||
		uint64(info.Size()) != expectedSize {
		return ErrInvalidCheckpoint
	}
	return nil
}

func syncDirectory(path string) error {
	dir, err := os.Open(path)
	if err != nil {
		return err
	}
	defer dir.Close()
	return dir.Sync()
}

func NewResumeInput(workUnit io.Reader, workUnitSize uint64, checkpoint io.Reader, checkpointSize uint64) (io.Reader, error) {
	if workUnit == nil || checkpoint == nil || workUnitSize == 0 || checkpointSize == 0 {
		return nil, ErrInvalidCheckpoint
	}
	var header bytes.Buffer
	header.WriteString(ResumeInputMagicV1)
	if err := binary.Write(&header, binary.BigEndian, workUnitSize); err != nil {
		return nil, err
	}
	if err := binary.Write(&header, binary.BigEndian, checkpointSize); err != nil {
		return nil, err
	}
	return io.MultiReader(bytes.NewReader(header.Bytes()), io.LimitReader(workUnit, int64(workUnitSize)), io.LimitReader(checkpoint, int64(checkpointSize))), nil
}

func ParseResumeInput(reader io.Reader, maxWorkUnit, maxCheckpoint uint64) ([]byte, []byte, error) {
	if reader == nil || maxWorkUnit == 0 || maxCheckpoint == 0 {
		return nil, nil, ErrInvalidCheckpoint
	}
	magic := make([]byte, len(ResumeInputMagicV1))
	if _, err := io.ReadFull(reader, magic); err != nil || string(magic) != ResumeInputMagicV1 {
		return nil, nil, ErrInvalidCheckpoint
	}
	var workSize uint64
	var checkpointSize uint64
	if err := binary.Read(reader, binary.BigEndian, &workSize); err != nil {
		return nil, nil, err
	}
	if err := binary.Read(reader, binary.BigEndian, &checkpointSize); err != nil {
		return nil, nil, err
	}
	if workSize == 0 || checkpointSize == 0 || workSize > maxWorkUnit || checkpointSize > maxCheckpoint {
		return nil, nil, ErrInvalidCheckpoint
	}
	work := make([]byte, workSize)
	if _, err := io.ReadFull(reader, work); err != nil {
		return nil, nil, err
	}
	state := make([]byte, checkpointSize)
	if _, err := io.ReadFull(reader, state); err != nil {
		return nil, nil, err
	}
	var extra [1]byte
	if n, _ := reader.Read(extra[:]); n != 0 {
		return nil, nil, ErrInvalidCheckpoint
	}
	return work, state, nil
}

func checkpointSequenceFromName(name string) (uint64, bool) {
	if !strings.HasSuffix(name, ".bin") {
		return 0, false
	}
	value := strings.TrimSuffix(name, ".bin")
	sequence, err := strconv.ParseUint(value, 10, 64)
	return sequence, err == nil && sequence > 0
}

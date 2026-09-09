package storage

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"sync"
	"time"
)

var (
	ErrInvalidShard      = errors.New("invalid shard")
	ErrShardNotFound     = errors.New("shard not found")
	ErrCommitmentMismatch = errors.New("commitment mismatch")
	ErrCapacityExceeded  = errors.New("storage capacity exceeded")
	ErrInactiveAssignment = errors.New("inactive storage assignment")
)

type Assignment struct {
	AgreementID  string
	CommitmentID string
	NodeID       string
	ShardRoot    string
	SizeBytes    uint64
	StartTime    time.Time
	EndTime      time.Time
	Active       bool
}

type Challenge struct {
	AgreementID  string
	CommitmentID string
	ChallengeID  string
	Epoch        time.Time
}

type Proof struct {
	CommitmentID string
	ChallengeID  string
	Epoch        time.Time
	Digest       string
	Payload      []byte
}

type Capacity struct {
	TotalBytes uint64
	UsedBytes  uint64
}

func (c Capacity) AvailableBytes() uint64 {
	if c.UsedBytes >= c.TotalBytes {
		return 0
	}
	return c.TotalBytes - c.UsedBytes
}

type ShardRecord struct {
	AgreementID  string    `json:"agreement_id"`
	CommitmentID string    `json:"commitment_id"`
	ShardRoot    string    `json:"shard_root"`
	SizeBytes    uint64    `json:"size_bytes"`
	StoredAt     time.Time `json:"stored_at"`
}

type Store interface {
	Put(ctx context.Context, rec ShardRecord, src io.Reader) error
	Open(ctx context.Context, commitmentID string) (io.ReadCloser, ShardRecord, error)
	Delete(ctx context.Context, commitmentID string) error
	List(ctx context.Context) ([]ShardRecord, error)
}

type ChainSource interface {
	Assignment(ctx context.Context, commitmentID string) (Assignment, error)
}

type ProofSubmitter interface {
	SubmitProof(ctx context.Context, proof Proof) error
}

type Runtime struct {
	mu        sync.RWMutex
	nodeID    string
	store     Store
	chain     ChainSource
	submitter ProofSubmitter
	capacity  Capacity
}

func NewRuntime(nodeID string, totalBytes uint64, store Store, chain ChainSource, submitter ProofSubmitter) (*Runtime, error) {
	if nodeID == "" || totalBytes == 0 || store == nil || chain == nil {
		return nil, ErrInvalidShard
	}
	r := &Runtime{nodeID: nodeID, store: store, chain: chain, submitter: submitter, capacity: Capacity{TotalBytes: totalBytes}}
	records, err := store.List(context.Background())
	if err != nil {
		return nil, err
	}
	for _, rec := range records {
		if ^uint64(0)-r.capacity.UsedBytes < rec.SizeBytes {
			return nil, ErrCapacityExceeded
		}
		r.capacity.UsedBytes += rec.SizeBytes
	}
	if r.capacity.UsedBytes > totalBytes {
		return nil, ErrCapacityExceeded
	}
	return r, nil
}

func (r *Runtime) Capacity() Capacity {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.capacity
}

func (r *Runtime) StoreShard(ctx context.Context, commitmentID string, src io.Reader) (ShardRecord, error) {
	if commitmentID == "" || src == nil {
		return ShardRecord{}, ErrInvalidShard
	}
	assignment, err := r.chain.Assignment(ctx, commitmentID)
	if err != nil {
		return ShardRecord{}, err
	}
	now := time.Now().UTC()
	if !assignment.Active || assignment.NodeID != r.nodeID || assignment.CommitmentID != commitmentID || now.Before(assignment.StartTime) || now.After(assignment.EndTime) {
		return ShardRecord{}, ErrInactiveAssignment
	}

	buf, err := io.ReadAll(io.LimitReader(src, int64(assignment.SizeBytes)+1))
	if err != nil {
		return ShardRecord{}, err
	}
	if uint64(len(buf)) != assignment.SizeBytes {
		return ShardRecord{}, fmt.Errorf("%w: expected %d bytes, got %d", ErrInvalidShard, assignment.SizeBytes, len(buf))
	}
	digest := sha256.Sum256(buf)
	root := hex.EncodeToString(digest[:])
	if root != assignment.ShardRoot {
		return ShardRecord{}, ErrCommitmentMismatch
	}

	r.mu.Lock()
	if assignment.SizeBytes > r.capacity.AvailableBytes() {
		r.mu.Unlock()
		return ShardRecord{}, ErrCapacityExceeded
	}
	r.mu.Unlock()

	rec := ShardRecord{AgreementID: assignment.AgreementID, CommitmentID: commitmentID, ShardRoot: root, SizeBytes: assignment.SizeBytes, StoredAt: now}
	if err := r.store.Put(ctx, rec, bytesReader(buf)); err != nil {
		return ShardRecord{}, err
	}

	r.mu.Lock()
	r.capacity.UsedBytes += assignment.SizeBytes
	r.mu.Unlock()
	return rec, nil
}

func (r *Runtime) Retrieve(ctx context.Context, commitmentID string, offset, length uint64) ([]byte, ShardRecord, error) {
	rc, rec, err := r.store.Open(ctx, commitmentID)
	if err != nil {
		return nil, ShardRecord{}, err
	}
	defer rc.Close()
	if offset > rec.SizeBytes {
		return nil, ShardRecord{}, ErrInvalidShard
	}
	if _, err := io.CopyN(io.Discard, rc, int64(offset)); err != nil && !errors.Is(err, io.EOF) {
		return nil, ShardRecord{}, err
	}
	remaining := rec.SizeBytes - offset
	if length == 0 || length > remaining {
		length = remaining
	}
	data, err := io.ReadAll(io.LimitReader(rc, int64(length)))
	return data, rec, err
}

func (r *Runtime) BuildProof(ctx context.Context, ch Challenge) (Proof, error) {
	if ch.CommitmentID == "" || ch.ChallengeID == "" {
		return Proof{}, ErrInvalidShard
	}
	rc, rec, err := r.store.Open(ctx, ch.CommitmentID)
	if err != nil {
		return Proof{}, err
	}
	defer rc.Close()
	data, err := io.ReadAll(rc)
	if err != nil {
		return Proof{}, err
	}
	seed := sha256.New()
	seed.Write([]byte(ch.CommitmentID))
	seed.Write([]byte(ch.ChallengeID))
	seed.Write([]byte(ch.Epoch.UTC().Format(time.RFC3339Nano)))
	seed.Write(data)
	digest := hex.EncodeToString(seed.Sum(nil))
	payload := []byte(digest)
	return Proof{CommitmentID: rec.CommitmentID, ChallengeID: ch.ChallengeID, Epoch: ch.Epoch.UTC(), Digest: digest, Payload: payload}, nil
}

func (r *Runtime) Prove(ctx context.Context, ch Challenge) (Proof, error) {
	proof, err := r.BuildProof(ctx, ch)
	if err != nil {
		return Proof{}, err
	}
	if r.submitter == nil {
		return proof, nil
	}
	if err := r.submitter.SubmitProof(ctx, proof); err != nil {
		return Proof{}, err
	}
	return proof, nil
}

func (r *Runtime) Delete(ctx context.Context, commitmentID string) error {
	_, rec, err := r.store.Open(ctx, commitmentID)
	if err != nil {
		return err
	}
	if err := r.store.Delete(ctx, commitmentID); err != nil {
		return err
	}
	r.mu.Lock()
	if rec.SizeBytes <= r.capacity.UsedBytes {
		r.capacity.UsedBytes -= rec.SizeBytes
	} else {
		r.capacity.UsedBytes = 0
	}
	r.mu.Unlock()
	return nil
}

func bytesReader(b []byte) io.Reader { return &sliceReader{b: b} }

type sliceReader struct { b []byte }
func (r *sliceReader) Read(p []byte) (int, error) {
	if len(r.b) == 0 { return 0, io.EOF }
	n := copy(p, r.b)
	r.b = r.b[n:]
	return n, nil
}

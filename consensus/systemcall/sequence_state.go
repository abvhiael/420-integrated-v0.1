package systemcall

import (
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
)

var (
	ErrSequenceStateMissing          = errors.New("system-call sequence state missing")
	ErrSequenceRecoveryRequired      = errors.New("system-call sequence recovery required")
	ErrInvalidSequenceAnchor         = errors.New("invalid system-call sequence anchor")
	ErrSequenceCommitContextMismatch = errors.New("system-call sequence commit context mismatch")
)

type SequenceAnchor struct {
	ChainID        uint64
	ExecutionBlock uint64
	BlockHash      [32]byte
	LastSequence   uint64
}

type SequenceStore interface {
	Load() (SequenceAnchor, bool, error)
	Store(SequenceAnchor) error
}

type FileSequenceStore struct {
	Path string
}

type sequenceFile struct {
	Schema         string `json:"schema"`
	ChainID        uint64 `json:"chainId"`
	ExecutionBlock uint64 `json:"executionBlock"`
	BlockHash      string `json:"blockHash"`
	LastSequence   uint64 `json:"lastSequence"`
}

func (s FileSequenceStore) Load() (SequenceAnchor, bool, error) {
	if s.Path == "" {
		return SequenceAnchor{}, false, fmt.Errorf("%w: empty sequence-state path", ErrInvalidSequenceAnchor)
	}
	raw, err := os.ReadFile(s.Path)
	if errors.Is(err, os.ErrNotExist) {
		return SequenceAnchor{}, false, nil
	}
	if err != nil {
		return SequenceAnchor{}, false, err
	}
	var disk sequenceFile
	if err := json.Unmarshal(raw, &disk); err != nil {
		return SequenceAnchor{}, false, fmt.Errorf("decode sequence state: %w", err)
	}
	if disk.Schema != "420-stake-systemcall-sequence-v1" {
		return SequenceAnchor{}, false, fmt.Errorf("%w: unsupported sequence-state schema", ErrInvalidSequenceAnchor)
	}
	hash, err := decodeHash32(disk.BlockHash)
	if err != nil {
		return SequenceAnchor{}, false, err
	}
	anchor := SequenceAnchor{
		ChainID:        disk.ChainID,
		ExecutionBlock: disk.ExecutionBlock,
		BlockHash:      hash,
		LastSequence:   disk.LastSequence,
	}
	if err := validateSequenceAnchor(anchor); err != nil {
		return SequenceAnchor{}, false, err
	}
	return anchor, true, nil
}

func (s FileSequenceStore) Store(anchor SequenceAnchor) error {
	if s.Path == "" {
		return fmt.Errorf("%w: empty sequence-state path", ErrInvalidSequenceAnchor)
	}
	if err := validateSequenceAnchor(anchor); err != nil {
		return err
	}
	dir := filepath.Dir(s.Path)
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return err
	}
	disk := sequenceFile{
		Schema:         "420-stake-systemcall-sequence-v1",
		ChainID:        anchor.ChainID,
		ExecutionBlock: anchor.ExecutionBlock,
		BlockHash:      "0x" + hex.EncodeToString(anchor.BlockHash[:]),
		LastSequence:   anchor.LastSequence,
	}
	raw, err := json.MarshalIndent(disk, "", "  ")
	if err != nil {
		return err
	}
	raw = append(raw, '\n')

	tmp, err := os.CreateTemp(dir, ".stake-sequence-*")
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
	if _, err := tmp.Write(raw); err != nil {
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
	if err := os.Rename(tmpName, s.Path); err != nil {
		_ = os.Remove(tmpName)
		return err
	}
	if d, err := os.Open(dir); err == nil {
		_ = d.Sync()
		_ = d.Close()
	}
	return nil
}

type SequenceManager struct {
	Store SequenceStore
}

func (m SequenceManager) RequireCanonicalParent(parent SequenceAnchor) (uint64, error) {
	if m.Store == nil {
		return 0, ErrSequenceStateMissing
	}
	if err := validateSequenceAnchor(parent); err != nil {
		return 0, err
	}
	current, ok, err := m.Store.Load()
	if err != nil {
		return 0, err
	}
	if !ok || current != parent {
		return 0, ErrSequenceRecoveryRequired
	}
	return parent.LastSequence, nil
}

// RecoverCanonicalParent deliberately replaces local sequence state with a parent
// anchor that the caller has independently verified against canonical execution
// gateway state. Local persistence is never allowed to overrule the chain.
func (m SequenceManager) RecoverCanonicalParent(parent SequenceAnchor) error {
	if m.Store == nil {
		return ErrSequenceStateMissing
	}
	if err := validateSequenceAnchor(parent); err != nil {
		return err
	}
	return m.Store.Store(parent)
}

func (m SequenceManager) BuildNext(parent SequenceAnchor, outcomes FinalizedStakeOutcomes) (Batch, error) {
	previous, err := m.RequireCanonicalParent(parent)
	if err != nil {
		return Batch{}, err
	}
	if parent.ExecutionBlock == ^uint64(0) {
		return Batch{}, fmt.Errorf("%w: execution block overflow", ErrInvalidSequenceAnchor)
	}
	return BuildStakeBatch(DerivationContext{
		ExecutionBlock: parent.ExecutionBlock + 1,
		ParentHash:     parent.BlockHash,
		ChainID:        parent.ChainID,
	}, previous, outcomes)
}

// CommitCanonicalChild persists sequence state only after the caller has accepted
// the child as canonical/finalized. A staged or rejected payload must never advance
// the durable sequence cursor.
func (m SequenceManager) CommitCanonicalChild(parent SequenceAnchor, childBlockHash [32]byte, batch Batch) (SequenceAnchor, error) {
	if m.Store == nil {
		return SequenceAnchor{}, ErrSequenceStateMissing
	}
	previous, err := m.RequireCanonicalParent(parent)
	if err != nil {
		return SequenceAnchor{}, err
	}
	if childBlockHash == ([32]byte{}) ||
		batch.ChainID != parent.ChainID ||
		batch.ParentHash != parent.BlockHash ||
		batch.ExecutionBlock != parent.ExecutionBlock+1 {
		return SequenceAnchor{}, ErrSequenceCommitContextMismatch
	}
	if err := batch.Validate(previous); err != nil {
		return SequenceAnchor{}, err
	}
	last := previous
	if len(batch.Calls) > 0 {
		last = batch.Calls[len(batch.Calls)-1].Sequence
	}
	child := SequenceAnchor{
		ChainID:        parent.ChainID,
		ExecutionBlock: batch.ExecutionBlock,
		BlockHash:      childBlockHash,
		LastSequence:   last,
	}
	if err := m.Store.Store(child); err != nil {
		return SequenceAnchor{}, err
	}
	return child, nil
}

func validateSequenceAnchor(anchor SequenceAnchor) error {
	if anchor.ChainID == 0 || anchor.BlockHash == ([32]byte{}) {
		return fmt.Errorf("%w: chain id or block hash is zero", ErrInvalidSequenceAnchor)
	}
	return nil
}

func decodeHash32(raw string) ([32]byte, error) {
	var out [32]byte
	if len(raw) != 66 || raw[:2] != "0x" {
		return out, fmt.Errorf("%w: invalid block hash encoding", ErrInvalidSequenceAnchor)
	}
	b, err := hex.DecodeString(raw[2:])
	if err != nil || len(b) != 32 {
		return out, fmt.Errorf("%w: invalid block hash", ErrInvalidSequenceAnchor)
	}
	copy(out[:], b)
	return out, nil
}

package storage

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
	"regexp"
	"sort"
	"sync"
)

var safeID = regexp.MustCompile(`^[A-Za-z0-9_-]{1,128}$`)

type FileStore struct {
	mu      sync.RWMutex
	root    string
	index   string
	records map[string]ShardRecord
}

func OpenFileStore(root string) (*FileStore, error) {
	if root == "" {
		return nil, ErrInvalidShard
	}
	if err := os.MkdirAll(filepath.Join(root, "shards"), 0o700); err != nil {
		return nil, err
	}
	fs := &FileStore{root: root, index: filepath.Join(root, "index.json"), records: make(map[string]ShardRecord)}
	if err := fs.load(); err != nil {
		return nil, err
	}
	return fs, nil
}

func (f *FileStore) Put(ctx context.Context, rec ShardRecord, src io.Reader) error {
	if err := ctx.Err(); err != nil { return err }
	if !safeID.MatchString(rec.CommitmentID) || rec.SizeBytes == 0 || rec.ShardRoot == "" || src == nil {
		return ErrInvalidShard
	}

	// Never hold the metadata lock while consuming an upload stream. A slow or
	// blocked body must not prevent Open/List calls for unrelated commitments.
	f.mu.RLock()
	_, exists := f.records[rec.CommitmentID]
	f.mu.RUnlock()
	if exists {
		return fmt.Errorf("%w: commitment already stored", ErrInvalidShard)
	}

	final := f.shardPath(rec.CommitmentID)
	tmp, err := os.CreateTemp(filepath.Dir(final), ".shard-*")
	if err != nil { return err }
	tmpName := tmp.Name()
	cleanup := func() { _ = tmp.Close(); _ = os.Remove(tmpName) }

	h := sha256.New()
	limited := io.LimitReader(contextReader{ctx: ctx, r: src}, int64(rec.SizeBytes)+1)
	written, err := io.Copy(io.MultiWriter(tmp, h), limited)
	if err != nil { cleanup(); return err }
	if err := ctx.Err(); err != nil { cleanup(); return err }
	if uint64(written) != rec.SizeBytes { cleanup(); return ErrInvalidShard }
	if hex.EncodeToString(h.Sum(nil)) != rec.ShardRoot { cleanup(); return ErrCommitmentMismatch }
	if err := tmp.Sync(); err != nil { cleanup(); return err }
	if err := tmp.Close(); err != nil { _ = os.Remove(tmpName); return err }

	// Serialize only the publication/index update. Recheck existence under the
	// write lock so FileStore remains safe even if called outside Runtime's
	// per-commitment serialization.
	f.mu.Lock()
	defer f.mu.Unlock()
	if _, exists := f.records[rec.CommitmentID]; exists {
		_ = os.Remove(tmpName)
		return fmt.Errorf("%w: commitment already stored", ErrInvalidShard)
	}
	if err := os.Rename(tmpName, final); err != nil { _ = os.Remove(tmpName); return err }
	f.records[rec.CommitmentID] = rec
	if err := f.persistLocked(); err != nil {
		delete(f.records, rec.CommitmentID)
		_ = os.Remove(final)
		return err
	}
	return nil
}

func (f *FileStore) Open(ctx context.Context, commitmentID string) (io.ReadCloser, ShardRecord, error) {
	if err := ctx.Err(); err != nil { return nil, ShardRecord{}, err }
	if !safeID.MatchString(commitmentID) { return nil, ShardRecord{}, ErrInvalidShard }
	f.mu.RLock()
	rec, ok := f.records[commitmentID]
	f.mu.RUnlock()
	if !ok { return nil, ShardRecord{}, ErrShardNotFound }
	fd, err := os.Open(f.shardPath(commitmentID))
	if errors.Is(err, os.ErrNotExist) { return nil, ShardRecord{}, ErrShardNotFound }
	if err != nil { return nil, ShardRecord{}, err }
	return fd, rec, nil
}

func (f *FileStore) Delete(ctx context.Context, commitmentID string) error {
	if err := ctx.Err(); err != nil { return err }
	if !safeID.MatchString(commitmentID) { return ErrInvalidShard }
	f.mu.Lock()
	defer f.mu.Unlock()
	if _, ok := f.records[commitmentID]; !ok { return ErrShardNotFound }
	if err := os.Remove(f.shardPath(commitmentID)); err != nil && !errors.Is(err, os.ErrNotExist) { return err }
	delete(f.records, commitmentID)
	return f.persistLocked()
}

func (f *FileStore) List(ctx context.Context) ([]ShardRecord, error) {
	if err := ctx.Err(); err != nil { return nil, err }
	f.mu.RLock()
	defer f.mu.RUnlock()
	out := make([]ShardRecord, 0, len(f.records))
	for _, rec := range f.records { out = append(out, rec) }
	sort.Slice(out, func(i, j int) bool { return out[i].CommitmentID < out[j].CommitmentID })
	return out, nil
}

func (f *FileStore) shardPath(id string) string { return filepath.Join(f.root, "shards", id+".bin") }

func (f *FileStore) load() error {
	data, err := os.ReadFile(f.index)
	if errors.Is(err, os.ErrNotExist) { return nil }
	if err != nil { return err }
	var records []ShardRecord
	if err := json.Unmarshal(data, &records); err != nil { return err }
	for _, rec := range records {
		if !safeID.MatchString(rec.CommitmentID) || rec.SizeBytes == 0 { return ErrInvalidShard }
		st, err := os.Stat(f.shardPath(rec.CommitmentID))
		if err != nil { return err }
		if uint64(st.Size()) != rec.SizeBytes { return ErrInvalidShard }
		f.records[rec.CommitmentID] = rec
	}
	return nil
}

func (f *FileStore) persistLocked() error {
	records := make([]ShardRecord, 0, len(f.records))
	for _, rec := range f.records { records = append(records, rec) }
	sort.Slice(records, func(i, j int) bool { return records[i].CommitmentID < records[j].CommitmentID })
	data, err := json.MarshalIndent(records, "", "  ")
	if err != nil { return err }
	tmp, err := os.CreateTemp(f.root, ".index-*")
	if err != nil { return err }
	name := tmp.Name()
	if _, err := tmp.Write(data); err != nil { _ = tmp.Close(); _ = os.Remove(name); return err }
	if err := tmp.Sync(); err != nil { _ = tmp.Close(); _ = os.Remove(name); return err }
	if err := tmp.Close(); err != nil { _ = os.Remove(name); return err }
	if err := os.Rename(name, f.index); err != nil { _ = os.Remove(name); return err }
	return nil
}

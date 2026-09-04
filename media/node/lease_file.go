package node

import (
	"context"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"
)

// FileLeaseStore is a restart-safe lease store for one host. It persists ownership and
// expiry atomically so a crashed process cannot immediately cause duplicate execution.
// Multi-host deployments should place an equivalent compare-and-swap implementation
// behind LeaseStore (for example Redis/etcd/Consul); the worker contract remains unchanged.
type FileLeaseStore struct {
	mu      sync.Mutex
	path    string
	ownerID string
	ttl     time.Duration
	now     func() time.Time
}

type persistedLeaseState struct {
	Leases map[string]persistedLease `json:"leases"`
}

type persistedLease struct {
	OwnerID   string `json:"owner_id"`
	ExpiresAt int64  `json:"expires_at_unix_nano"`
}

func NewFileLeaseStore(path, ownerID string, ttl time.Duration) (*FileLeaseStore, error) {
	if path == "" || ownerID == "" {
		return nil, errors.New("420media: file lease store requires path and owner id")
	}
	if ttl <= 0 {
		ttl = 30 * time.Second
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return nil, err
	}
	return &FileLeaseStore{path: path, ownerID: ownerID, ttl: ttl, now: time.Now}, nil
}

func (s *FileLeaseStore) Acquire(ctx context.Context, jobID [32]byte) (Lease, bool, error) {
	if err := ctx.Err(); err != nil {
		return nil, false, err
	}
	if jobID == ([32]byte{}) {
		return nil, false, errors.New("420media: zero job id")
	}
	s.mu.Lock()
	defer s.mu.Unlock()

	state, err := s.load()
	if err != nil {
		return nil, false, err
	}
	now := s.now()
	key := hex.EncodeToString(jobID[:])
	if current, ok := state.Leases[key]; ok && now.Before(time.Unix(0, current.ExpiresAt)) {
		return nil, false, nil
	}
	state.Leases[key] = persistedLease{OwnerID: s.ownerID, ExpiresAt: now.Add(s.ttl).UnixNano()}
	if err := s.save(state); err != nil {
		return nil, false, err
	}
	return &fileLease{store: s, jobID: jobID, ownerID: s.ownerID}, true, nil
}

func (s *FileLeaseStore) load() (persistedLeaseState, error) {
	state := persistedLeaseState{Leases: make(map[string]persistedLease)}
	data, err := os.ReadFile(s.path)
	if errors.Is(err, os.ErrNotExist) {
		return state, nil
	}
	if err != nil {
		return state, err
	}
	if len(data) == 0 {
		return state, nil
	}
	if err := json.Unmarshal(data, &state); err != nil {
		return state, fmt.Errorf("420media: corrupt lease state: %w", err)
	}
	if state.Leases == nil {
		state.Leases = make(map[string]persistedLease)
	}
	return state, nil
}

func (s *FileLeaseStore) save(state persistedLeaseState) error {
	data, err := json.Marshal(state)
	if err != nil {
		return err
	}
	tmp := s.path + ".tmp"
	if err := os.WriteFile(tmp, data, 0o600); err != nil {
		return err
	}
	return os.Rename(tmp, s.path)
}

type fileLease struct {
	store    *FileLeaseStore
	jobID    [32]byte
	ownerID  string
	released bool
}

func (l *fileLease) Renew(ctx context.Context) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	l.store.mu.Lock()
	defer l.store.mu.Unlock()
	if l.released {
		return ErrLeaseLost
	}
	state, err := l.store.load()
	if err != nil {
		return err
	}
	key := hex.EncodeToString(l.jobID[:])
	current, ok := state.Leases[key]
	if !ok || current.OwnerID != l.ownerID || !l.store.now().Before(time.Unix(0, current.ExpiresAt)) {
		delete(state.Leases, key)
		_ = l.store.save(state)
		return ErrLeaseLost
	}
	current.ExpiresAt = l.store.now().Add(l.store.ttl).UnixNano()
	state.Leases[key] = current
	return l.store.save(state)
}

func (l *fileLease) Release() error {
	l.store.mu.Lock()
	defer l.store.mu.Unlock()
	if l.released {
		return nil
	}
	state, err := l.store.load()
	if err != nil {
		return err
	}
	key := hex.EncodeToString(l.jobID[:])
	if current, ok := state.Leases[key]; ok && current.OwnerID == l.ownerID {
		delete(state.Leases, key)
		if err := l.store.save(state); err != nil {
			return err
		}
	}
	l.released = true
	return nil
}

var _ LeaseStore = (*FileLeaseStore)(nil)

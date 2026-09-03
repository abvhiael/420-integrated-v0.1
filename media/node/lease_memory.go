package node

import (
	"context"
	"sync"
	"time"
)

type memoryLeaseStore struct {
	mu    sync.Mutex
	ttl   time.Duration
	now   func() time.Time
	items map[[32]byte]time.Time
}

// NewMemoryLeaseStore is suitable for a single-process operator node. Production
// clustered deployments should supply a distributed LeaseStore implementation.
func NewMemoryLeaseStore(ttl time.Duration) LeaseStore {
	if ttl <= 0 {
		ttl = 30 * time.Second
	}
	return &memoryLeaseStore{ttl: ttl, now: time.Now, items: make(map[[32]byte]time.Time)}
}

func (s *memoryLeaseStore) Acquire(ctx context.Context, jobID [32]byte) (Lease, bool, error) {
	if err := ctx.Err(); err != nil {
		return nil, false, err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	now := s.now()
	if expiry, exists := s.items[jobID]; exists && now.Before(expiry) {
		return nil, false, nil
	}
	s.items[jobID] = now.Add(s.ttl)
	return &memoryLease{store: s, jobID: jobID}, true, nil
}

type memoryLease struct {
	store    *memoryLeaseStore
	jobID    [32]byte
	released bool
}

func (l *memoryLease) Renew(ctx context.Context) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	l.store.mu.Lock()
	defer l.store.mu.Unlock()
	if l.released {
		return ErrLeaseLost
	}
	expiry, exists := l.store.items[l.jobID]
	if !exists || l.store.now().After(expiry) {
		delete(l.store.items, l.jobID)
		return ErrLeaseLost
	}
	l.store.items[l.jobID] = l.store.now().Add(l.store.ttl)
	return nil
}

func (l *memoryLease) Release() error {
	l.store.mu.Lock()
	defer l.store.mu.Unlock()
	if l.released {
		return nil
	}
	delete(l.store.items, l.jobID)
	l.released = true
	return nil
}

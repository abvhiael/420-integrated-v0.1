package httpapi

import (
	"errors"
	"strings"
	"sync"
)

type idempotencyStore struct {
	mu    sync.Mutex
	items map[string]idempotencyResult
}

type idempotencyResult struct {
	Fingerprint string
	Status      int
	Body        []byte
}

func newIdempotencyStore() *idempotencyStore {
	return &idempotencyStore{items: map[string]idempotencyResult{}}
}

func (s *idempotencyStore) Get(key, fingerprint string) (idempotencyResult, bool, error) {
	key = strings.TrimSpace(key)
	if key == "" {
		return idempotencyResult{}, false, errors.New("Idempotency-Key header is required")
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	item, ok := s.items[key]
	if !ok {
		return idempotencyResult{}, false, nil
	}
	if item.Fingerprint != fingerprint {
		return idempotencyResult{}, false, errors.New("idempotency key reused with different request")
	}
	item.Body = append([]byte(nil), item.Body...)
	return item, true, nil
}

func (s *idempotencyStore) Put(key string, item idempotencyResult) {
	s.mu.Lock()
	defer s.mu.Unlock()
	item.Body = append([]byte(nil), item.Body...)
	s.items[strings.TrimSpace(key)] = item
}

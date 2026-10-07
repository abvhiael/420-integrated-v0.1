package api

import (
	"errors"
	"sync"
)

var ErrIdempotencyConflict = errors.New("420media api: idempotency key reused with different request")

type replay struct {
	Fingerprint string
	Status      int
	Body        []byte
}

type IdempotencyStore interface {
	Get(string, string) (replay, bool, error)
	Put(string, replay)
}

type MemoryIdempotency struct {
	mu      sync.Mutex
	entries map[string]replay
}

func NewMemoryIdempotency() *MemoryIdempotency {
	return &MemoryIdempotency{entries: make(map[string]replay)}
}

func (m *MemoryIdempotency) Get(key, fingerprint string) (replay, bool, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	entry, ok := m.entries[key]
	if !ok {
		return replay{}, false, nil
	}
	if entry.Fingerprint != fingerprint {
		return replay{}, false, ErrIdempotencyConflict
	}
	return entry, true, nil
}

func (m *MemoryIdempotency) Put(key string, value replay) {
	m.mu.Lock()
	m.entries[key] = replay{
		Fingerprint: value.Fingerprint,
		Status:      value.Status,
		Body:        append([]byte(nil), value.Body...),
	}
	m.mu.Unlock()
}

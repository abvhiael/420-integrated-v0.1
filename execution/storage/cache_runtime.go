package storage

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"
	"sync"
	"time"
)

var ErrCacheMiss = errors.New("cache miss")
var ErrCacheIntegrity = errors.New("cache integrity failure")

type CacheOrigin interface {
	FetchCacheObject(ctx context.Context, key CacheKey) ([]byte, error)
}

type CacheRuntime struct {
	mu      sync.Mutex
	policy  CachePolicy
	entries map[string]CacheEntry
	data    map[string][]byte
}

func NewCacheRuntime(policy CachePolicy) (*CacheRuntime, error) {
	if policy.MaxBytes == 0 || policy.MaxEntries == 0 || policy.DefaultTTL <= 0 || policy.MaxTTL <= 0 || policy.DefaultTTL > policy.MaxTTL {
		return nil, ErrInvalidCacheState
	}
	return &CacheRuntime{policy: policy, entries: map[string]CacheEntry{}, data: map[string][]byte{}}, nil
}

func (c *CacheRuntime) State(now time.Time) CacheState {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.purgeExpiredLocked(now.UTC())
	out := CacheState{Entries: make(map[string]CacheEntry, len(c.entries))}
	for id, entry := range c.entries {
		out.Entries[id] = entry
		out.UsedBytes += entry.Key.SizeBytes
	}
	return out
}

func (c *CacheRuntime) Put(key CacheKey, payload []byte, now time.Time, ttl time.Duration) (CacheEntry, error) {
	if err := verifyCachePayload(key, payload); err != nil { return CacheEntry{}, err }
	id, err := CanonicalCacheKey(key)
	if err != nil { return CacheEntry{}, err }
	now = now.UTC()
	c.mu.Lock()
	defer c.mu.Unlock()
	c.purgeExpiredLocked(now)
	state := CacheState{Entries: make(map[string]CacheEntry, len(c.entries))}
	for k, e := range c.entries { state.Entries[k] = e; state.UsedBytes += e.Key.SizeBytes }
	admission, err := EvaluateCacheAdmission(state, c.policy, key, now, ttl)
	if err != nil { return CacheEntry{}, err }
	if !admission.Accepted { return CacheEntry{}, ErrInvalidCacheState }
	for _, victim := range admission.Evict { delete(c.entries, victim); delete(c.data, victim) }
	storedAt := now
	lastAccess := now
	hits := uint64(0)
	if prior, ok := c.entries[id]; ok { storedAt = prior.StoredAt; lastAccess = prior.LastAccess; hits = prior.HitCount }
	entry := CacheEntry{Key:key, StoredAt:storedAt, ExpiresAt:admission.ExpiresAt, LastAccess:lastAccess, HitCount:hits}
	c.entries[id] = entry
	c.data[id] = append([]byte(nil), payload...)
	return entry, nil
}

func (c *CacheRuntime) Get(key CacheKey, now time.Time) ([]byte, CacheEntry, error) {
	id, err := CanonicalCacheKey(key)
	if err != nil { return nil, CacheEntry{}, err }
	now = now.UTC()
	c.mu.Lock()
	defer c.mu.Unlock()
	entry, ok := c.entries[id]
	if !ok || !entry.ExpiresAt.After(now) {
		if ok { delete(c.entries,id); delete(c.data,id) }
		return nil, CacheEntry{}, ErrCacheMiss
	}
	payload, ok := c.data[id]
	if !ok { delete(c.entries,id); return nil, CacheEntry{}, ErrCacheIntegrity }
	if err := verifyCachePayload(entry.Key, payload); err != nil { delete(c.entries,id); delete(c.data,id); return nil, CacheEntry{}, err }
	entry.LastAccess = now
	entry.HitCount++
	c.entries[id] = entry
	return append([]byte(nil), payload...), entry, nil
}

func (c *CacheRuntime) GetOrFill(ctx context.Context, key CacheKey, now time.Time, ttl time.Duration, origin CacheOrigin) ([]byte, CacheEntry, bool, error) {
	payload, entry, err := c.Get(key, now)
	if err == nil { return payload, entry, true, nil }
	if !errors.Is(err, ErrCacheMiss) && !errors.Is(err, ErrCacheIntegrity) { return nil, CacheEntry{}, false, err }
	if origin == nil { return nil, CacheEntry{}, false, ErrCacheMiss }
	payload, err = origin.FetchCacheObject(ctx, key)
	if err != nil { return nil, CacheEntry{}, false, err }
	entry, err = c.Put(key, payload, now, ttl)
	if err != nil { return nil, CacheEntry{}, false, err }
	return append([]byte(nil), payload...), entry, false, nil
}

func (c *CacheRuntime) purgeExpiredLocked(now time.Time) {
	for id, entry := range c.entries {
		if !entry.ExpiresAt.After(now) { delete(c.entries,id); delete(c.data,id) }
	}
}

func verifyCachePayload(key CacheKey, payload []byte) error {
	if uint64(len(payload)) != key.SizeBytes { return fmt.Errorf("%w: size mismatch", ErrCacheIntegrity) }
	expected := strings.TrimPrefix(strings.ToLower(strings.TrimSpace(key.ShardRoot)), "0x")
	if len(expected) != 64 || !isHex(expected) { return ErrInvalidCacheState }
	sum := sha256.Sum256(payload)
	if hex.EncodeToString(sum[:]) != expected { return fmt.Errorf("%w: shard root mismatch", ErrCacheIntegrity) }
	return nil
}

package storage

import (
	"errors"
	"sort"
	"strings"
	"time"
)

var ErrInvalidCacheState = errors.New("invalid cache state")

type CacheKey struct {
	ObjectID     string
	ManifestID   string
	ShardIndex   uint32
	ShardRoot    string
	SizeBytes    uint64
}

type CachePolicy struct {
	MaxBytes      uint64
	MaxEntries    uint32
	DefaultTTL    time.Duration
	MaxTTL        time.Duration
}

type CacheEntry struct {
	Key         CacheKey
	StoredAt    time.Time
	ExpiresAt   time.Time
	LastAccess  time.Time
	HitCount    uint64
}

type CacheState struct {
	Entries   map[string]CacheEntry
	UsedBytes uint64
}

type CacheAdmission struct {
	Accepted bool
	Evict    []string
	ExpiresAt time.Time
}

func CanonicalCacheKey(key CacheKey) (string, error) {
	if strings.TrimSpace(key.ObjectID) == "" || strings.TrimSpace(key.ManifestID) == "" || strings.TrimSpace(key.ShardRoot) == "" || key.SizeBytes == 0 {
		return "", ErrInvalidCacheState
	}
	return strings.ToLower(key.ManifestID) + ":" + strings.ToLower(key.ShardRoot), nil
}

func EvaluateCacheAdmission(state CacheState, policy CachePolicy, key CacheKey, now time.Time, ttl time.Duration) (CacheAdmission, error) {
	if policy.MaxBytes == 0 || policy.MaxEntries == 0 || policy.DefaultTTL <= 0 || policy.MaxTTL <= 0 || policy.DefaultTTL > policy.MaxTTL {
		return CacheAdmission{}, ErrInvalidCacheState
	}
	id, err := CanonicalCacheKey(key)
	if err != nil { return CacheAdmission{}, err }
	if key.SizeBytes > policy.MaxBytes { return CacheAdmission{Accepted:false}, nil }
	if ttl <= 0 { ttl = policy.DefaultTTL }
	if ttl > policy.MaxTTL { ttl = policy.MaxTTL }
	now = now.UTC()
	if existing, ok := state.Entries[id]; ok {
		if existing.Key.SizeBytes != key.SizeBytes || !equalHex(existing.Key.ShardRoot, key.ShardRoot) || !equalHex(existing.Key.ManifestID, key.ManifestID) {
			return CacheAdmission{}, ErrInvalidCacheState
		}
		return CacheAdmission{Accepted:true, ExpiresAt:now.Add(ttl)}, nil
	}

	used := uint64(0)
	live := make([]CacheEntry, 0, len(state.Entries))
	for _, entry := range state.Entries {
		if entry.ExpiresAt.After(now) {
			if ^uint64(0)-used < entry.Key.SizeBytes { return CacheAdmission{}, ErrInvalidCacheState }
			used += entry.Key.SizeBytes
			live = append(live, entry)
		}
	}
	if state.UsedBytes != 0 && state.UsedBytes < used { return CacheAdmission{}, ErrInvalidCacheState }

	sort.Slice(live, func(i, j int) bool {
		if !live[i].LastAccess.Equal(live[j].LastAccess) { return live[i].LastAccess.Before(live[j].LastAccess) }
		ki, _ := CanonicalCacheKey(live[i].Key); kj, _ := CanonicalCacheKey(live[j].Key)
		return ki < kj
	})

	projectedBytes := used + key.SizeBytes
	projectedEntries := uint32(len(live)) + 1
	evict := []string{}
	for (projectedBytes > policy.MaxBytes || projectedEntries > policy.MaxEntries) && len(live) > 0 {
		victim := live[0]
		live = live[1:]
		vid, _ := CanonicalCacheKey(victim.Key)
		evict = append(evict, vid)
		projectedBytes -= victim.Key.SizeBytes
		projectedEntries--
	}
	if projectedBytes > policy.MaxBytes || projectedEntries > policy.MaxEntries {
		return CacheAdmission{Accepted:false}, nil
	}
	return CacheAdmission{Accepted:true, Evict:evict, ExpiresAt:now.Add(ttl)}, nil
}

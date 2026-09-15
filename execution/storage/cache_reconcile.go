package storage

import (
	"context"
	"errors"
	"os"
	"sort"
	"time"
)

var ErrCacheCanonical = errors.New("cache canonical validation failed")

type CacheCanonicalReader interface {
	ValidateCacheEntry(ctx context.Context, key CacheKey) (bool, error)
}

type CacheReconcileResult struct {
	Checked     int
	Kept        int
	Invalidated []string
}

func (p *PersistentCacheRuntime) Reconcile(ctx context.Context, now time.Time, canonical CacheCanonicalReader) (CacheReconcileResult, error) {
	if canonical == nil { return CacheReconcileResult{}, ErrCacheCanonical }
	now = now.UTC()
	state := p.Runtime.State(now)
	ids := make([]string, 0, len(state.Entries))
	for id := range state.Entries { ids = append(ids, id) }
	sort.Strings(ids)
	result := CacheReconcileResult{}
	for _, id := range ids {
		entry := state.Entries[id]
		result.Checked++
		valid, err := canonical.ValidateCacheEntry(ctx, entry.Key)
		if err != nil { return result, err }
		if valid {
			if payload, err := os.ReadFile(p.payloadPath(id)); err == nil && verifyCachePayload(entry.Key, payload) == nil {
				result.Kept++
				continue
			}
		}
		p.removeRuntime(id)
		_ = os.Remove(p.payloadPath(id))
		result.Invalidated = append(result.Invalidated, id)
	}
	if err := p.removeOrphanPayloads(); err != nil { return result, err }
	if err := p.persistMetadata(now); err != nil { return result, err }
	return result, nil
}

func (p *PersistentCacheRuntime) removeOrphanPayloads() error {
	entries, err := os.ReadDir(p.dataDir())
	if err != nil {
		if os.IsNotExist(err) { return nil }
		return ErrCachePersistence
	}
	p.Runtime.mu.Lock()
	live := make(map[string]struct{}, len(p.Runtime.entries))
	for id := range p.Runtime.entries { live[sha256Hex([]byte(id))+".cache"] = struct{}{} }
	p.Runtime.mu.Unlock()
	for _, entry := range entries {
		if entry.IsDir() { continue }
		name := entry.Name()
		if _, ok := live[name]; ok { continue }
		if err := os.Remove(p.dataDir()+string(os.PathSeparator)+name); err != nil && !os.IsNotExist(err) { return ErrCachePersistence }
	}
	return nil
}

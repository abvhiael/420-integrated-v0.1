package storage

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"sort"
	"time"
)

var ErrCachePersistence = errors.New("cache persistence failure")

type PersistentCacheRuntime struct {
	Runtime *CacheRuntime
	Root    string
}

type cacheMetadata struct {
	Entries []CacheEntry `json:"entries"`
}

func NewPersistentCacheRuntime(root string, policy CachePolicy) (*PersistentCacheRuntime, error) {
	if root == "" { return nil, ErrCachePersistence }
	runtime, err := NewCacheRuntime(policy)
	if err != nil { return nil, err }
	p := &PersistentCacheRuntime{Runtime: runtime, Root: root}
	if err := os.MkdirAll(p.dataDir(), 0o755); err != nil { return nil, ErrCachePersistence }
	return p, nil
}

func (p *PersistentCacheRuntime) Put(key CacheKey, payload []byte, now time.Time, ttl time.Duration) (CacheEntry, error) {
	entry, err := p.Runtime.Put(key, payload, now, ttl)
	if err != nil { return CacheEntry{}, err }
	id, _ := CanonicalCacheKey(key)
	if err := p.writePayload(id, payload); err != nil { p.removeRuntime(id); return CacheEntry{}, err }
	if err := p.persistMetadata(now); err != nil { _ = os.Remove(p.payloadPath(id)); p.removeRuntime(id); return CacheEntry{}, err }
	return entry, nil
}

func (p *PersistentCacheRuntime) Get(key CacheKey, now time.Time) ([]byte, CacheEntry, error) {
	id, err := CanonicalCacheKey(key)
	if err != nil { return nil, CacheEntry{}, err }
	payload, err := os.ReadFile(p.payloadPath(id))
	if err != nil {
		p.removeRuntime(id)
		_ = p.persistMetadata(now)
		if os.IsNotExist(err) { return nil, CacheEntry{}, ErrCacheMiss }
		return nil, CacheEntry{}, ErrCachePersistence
	}
	p.Runtime.mu.Lock()
	entry, ok := p.Runtime.entries[id]
	if !ok || !entry.ExpiresAt.After(now.UTC()) {
		p.Runtime.mu.Unlock()
		_ = os.Remove(p.payloadPath(id))
		_ = p.persistMetadata(now)
		return nil, CacheEntry{}, ErrCacheMiss
	}
	if err := verifyCachePayload(entry.Key, payload); err != nil {
		delete(p.Runtime.entries, id); delete(p.Runtime.data, id)
		p.Runtime.mu.Unlock()
		_ = os.Remove(p.payloadPath(id)); _ = p.persistMetadata(now)
		return nil, CacheEntry{}, err
	}
	entry.LastAccess = now.UTC(); entry.HitCount++
	p.Runtime.entries[id] = entry
	p.Runtime.data[id] = append([]byte(nil), payload...)
	p.Runtime.mu.Unlock()
	if err := p.persistMetadata(now); err != nil { return nil, CacheEntry{}, err }
	return append([]byte(nil), payload...), entry, nil
}

func (p *PersistentCacheRuntime) Recover(now time.Time) error {
	now = now.UTC()
	meta, err := p.loadMetadata()
	if err != nil { return err }
	p.Runtime.mu.Lock()
	p.Runtime.entries = map[string]CacheEntry{}
	p.Runtime.data = map[string][]byte{}
	p.Runtime.mu.Unlock()
	for _, entry := range meta.Entries {
		id, err := CanonicalCacheKey(entry.Key)
		if err != nil || !entry.ExpiresAt.After(now) { if err == nil { _ = os.Remove(p.payloadPath(id)) }; continue }
		payload, err := os.ReadFile(p.payloadPath(id))
		if err != nil || verifyCachePayload(entry.Key, payload) != nil { _ = os.Remove(p.payloadPath(id)); continue }
		p.Runtime.mu.Lock()
		p.Runtime.entries[id] = entry
		p.Runtime.data[id] = append([]byte(nil), payload...)
		p.Runtime.mu.Unlock()
	}
	return p.persistMetadata(now)
}

func (p *PersistentCacheRuntime) persistMetadata(now time.Time) error {
	state := p.Runtime.State(now)
	entries := make([]CacheEntry, 0, len(state.Entries))
	for _, e := range state.Entries { entries = append(entries, e) }
	sort.Slice(entries, func(i,j int) bool { a,_:=CanonicalCacheKey(entries[i].Key); b,_:=CanonicalCacheKey(entries[j].Key); return a<b })
	b, err := json.Marshal(cacheMetadata{Entries:entries})
	if err != nil { return ErrCachePersistence }
	if err := os.MkdirAll(p.Root, 0o755); err != nil { return ErrCachePersistence }
	tmp := p.metadataPath()+".tmp"
	f, err := os.OpenFile(tmp, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0o644)
	if err != nil { return ErrCachePersistence }
	if _, err = f.Write(b); err == nil { err = f.Sync() }
	closeErr := f.Close(); if err == nil { err = closeErr }
	if err != nil { _ = os.Remove(tmp); return ErrCachePersistence }
	if err := os.Rename(tmp, p.metadataPath()); err != nil { _ = os.Remove(tmp); return ErrCachePersistence }
	return nil
}

func (p *PersistentCacheRuntime) loadMetadata() (cacheMetadata, error) {
	b, err := os.ReadFile(p.metadataPath())
	if os.IsNotExist(err) { return cacheMetadata{}, nil }
	if err != nil { return cacheMetadata{}, ErrCachePersistence }
	var meta cacheMetadata
	if err := json.Unmarshal(b, &meta); err != nil { return cacheMetadata{}, ErrCachePersistence }
	return meta, nil
}

func (p *PersistentCacheRuntime) writePayload(id string, payload []byte) error {
	if err := os.MkdirAll(p.dataDir(), 0o755); err != nil { return ErrCachePersistence }
	tmp := p.payloadPath(id)+".tmp"
	f, err := os.OpenFile(tmp, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0o644)
	if err != nil { return ErrCachePersistence }
	if _, err = f.Write(payload); err == nil { err = f.Sync() }
	closeErr := f.Close(); if err == nil { err = closeErr }
	if err != nil { _ = os.Remove(tmp); return ErrCachePersistence }
	if err := os.Rename(tmp, p.payloadPath(id)); err != nil { _ = os.Remove(tmp); return ErrCachePersistence }
	return nil
}

func (p *PersistentCacheRuntime) removeRuntime(id string) {
	p.Runtime.mu.Lock(); defer p.Runtime.mu.Unlock()
	delete(p.Runtime.entries,id); delete(p.Runtime.data,id)
}

func (p *PersistentCacheRuntime) dataDir() string { return filepath.Join(p.Root, "data") }
func (p *PersistentCacheRuntime) metadataPath() string { return filepath.Join(p.Root, "metadata.json") }
func (p *PersistentCacheRuntime) payloadPath(id string) string {
	sum := sha256Hex([]byte(id))
	return filepath.Join(p.dataDir(), sum+".cache")
}

func sha256Hex(v []byte) string {
	s := sha256.Sum256(v)
	return hex.EncodeToString(s[:])
}

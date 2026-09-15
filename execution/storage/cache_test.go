package storage

import (
	"testing"
	"time"
)

func cacheHex(seed byte) string {
	b := make([]byte, 32)
	for i := range b { b[i] = seed }
	return wordHex(*(*[32]byte)(b))
}

func TestCanonicalCacheKeyStable(t *testing.T) {
	k := CacheKey{ObjectID:cacheHex(1), ManifestID:cacheHex(2), ShardIndex:0, ShardRoot:cacheHex(3), SizeBytes:64}
	a, err := CanonicalCacheKey(k); if err != nil { t.Fatal(err) }
	b, err := CanonicalCacheKey(k); if err != nil { t.Fatal(err) }
	if a != b { t.Fatalf("unstable cache key %q %q", a, b) }
}

func TestCacheAdmissionRejectsOversize(t *testing.T) {
	p := CachePolicy{MaxBytes:128, MaxEntries:2, DefaultTTL:time.Minute, MaxTTL:time.Hour}
	k := CacheKey{ObjectID:cacheHex(1), ManifestID:cacheHex(2), ShardRoot:cacheHex(3), SizeBytes:256}
	got, err := EvaluateCacheAdmission(CacheState{}, p, k, time.Unix(100,0), 0); if err != nil { t.Fatal(err) }
	if got.Accepted { t.Fatal("oversize entry accepted") }
}

func TestCacheAdmissionEvictsLeastRecentlyUsed(t *testing.T) {
	now := time.Unix(1000,0).UTC()
	p := CachePolicy{MaxBytes:128, MaxEntries:2, DefaultTTL:time.Minute, MaxTTL:time.Hour}
	k1 := CacheKey{ObjectID:cacheHex(1), ManifestID:cacheHex(11), ShardRoot:cacheHex(21), SizeBytes:64}
	k2 := CacheKey{ObjectID:cacheHex(2), ManifestID:cacheHex(12), ShardRoot:cacheHex(22), SizeBytes:64}
	id1,_ := CanonicalCacheKey(k1); id2,_ := CanonicalCacheKey(k2)
	state := CacheState{Entries:map[string]CacheEntry{
		id1:{Key:k1, StoredAt:now.Add(-time.Hour), ExpiresAt:now.Add(time.Hour), LastAccess:now.Add(-30*time.Minute)},
		id2:{Key:k2, StoredAt:now.Add(-time.Hour), ExpiresAt:now.Add(time.Hour), LastAccess:now.Add(-10*time.Minute)},
	}, UsedBytes:128}
	k3 := CacheKey{ObjectID:cacheHex(3), ManifestID:cacheHex(13), ShardRoot:cacheHex(23), SizeBytes:64}
	got, err := EvaluateCacheAdmission(state,p,k3,now,0); if err != nil { t.Fatal(err) }
	if !got.Accepted || len(got.Evict)!=1 || got.Evict[0]!=id1 { t.Fatalf("unexpected admission %+v", got) }
}

func TestCacheAdmissionIgnoresExpiredEntries(t *testing.T) {
	now := time.Unix(1000,0).UTC()
	p := CachePolicy{MaxBytes:64, MaxEntries:1, DefaultTTL:time.Minute, MaxTTL:time.Hour}
	old := CacheKey{ObjectID:cacheHex(1), ManifestID:cacheHex(10), ShardRoot:cacheHex(20), SizeBytes:64}
	oldID,_ := CanonicalCacheKey(old)
	state := CacheState{Entries:map[string]CacheEntry{oldID:{Key:old, ExpiresAt:now.Add(-time.Second), LastAccess:now.Add(-time.Hour)}}, UsedBytes:64}
	fresh := CacheKey{ObjectID:cacheHex(2), ManifestID:cacheHex(11), ShardRoot:cacheHex(21), SizeBytes:64}
	got, err := EvaluateCacheAdmission(state,p,fresh,now,0); if err != nil { t.Fatal(err) }
	if !got.Accepted || len(got.Evict)!=0 { t.Fatalf("expired entry affected admission %+v", got) }
}

func TestCacheAdmissionCapsTTL(t *testing.T) {
	now := time.Unix(1000,0).UTC()
	p := CachePolicy{MaxBytes:128, MaxEntries:2, DefaultTTL:time.Minute, MaxTTL:time.Hour}
	k := CacheKey{ObjectID:cacheHex(1), ManifestID:cacheHex(2), ShardRoot:cacheHex(3), SizeBytes:64}
	got, err := EvaluateCacheAdmission(CacheState{},p,k,now,24*time.Hour); if err != nil { t.Fatal(err) }
	if !got.ExpiresAt.Equal(now.Add(time.Hour)) { t.Fatalf("ttl not capped: %v", got.ExpiresAt) }
}

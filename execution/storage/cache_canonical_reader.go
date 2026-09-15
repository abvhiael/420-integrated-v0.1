package storage

import (
	"context"
	"strings"
)

// RepairCacheCanonicalReader reuses the canonical sealed-manifest reader used
// by 420Repair to validate cached shard identity. Cache remains acceleration
// only; this adapter never mutates canonical state.
type RepairCacheCanonicalReader struct {
	Reader RepairCanonicalReader
}

func (r RepairCacheCanonicalReader) ValidateCacheEntry(ctx context.Context, key CacheKey) (bool, error) {
	if r.Reader == nil || strings.TrimSpace(key.ManifestID) == "" {
		return false, ErrCacheCanonical
	}
	snapshot, err := r.Reader.RepairSnapshot(ctx, key.ManifestID)
	if err != nil {
		return false, err
	}
	manifest := snapshot.Manifest
	if !manifest.Sealed || !equalHex(manifest.ManifestID, key.ManifestID) || !equalHex(manifest.ObjectID, key.ObjectID) {
		return false, nil
	}
	for _, placement := range manifest.Placements {
		if placement.ShardIndex != key.ShardIndex {
			continue
		}
		return placement.SizeBytes == key.SizeBytes && equalHex(placement.ShardRoot, key.ShardRoot), nil
	}
	return false, nil
}

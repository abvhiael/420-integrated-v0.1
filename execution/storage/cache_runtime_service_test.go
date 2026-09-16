package storage

import (
	"context"
	"errors"
	"testing"
	"time"
)

type cacheRepairReaderStub struct {
	snapshot RepairSnapshot
	err      error
	calls    int
	called   chan struct{}
}

func (s *cacheRepairReaderStub) RepairSnapshot(context.Context, string) (RepairSnapshot, error) {
	s.calls++
	if s.called != nil {
		select {
		case s.called <- struct{}{}:
		default:
		}
	}
	if s.err != nil {
		return RepairSnapshot{}, s.err
	}
	return s.snapshot, nil
}

func TestRepairCacheCanonicalReaderMatchesPlacement(t *testing.T) {
	payload := []byte("cache-data")
	key := CacheKey{ObjectID: "0x01", ManifestID: "0x02", ShardIndex: 3, ShardRoot: "0x" + sha256Hex(payload), SizeBytes: uint64(len(payload))}
	stub := &cacheRepairReaderStub{snapshot: RepairSnapshot{Manifest: RepairManifest{
		ManifestID: key.ManifestID,
		ObjectID: key.ObjectID,
		Sealed: true,
		Placements: []RepairPlacement{{ShardIndex: key.ShardIndex, ShardRoot: key.ShardRoot, SizeBytes: key.SizeBytes}},
	}}}
	reader := RepairCacheCanonicalReader{Reader: stub}
	valid, err := reader.ValidateCacheEntry(context.Background(), key)
	if err != nil || !valid {
		t.Fatalf("valid=%v err=%v", valid, err)
	}
	key.SizeBytes++
	valid, err = reader.ValidateCacheEntry(context.Background(), key)
	if err != nil || valid {
		t.Fatalf("mismatch valid=%v err=%v", valid, err)
	}
}

func TestRepairCacheCanonicalReaderPropagatesCanonicalFailure(t *testing.T) {
	boom := errors.New("rpc down")
	reader := RepairCacheCanonicalReader{Reader: &cacheRepairReaderStub{err: boom}}
	_, err := reader.ValidateCacheEntry(context.Background(), CacheKey{ManifestID: "0x02"})
	if !errors.Is(err, boom) {
		t.Fatalf("expected canonical error, got %v", err)
	}
}

func TestCacheRuntimeServiceRecoversRunsAndCancels(t *testing.T) {
	policy := CachePolicy{MaxBytes: 1024, MaxEntries: 8, DefaultTTL: time.Hour, MaxTTL: 2 * time.Hour}
	p, err := NewPersistentCacheRuntime(t.TempDir(), policy)
	if err != nil { t.Fatal(err) }
	payload := []byte("cache-data")
	key := CacheKey{ObjectID: "0x01", ManifestID: "0x02", ShardIndex: 1, ShardRoot: "0x" + sha256Hex(payload), SizeBytes: uint64(len(payload))}
	now := time.Unix(500, 0).UTC()
	if _, err := p.Put(key, payload, now, time.Hour); err != nil { t.Fatal(err) }

	called := make(chan struct{}, 1)
	canonical := RepairCacheCanonicalReader{Reader: &cacheRepairReaderStub{called: called, snapshot: RepairSnapshot{Manifest: RepairManifest{
		ManifestID: key.ManifestID, ObjectID: key.ObjectID, Sealed: true,
		Placements: []RepairPlacement{{ShardIndex: key.ShardIndex, ShardRoot: key.ShardRoot, SizeBytes: key.SizeBytes}},
	}}}}
	reconciler, err := NewCacheReconcileService(p, canonical, time.Hour, time.Second, time.Minute)
	if err != nil { t.Fatal(err) }
	runtime, err := NewCacheRuntimeService(reconciler)
	if err != nil { t.Fatal(err) }
	runtime.Now = func() time.Time { return now.Add(time.Minute) }
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan error, 1)
	go func() { done <- runtime.Run(ctx) }()
	select {
	case <-called:
		cancel()
	case <-time.After(2 * time.Second):
		t.Fatal("reconcile did not run")
	}
	select {
	case err := <-done:
		if err != nil { t.Fatalf("run err=%v", err) }
	case <-time.After(2 * time.Second):
		t.Fatal("runtime did not stop on cancellation")
	}
	if reconciler.Metrics().Runs == 0 {
		t.Fatal("expected reconcile run")
	}
}

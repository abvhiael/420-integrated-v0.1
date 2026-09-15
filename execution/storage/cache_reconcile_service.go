package storage

import (
	"context"
	"errors"
	"os"
	"time"
)

var ErrCacheReconcileService = errors.New("cache reconcile service failure")

type CacheReconcileMetrics struct {
	Runs              uint64
	Successes         uint64
	Failures          uint64
	Checked           uint64
	Kept              uint64
	Invalidated       uint64
	TriggeredEvictions uint64
	ConsecutiveFailures uint32
	LastRunAt         time.Time
	LastSuccessAt     time.Time
	LastError         string
}

type CacheReconcileService struct {
	Runtime    *PersistentCacheRuntime
	Canonical  CacheCanonicalReader
	Interval   time.Duration
	MinBackoff time.Duration
	MaxBackoff time.Duration
	metrics    CacheReconcileMetrics
}

func NewCacheReconcileService(runtime *PersistentCacheRuntime, canonical CacheCanonicalReader, interval, minBackoff, maxBackoff time.Duration) (*CacheReconcileService, error) {
	if runtime == nil || canonical == nil || interval <= 0 || minBackoff <= 0 || maxBackoff < minBackoff {
		return nil, ErrCacheReconcileService
	}
	return &CacheReconcileService{Runtime:runtime, Canonical:canonical, Interval:interval, MinBackoff:minBackoff, MaxBackoff:maxBackoff}, nil
}

func (s *CacheReconcileService) RunOnce(ctx context.Context, now time.Time) (CacheReconcileResult, time.Duration, error) {
	if s == nil || s.Runtime == nil || s.Canonical == nil { return CacheReconcileResult{}, 0, ErrCacheReconcileService }
	now = now.UTC()
	s.metrics.Runs++
	s.metrics.LastRunAt = now
	result, err := s.Runtime.Reconcile(ctx, now, s.Canonical)
	s.metrics.Checked += uint64(result.Checked)
	s.metrics.Kept += uint64(result.Kept)
	s.metrics.Invalidated += uint64(len(result.Invalidated))
	if err != nil {
		s.metrics.Failures++
		s.metrics.ConsecutiveFailures++
		s.metrics.LastError = err.Error()
		return result, s.failureDelay(), err
	}
	s.metrics.Successes++
	s.metrics.ConsecutiveFailures = 0
	s.metrics.LastError = ""
	s.metrics.LastSuccessAt = now
	return result, s.Interval, nil
}

func (s *CacheReconcileService) Metrics() CacheReconcileMetrics { return s.metrics }

func (s *CacheReconcileService) failureDelay() time.Duration {
	d := s.MinBackoff
	for i:=uint32(1); i<s.metrics.ConsecutiveFailures && d<s.MaxBackoff; i++ {
		if d > s.MaxBackoff/2 { return s.MaxBackoff }
		d *= 2
	}
	if d > s.MaxBackoff { return s.MaxBackoff }
	return d
}

func (s *CacheReconcileService) InvalidateCanonicalChange(now time.Time, key CacheKey) (bool, error) {
	if s == nil || s.Runtime == nil { return false, ErrCacheReconcileService }
	id, err := CanonicalCacheKey(key)
	if err != nil { return false, err }
	s.Runtime.Runtime.mu.Lock()
	_, existed := s.Runtime.Runtime.entries[id]
	delete(s.Runtime.Runtime.entries, id)
	delete(s.Runtime.Runtime.data, id)
	s.Runtime.Runtime.mu.Unlock()
	if err := os.Remove(s.Runtime.payloadPath(id)); err != nil && !os.IsNotExist(err) { return false, ErrCachePersistence }
	if err := s.Runtime.persistMetadata(now.UTC()); err != nil { return false, err }
	if existed { s.metrics.TriggeredEvictions++ }
	return existed, nil
}

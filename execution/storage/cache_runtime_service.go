package storage

import (
	"context"
	"errors"
	"time"
)

var ErrCacheRuntimeService = errors.New("cache runtime service failure")

type CacheRuntimeService struct {
	Reconciler *CacheReconcileService
	Now        func() time.Time
}

func NewCacheRuntimeService(reconciler *CacheReconcileService) (*CacheRuntimeService, error) {
	if reconciler == nil || reconciler.Runtime == nil || reconciler.Canonical == nil {
		return nil, ErrCacheRuntimeService
	}
	return &CacheRuntimeService{Reconciler: reconciler, Now: func() time.Time { return time.Now().UTC() }}, nil
}

func (s *CacheRuntimeService) Run(ctx context.Context) error {
	if s == nil || s.Reconciler == nil || s.Reconciler.Runtime == nil {
		return ErrCacheRuntimeService
	}
	now := s.now()
	if err := s.Reconciler.Runtime.Recover(now); err != nil {
		return err
	}
	delay := time.Duration(0)
	for {
		if delay > 0 {
			timer := time.NewTimer(delay)
			select {
			case <-ctx.Done():
				if !timer.Stop() {
					<-timer.C
				}
				return nil
			case <-timer.C:
			}
		}
		if ctx.Err() != nil {
			return nil
		}
		_, next, err := s.Reconciler.RunOnce(ctx, s.now())
		if err != nil && ctx.Err() != nil {
			return nil
		}
		if next <= 0 {
			return ErrCacheRuntimeService
		}
		delay = next
	}
}

func (s *CacheRuntimeService) now() time.Time {
	if s.Now != nil {
		return s.Now().UTC()
	}
	return time.Now().UTC()
}

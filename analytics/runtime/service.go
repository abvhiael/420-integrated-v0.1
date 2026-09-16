package runtime

import (
	"context"
	"errors"
	"time"

	"github.com/420integrated/420-integrated/analytics/finality"
	"github.com/420integrated/420-integrated/analytics/httpapi"
	"github.com/420integrated/420-integrated/analytics/indexerclient"
	"github.com/420integrated/420-integrated/analytics/metrics"
	"github.com/420integrated/420-integrated/analytics/model"
)

type Service struct {
	client     *indexerclient.Client
	catalog    *Catalog
	staleAfter time.Duration
	now        func() time.Time
}

func New(client *indexerclient.Client, catalog *Catalog, staleAfter time.Duration) (*Service, error) {
	if client == nil { return nil, errors.New("analytics runtime requires 420Indexer client") }
	if catalog == nil { return nil, errors.New("analytics runtime requires catalog") }
	if staleAfter <= 0 { return nil, errors.New("analytics runtime stale threshold must be positive") }
	return &Service{client:client, catalog:catalog, staleAfter:staleAfter, now:time.Now}, nil
}

func (s *Service) Catalog() *Catalog { return s.catalog }

func (s *Service) Refresh(ctx context.Context) error {
	if err := s.client.Qualified(ctx); err != nil {
		s.catalog.SetStatus(httpapi.Status{Stale:true}, false)
		return err
	}
	status, err := s.client.Status(ctx)
	if err != nil {
		s.catalog.SetStatus(httpapi.Status{Stale:true}, false)
		return err
	}
	p, err := s.client.Snapshot(ctx)
	if err != nil {
		s.catalog.SetStatus(httpapi.Status{Stale:true}, false)
		return err
	}
	provenance := model.ProvenanceFromIndexer(p)
	derived, err := metrics.BuildNetworkMetrics(metrics.NetworkInput{Status:status}, provenance)
	if err != nil {
		s.catalog.SetStatus(httpapi.Status{Stale:true}, false)
		return err
	}
	snapshot, err := model.NewSnapshot(p.IndexedAt, provenance, derived)
	if err != nil {
		s.catalog.SetStatus(httpapi.Status{Stale:true}, false)
		return err
	}
	snapshots, _, err := finality.Reconcile(s.catalog.Snapshots(), snapshot)
	if err != nil {
		s.catalog.SetStatus(httpapi.Status{Stale:true}, false)
		return err
	}
	st := httpapi.Status{
		ChainID:p.ChainID, IndexedHeight:p.IndexedHeight, SafeHeight:p.SafeHeight,
		IndexedAt:p.IndexedAt, Stale:stale(p.IndexedAt, s.now(), s.staleAfter), Canonical:false,
	}
	s.catalog.Replace(derived, snapshots, nil, nil, nil)
	s.catalog.SetStatus(st, !st.Stale)
	return nil
}

func (s *Service) RunRefreshLoop(ctx context.Context, interval time.Duration) {
	if interval <= 0 { interval = 15*time.Second }
	_ = s.Refresh(ctx)
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done(): return
		case <-ticker.C: _ = s.Refresh(ctx)
		}
	}
}

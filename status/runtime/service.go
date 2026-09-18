package runtime

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"sync/atomic"
	"time"
)

type IndexerProbe interface {
	ChainID(context.Context) (uint64, error)
	Ready(context.Context) error
	ObservedAt(context.Context) (time.Time, error)
}

type Service struct {
	cfg Config
	probe IndexerProbe
	ready atomic.Bool
	observedUnix atomic.Int64
}

func NewService(cfg Config, probe IndexerProbe) (*Service, error) {
	if err := cfg.Validate(); err != nil { return nil, err }
	if probe == nil { return nil, errors.New("indexer probe is required") }
	return &Service{cfg: cfg, probe: probe}, nil
}

func (s *Service) Qualify(ctx context.Context, now time.Time) error {
	if now.IsZero() { return errors.New("qualification time is required") }
	actualChainID, err := s.probe.ChainID(ctx)
	if err != nil { s.ready.Store(false); return fmt.Errorf("indexer chain identity unavailable: %w", err) }
	if actualChainID != s.cfg.ChainID { s.ready.Store(false); return fmt.Errorf("wrong chain: configured=%d actual=%d", s.cfg.ChainID, actualChainID) }
	if err := s.probe.Ready(ctx); err != nil { s.ready.Store(false); return fmt.Errorf("indexer status boundary unavailable: %w", err) }
	observedAt, err := s.probe.ObservedAt(ctx)
	if err != nil { s.ready.Store(false); return fmt.Errorf("indexer evidence time unavailable: %w", err) }
	if observedAt.IsZero() || observedAt.After(now.Add(time.Second)) || now.Sub(observedAt) > s.cfg.MaxEvidenceAge {
		s.ready.Store(false)
		return fmt.Errorf("indexer evidence is stale or invalid: observed_at=%s", observedAt.UTC().Format(time.RFC3339))
	}
	s.observedUnix.Store(observedAt.Unix())
	s.ready.Store(true)
	return nil
}

func (s *Service) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, map[string]any{"service":"420Status","status":"ok","canonical":false,"authority":"observational"})
	})
	mux.HandleFunc("GET /readyz", func(w http.ResponseWriter, _ *http.Request) {
		if !s.ready.Load() {
			writeJSON(w, http.StatusServiceUnavailable, map[string]any{"service":"420Status","ready":false,"canonical":false})
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"service":"420Status","ready":true,"canonical":false,"evidence_observed_at":time.Unix(s.observedUnix.Load(),0).UTC().Format(time.RFC3339)})
	})
	return mux
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

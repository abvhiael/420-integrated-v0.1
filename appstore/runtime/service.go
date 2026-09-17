package runtime

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"sync/atomic"
)

type ChainProbe interface {
	ChainID(context.Context) (uint64, error)
	RegistryAvailable(context.Context) error
}

type Service struct {
	cfg   Config
	probe ChainProbe
	ready atomic.Bool
}

func NewService(cfg Config, probe ChainProbe) (*Service, error) {
	if err := cfg.Validate(); err != nil {
		return nil, err
	}
	if probe == nil {
		return nil, errors.New("chain probe is required")
	}
	return &Service{cfg: cfg, probe: probe}, nil
}

func (s *Service) Qualify(ctx context.Context) error {
	actualChainID, err := s.probe.ChainID(ctx)
	if err != nil {
		s.ready.Store(false)
		return fmt.Errorf("canonical chain id unavailable: %w", err)
	}
	if actualChainID != s.cfg.ChainID {
		s.ready.Store(false)
		return fmt.Errorf("wrong chain: configured=%d actual=%d", s.cfg.ChainID, actualChainID)
	}
	if err := s.probe.RegistryAvailable(ctx); err != nil {
		s.ready.Store(false)
		return fmt.Errorf("canonical registry unavailable: %w", err)
	}
	s.ready.Store(true)
	return nil
}

func (s *Service) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, map[string]any{
			"service":   "420AppStore",
			"status":    "ok",
			"canonical": false,
		})
	})
	mux.HandleFunc("GET /readyz", func(w http.ResponseWriter, _ *http.Request) {
		if !s.ready.Load() {
			writeJSON(w, http.StatusServiceUnavailable, map[string]any{
				"service": "420AppStore",
				"ready":   false,
			})
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"service": "420AppStore",
			"ready":   true,
		})
	})
	return mux
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

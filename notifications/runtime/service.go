package runtime

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"sync/atomic"

 "github.com/420integrated/420-integrated/notifications/betconsent"
)

type IndexerProbe interface {
	ChainID(context.Context) (uint64, error)
	Ready(context.Context) error
}

type Service struct {
	cfg   Config
	probe IndexerProbe
	ready atomic.Bool
 consent http.Handler
}

func NewService(cfg Config, probe IndexerProbe) (*Service, error) {
	if err := cfg.Validate(); err != nil {
		return nil, err
	}
	if probe == nil {
		return nil, errors.New("indexer probe is required")
	}
	return &Service{cfg: cfg, probe: probe}, nil
}

func (s *Service) Qualify(ctx context.Context) error {
	actualChainID, err := s.probe.ChainID(ctx)
	if err != nil {
		s.ready.Store(false)
		return fmt.Errorf("indexer chain identity unavailable: %w", err)
	}
	if actualChainID != s.cfg.ChainID {
		s.ready.Store(false)
		return fmt.Errorf("wrong chain: configured=%d actual=%d", s.cfg.ChainID, actualChainID)
	}
	if err := s.probe.Ready(ctx); err != nil {
		s.ready.Store(false)
		return fmt.Errorf("indexer notification boundary unavailable: %w", err)
	}
	s.ready.Store(true)
	return nil
}

// EnableBetConsent installs the private HTTP boundary; absent configuration leaves it disabled.
func (s *Service) EnableBetConsent(store *betconsent.Store, token string) error {
 handler,err:=betconsent.Handler(store,token)
 if err!=nil{return err}
 s.consent=handler
 return nil
}

func (s *Service) Handler() http.Handler {
	mux := http.NewServeMux()
 if s.consent!=nil {mux.Handle("/v1/420bet/subscriptions/",s.consent)}
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, map[string]any{
			"service":   "420Notifications",
			"status":    "ok",
			"canonical": false,
		})
	})
	mux.HandleFunc("GET /readyz", func(w http.ResponseWriter, _ *http.Request) {
		if !s.ready.Load() {
			writeJSON(w, http.StatusServiceUnavailable, map[string]any{
				"service": "420Notifications",
				"ready":   false,
			})
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"service": "420Notifications",
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

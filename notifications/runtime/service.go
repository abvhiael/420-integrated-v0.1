package runtime

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"sync/atomic"
)

type IndexerProbe interface {
	ChainID(context.Context) (uint64, error)
	Ready(context.Context) error
}

type Service struct {
	cfg   Config
	probe IndexerProbe
	ready atomic.Bool
 deliveryAPI *DeliveryAPI
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

// ConfigureDeliveryAPI is startup-only. A nil or unqualified API is never mounted.
func (s *Service) ConfigureDeliveryAPI(api *DeliveryAPI) error {
 if api==nil { return errors.New("qualified delivery API required") }
 if s.deliveryAPI!=nil { return errors.New("delivery API already configured") }
 s.deliveryAPI=api
 return nil
}
func (s *Service) Handler() http.Handler {
	mux := http.NewServeMux()
 if s.deliveryAPI!=nil {
  mux.Handle("/v1/deliveries",s.readyDeliveryHandler())
  mux.Handle("/v1/deliveries/",s.readyDeliveryHandler())
 }
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

func (s *Service) readyDeliveryHandler() http.Handler {
 return http.HandlerFunc(func(w http.ResponseWriter,r *http.Request){
  if !s.ready.Load(){
   apiReply(w,http.StatusServiceUnavailable,map[string]string{"error":"not_ready"})
   return
  }
  s.deliveryAPI.ServeHTTP(w,r)
 })
}

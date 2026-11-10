package runtime

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"sync/atomic"

 "github.com/420integrated/420-integrated/notifications/betconsent"
 "github.com/420integrated/420-integrated/notifications/betdelivery"
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
 enrollment http.Handler
 delivery http.Handler
 providerReceipts http.Handler
 routes http.Handler
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
func (s *Service) EnableBetConsent(store *betconsent.Store, readToken,writeToken string) error {
 handler,err:=betconsent.Handler(store,readToken,writeToken)
 if err!=nil{return err}
 s.consent=handler
 return nil
}

func (s *Service) EnableBetEnrollment(store *betconsent.Store,token,sharedKey string)error{
 handler,err:=betconsent.EnrollmentHandler(store,token,sharedKey)
 if err!=nil{return err}
 s.enrollment=handler
 return nil
}
func (s *Service) EnableBetRoutes(store *betconsent.Store,
 readToken,providerToken,providerKey string)error{
 handler,err:=betconsent.RouteHandler(store,readToken,providerToken,providerKey)
 if err!=nil{return err}
 store.RequireRoutes()
 s.routes=handler
 return nil
}
func (s *Service) EnableBetProviderReceipts(store *betdelivery.Store,consent *betconsent.Store,token,secret string)error{
 handler,err:=betdelivery.ProviderReceiptHandler(store,consent,token,secret)
 if err!=nil{return err}
 s.providerReceipts=handler
 return nil
}
func (s *Service) EnableBetDelivery(store *betdelivery.Store,consent *betconsent.Store,token string)error{
 handler,err:=betdelivery.Handler(store,consent,token)
 if err!=nil{return err}
 s.delivery=handler
 return nil
}
func (s *Service) Handler() http.Handler {
	mux := http.NewServeMux()
 if s.consent!=nil {mux.Handle("/v1/420bet/subscriptions/",s.consent)}
 if s.enrollment!=nil {mux.Handle("/v1/420bet/enrollments/",s.enrollment)}
 if s.routes!=nil {mux.Handle("/v1/420bet/routes/",s.routes)}
 if s.delivery!=nil {mux.Handle("/v1/420bet/deliveries/",s.delivery)}
 if s.providerReceipts!=nil {mux.Handle("/v1/420bet/provider-receipts/",s.providerReceipts)}
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

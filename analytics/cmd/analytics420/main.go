package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/420integrated/420-integrated/analytics/httpapi"
	"github.com/420integrated/420-integrated/analytics/indexerclient"
	analyticsruntime "github.com/420integrated/420-integrated/analytics/runtime"
)

type config struct {
	ListenAddr      string
	IndexerURL      string
	RequiredChainID uint64
	StaleAfter      time.Duration
	IndexerTimeout  time.Duration
	RefreshInterval time.Duration
	ShutdownTimeout time.Duration
}

type startup struct {
	Service               string `json:"service"`
	Phase                 string `json:"phase"`
	Runtime               string `json:"runtime"`
	ListenAddr            string `json:"listenAddr"`
	IndexerConfigured     bool   `json:"indexerConfigured"`
	RequiredChainID       uint64 `json:"requiredChainId"`
	CanonicalAuthority    bool   `json:"canonicalAuthority"`
	DirectRPC             bool   `json:"directRpc"`
	ConsumerQualification string `json:"consumerQualification"`
}

func main() {
	cfg, err := loadConfig(os.Getenv)
	if err != nil { fatal(err) }
	server, service, err := newHTTPServer(cfg)
	if err != nil { fatal(err) }

	encoded, _ := json.Marshal(startup{
		Service:"420Analytics", Phase:"ANALYTICS-8", Runtime:analyticsruntime.RuntimeVersion,
		ListenAddr:cfg.ListenAddr, IndexerConfigured:cfg.IndexerURL != "", RequiredChainID:cfg.RequiredChainID,
		CanonicalAuthority:false, DirectRPC:false, ConsumerQualification:"QUALIFIED_INDEXER_API_CONSUMER",
	})
	fmt.Println(string(encoded))

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	go service.RunRefreshLoop(ctx, cfg.RefreshInterval)

	errCh := make(chan error, 1)
	go func() {
		err := server.ListenAndServe()
		if err != nil && !errors.Is(err, http.ErrServerClosed) { errCh <- err; return }
		errCh <- nil
	}()

	select {
	case err := <-errCh:
		if err != nil { fatal(err) }
	case <-ctx.Done():
		shutdownCtx, cancel := context.WithTimeout(context.Background(), cfg.ShutdownTimeout)
		defer cancel()
		if err := server.Shutdown(shutdownCtx); err != nil { fatal(fmt.Errorf("shutdown 420Analytics: %w", err)) }
		if err := <-errCh; err != nil { fatal(err) }
	}
}

func loadConfig(getenv func(string) string) (config, error) {
	cfg := config{
		ListenAddr:":8424", RequiredChainID:420, StaleAfter:2*time.Minute,
		IndexerTimeout:10*time.Second, RefreshInterval:15*time.Second, ShutdownTimeout:10*time.Second,
	}
	cfg.IndexerURL = strings.TrimSpace(getenv("ANALYTICS_INDEXER_URL"))
	if cfg.IndexerURL == "" { return config{}, errors.New("ANALYTICS_INDEXER_URL is required") }
	if value := strings.TrimSpace(getenv("ANALYTICS_LISTEN_ADDR")); value != "" { cfg.ListenAddr = value }
	if value := strings.TrimSpace(getenv("ANALYTICS_CHAIN_ID")); value != "" {
		parsed, err := strconv.ParseUint(value, 10, 64)
		if err != nil || parsed == 0 { return config{}, errors.New("ANALYTICS_CHAIN_ID must be a non-zero uint64") }
		cfg.RequiredChainID = parsed
	}
	var err error
	if cfg.StaleAfter, err = envDuration(getenv, "ANALYTICS_STALE_AFTER", cfg.StaleAfter); err != nil { return config{}, err }
	if cfg.IndexerTimeout, err = envDuration(getenv, "ANALYTICS_INDEXER_TIMEOUT", cfg.IndexerTimeout); err != nil { return config{}, err }
	if cfg.RefreshInterval, err = envDuration(getenv, "ANALYTICS_REFRESH_INTERVAL", cfg.RefreshInterval); err != nil { return config{}, err }
	if cfg.ShutdownTimeout, err = envDuration(getenv, "ANALYTICS_SHUTDOWN_TIMEOUT", cfg.ShutdownTimeout); err != nil { return config{}, err }
	return cfg, nil
}

func envDuration(getenv func(string) string, key string, fallback time.Duration) (time.Duration, error) {
	value := strings.TrimSpace(getenv(key))
	if value == "" { return fallback, nil }
	parsed, err := time.ParseDuration(value)
	if err != nil || parsed <= 0 { return 0, fmt.Errorf("%s must be a positive duration", key) }
	return parsed, nil
}

func newHTTPServer(cfg config) (*http.Server, *analyticsruntime.Service, error) {
	client, err := indexerclient.New(cfg.IndexerURL, cfg.RequiredChainID, cfg.IndexerTimeout, cfg.StaleAfter)
	if err != nil { return nil, nil, err }
	catalog := analyticsruntime.NewCatalog()
	service, err := analyticsruntime.New(client, catalog, cfg.StaleAfter)
	if err != nil { return nil, nil, err }
	api, err := httpapi.New(catalog)
	if err != nil { return nil, nil, err }
	dashboard, err := api.DashboardHandler()
	if err != nil { return nil, nil, err }
	mux := http.NewServeMux()
	mux.Handle("/v1/", api.Handler())
	mux.Handle("/health", api.Handler())
	mux.Handle("/ready", api.Handler())
	mux.Handle("/dashboard", dashboard)
	mux.HandleFunc("GET /", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/" { http.NotFound(w, r); return }
		http.Redirect(w, r, "/dashboard", http.StatusTemporaryRedirect)
	})
	return &http.Server{
		Addr:cfg.ListenAddr, Handler:mux,
		ReadHeaderTimeout:5*time.Second, ReadTimeout:15*time.Second,
		WriteTimeout:30*time.Second, IdleTimeout:60*time.Second,
	}, service, nil
}

func fatal(err error) { fmt.Fprintln(os.Stderr, err); os.Exit(1) }

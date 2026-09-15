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

	"github.com/420integrated/420-integrated/search/httpapi"
	"github.com/420integrated/420-integrated/search/indexerclient"
	searchruntime "github.com/420integrated/420-integrated/search/runtime"
	searchweb "github.com/420integrated/420-integrated/search/web"
)

type config struct {
	ListenAddr string
	IndexerURL string
	RequiredChainID uint64
	StaleAfter time.Duration
	IndexerTimeout time.Duration
	ShutdownTimeout time.Duration
	PublicCommonsVisibility []string
}

type startup struct {
	Service string `json:"service"`
	Phase string `json:"phase"`
	Runtime string `json:"runtime"`
	ListenAddr string `json:"listenAddr"`
	IndexerConfigured bool `json:"indexerConfigured"`
	RequiredChainID uint64 `json:"requiredChainId"`
	CanonicalAuthority bool `json:"canonicalAuthority"`
	DirectRPC bool `json:"directRpc"`
	ConsumerQualification string `json:"consumerQualification"`
}

func main() {
	cfg, err := loadConfig(os.Getenv)
	if err != nil { fatal(err) }
	server, err := newHTTPServer(cfg)
	if err != nil { fatal(err) }
	encoded, _ := json.Marshal(startup{
		Service:"420Search", Phase:"SEARCH-8", Runtime:searchruntime.RuntimeVersion,
		ListenAddr:cfg.ListenAddr, IndexerConfigured:cfg.IndexerURL != "", RequiredChainID:cfg.RequiredChainID,
		CanonicalAuthority:false, DirectRPC:false, ConsumerQualification:"QUALIFIED_INDEXER_API_CONSUMER",
	})
	fmt.Println(string(encoded))

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
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
		if err := server.Shutdown(shutdownCtx); err != nil { fatal(fmt.Errorf("shutdown 420Search: %w", err)) }
		if err := <-errCh; err != nil { fatal(err) }
	}
}

func loadConfig(getenv func(string) string) (config, error) {
	cfg := config{
		ListenAddr:":8421", RequiredChainID:420, StaleAfter:2*time.Minute,
		IndexerTimeout:10*time.Second, ShutdownTimeout:10*time.Second,
		PublicCommonsVisibility:[]string{"public"},
	}
	cfg.IndexerURL = strings.TrimSpace(getenv("SEARCH_INDEXER_URL"))
	if cfg.IndexerURL == "" { return config{}, errors.New("SEARCH_INDEXER_URL is required") }
	if value := strings.TrimSpace(getenv("SEARCH_LISTEN_ADDR")); value != "" { cfg.ListenAddr = value }
	if value := strings.TrimSpace(getenv("SEARCH_CHAIN_ID")); value != "" {
		parsed, err := strconv.ParseUint(value, 10, 64)
		if err != nil || parsed == 0 { return config{}, errors.New("SEARCH_CHAIN_ID must be a non-zero uint64") }
		cfg.RequiredChainID = parsed
	}
	var err error
	if cfg.StaleAfter, err = envDuration(getenv, "SEARCH_STALE_AFTER", cfg.StaleAfter); err != nil { return config{}, err }
	if cfg.IndexerTimeout, err = envDuration(getenv, "SEARCH_INDEXER_TIMEOUT", cfg.IndexerTimeout); err != nil { return config{}, err }
	if cfg.ShutdownTimeout, err = envDuration(getenv, "SEARCH_SHUTDOWN_TIMEOUT", cfg.ShutdownTimeout); err != nil { return config{}, err }
	if value := strings.TrimSpace(getenv("SEARCH_PUBLIC_COMMONS_VISIBILITY")); value != "" {
		cfg.PublicCommonsVisibility = splitCSV(value)
		if len(cfg.PublicCommonsVisibility) == 0 { return config{}, errors.New("SEARCH_PUBLIC_COMMONS_VISIBILITY must contain at least one visibility") }
	}
	return cfg, nil
}

func envDuration(getenv func(string) string, key string, fallback time.Duration) (time.Duration, error) {
	value := strings.TrimSpace(getenv(key))
	if value == "" { return fallback, nil }
	parsed, err := time.ParseDuration(value)
	if err != nil || parsed <= 0 { return 0, fmt.Errorf("%s must be a positive duration", key) }
	return parsed, nil
}

func splitCSV(value string) []string {
	seen := map[string]struct{}{}
	out := []string{}
	for _, token := range strings.Split(value, ",") {
		token = strings.ToLower(strings.TrimSpace(token))
		if token == "" { continue }
		if _, ok := seen[token]; ok { continue }
		seen[token] = struct{}{}
		out = append(out, token)
	}
	return out
}

func newHTTPServer(cfg config) (*http.Server, error) {
	client, err := indexerclient.New(cfg.IndexerURL, cfg.RequiredChainID, cfg.IndexerTimeout, cfg.StaleAfter)
	if err != nil { return nil, err }
	service, err := searchruntime.New(client, cfg.PublicCommonsVisibility)
	if err != nil { return nil, err }
	api, err := httpapi.New(service)
	if err != nil { return nil, err }
	mux := http.NewServeMux()
	mux.Handle("/v1/", api)
	mux.Handle("/", searchweb.Handler())
	return &http.Server{
		Addr:cfg.ListenAddr, Handler:mux,
		ReadHeaderTimeout:5*time.Second, ReadTimeout:15*time.Second,
		WriteTimeout:30*time.Second, IdleTimeout:60*time.Second,
	}, nil
}

func fatal(err error) { fmt.Fprintln(os.Stderr, err); os.Exit(1) }

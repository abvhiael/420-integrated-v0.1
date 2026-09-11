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

	explorerapi "github.com/420integrated/420-integrated/explorer/api"
	"github.com/420integrated/420-integrated/explorer/indexerclient"
	explorerservice "github.com/420integrated/420-integrated/explorer/service"
)

type config struct {
	ListenAddr      string
	IndexerURL      string
	RequiredChainID uint64
	StaleAfter      time.Duration
	IndexerTimeout  time.Duration
	ShutdownTimeout time.Duration
}

type startup struct {
	Service               string `json:"service"`
	Phase                 string `json:"phase"`
	ListenAddr            string `json:"listenAddr"`
	IndexerConfigured     bool   `json:"indexerConfigured"`
	RequiredChainID       uint64 `json:"requiredChainId"`
	CanonicalAuthority    bool   `json:"canonicalAuthority"`
	ConsumerQualification string `json:"consumerQualification"`
}

func main() {
	cfg, err := loadConfig(os.Getenv)
	if err != nil {
		fatal(err)
	}
	server, err := newHTTPServer(cfg)
	if err != nil {
		fatal(err)
	}
	encoded, _ := json.Marshal(startup{
		Service:               "420Explorer",
		Phase:                 "EXP-6.2",
		ListenAddr:            cfg.ListenAddr,
		IndexerConfigured:     cfg.IndexerURL != "",
		RequiredChainID:       cfg.RequiredChainID,
		CanonicalAuthority:    false,
		ConsumerQualification: "QUALIFIED_INDEXER_API_CONSUMER",
	})
	fmt.Println(string(encoded))

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	errCh := make(chan error, 1)
	go func() {
		err := server.ListenAndServe()
		if err != nil && !errors.Is(err, http.ErrServerClosed) {
			errCh <- err
			return
		}
		errCh <- nil
	}()

	select {
	case err := <-errCh:
		if err != nil {
			fatal(err)
		}
	case <-ctx.Done():
		shutdownCtx, cancel := context.WithTimeout(context.Background(), cfg.ShutdownTimeout)
		defer cancel()
		if err := server.Shutdown(shutdownCtx); err != nil {
			fatal(fmt.Errorf("shutdown 420Explorer: %w", err))
		}
		if err := <-errCh; err != nil {
			fatal(err)
		}
	}
}

func loadConfig(getenv func(string) string) (config, error) {
	cfg := config{
		ListenAddr:      ":8420",
		RequiredChainID: 420,
		StaleAfter:      2 * time.Minute,
		IndexerTimeout:  10 * time.Second,
		ShutdownTimeout: 10 * time.Second,
	}
	cfg.IndexerURL = strings.TrimSpace(getenv("EXPLORER_INDEXER_URL"))
	if cfg.IndexerURL == "" {
		return config{}, errors.New("EXPLORER_INDEXER_URL is required")
	}
	if value := strings.TrimSpace(getenv("EXPLORER_LISTEN_ADDR")); value != "" {
		cfg.ListenAddr = value
	}
	if value := strings.TrimSpace(getenv("EXPLORER_CHAIN_ID")); value != "" {
		parsed, err := strconv.ParseUint(value, 10, 64)
		if err != nil || parsed == 0 {
			return config{}, errors.New("EXPLORER_CHAIN_ID must be a non-zero uint64")
		}
		cfg.RequiredChainID = parsed
	}
	var err error
	if cfg.StaleAfter, err = envDuration(getenv, "EXPLORER_STALE_AFTER", cfg.StaleAfter); err != nil {
		return config{}, err
	}
	if cfg.IndexerTimeout, err = envDuration(getenv, "EXPLORER_INDEXER_TIMEOUT", cfg.IndexerTimeout); err != nil {
		return config{}, err
	}
	if cfg.ShutdownTimeout, err = envDuration(getenv, "EXPLORER_SHUTDOWN_TIMEOUT", cfg.ShutdownTimeout); err != nil {
		return config{}, err
	}
	return cfg, nil
}

func envDuration(getenv func(string) string, key string, fallback time.Duration) (time.Duration, error) {
	value := strings.TrimSpace(getenv(key))
	if value == "" {
		return fallback, nil
	}
	parsed, err := time.ParseDuration(value)
	if err != nil || parsed <= 0 {
		return 0, fmt.Errorf("%s must be a positive duration", key)
	}
	return parsed, nil
}

func newHTTPServer(cfg config) (*http.Server, error) {
	client, err := indexerclient.New(cfg.IndexerURL, cfg.IndexerTimeout)
	if err != nil {
		return nil, err
	}
	svc, err := explorerservice.New(client, cfg.RequiredChainID, cfg.StaleAfter)
	if err != nil {
		return nil, err
	}
	apiServer, err := explorerapi.NewServer(svc)
	if err != nil {
		return nil, err
	}
	return &http.Server{
		Addr:              cfg.ListenAddr,
		Handler:           apiServer.Handler(),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       60 * time.Second,
	}, nil
}

func fatal(err error) {
	fmt.Fprintln(os.Stderr, err)
	os.Exit(1)
}

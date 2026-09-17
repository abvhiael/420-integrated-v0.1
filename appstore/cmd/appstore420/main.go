package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"syscall"
	"time"

	appstoreruntime "github.com/420integrated/420-integrated/appstore/runtime"
)

func main() {
	cfg, err := loadConfig(os.Getenv)
	if err != nil { fatal(err) }
	probe := appstoreruntime.NewRPCProbe(cfg)
	service, err := appstoreruntime.NewService(cfg, probe)
	if err != nil { fatal(err) }

	qualifyCtx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	if err := service.Qualify(qualifyCtx); err != nil {
		cancel()
		fatal(err)
	}
	cancel()

	server := &http.Server{Addr: cfg.ListenAddr, Handler: service.Handler(), ReadHeaderTimeout: 5 * time.Second}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	errCh := make(chan error, 1)
	go func() { errCh <- server.ListenAndServe() }()

	select {
	case err := <-errCh:
		if err != nil && err != http.ErrServerClosed { fatal(err) }
	case <-ctx.Done():
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		if err := server.Shutdown(shutdownCtx); err != nil { fatal(err) }
	}
}

func loadConfig(getenv func(string) string) (appstoreruntime.Config, error) {
	chainID := uint64(420)
	if raw := strings.TrimSpace(getenv("APPSTORE_CHAIN_ID")); raw != "" {
		v, err := strconv.ParseUint(raw, 10, 64)
		if err != nil || v == 0 { return appstoreruntime.Config{}, fmt.Errorf("APPSTORE_CHAIN_ID must be a non-zero uint64") }
		chainID = v
	}
	cfg := appstoreruntime.Config{
		ChainID: chainID,
		RPCURL: strings.TrimSpace(getenv("APPSTORE_RPC_URL")),
		RegistryAddress: strings.TrimSpace(getenv("APPSTORE_REGISTRY_ADDRESS")),
		CatalogueStore: strings.TrimSpace(getenv("APPSTORE_CATALOGUE_STORE")),
		ListenAddr: strings.TrimSpace(getenv("APPSTORE_LISTEN_ADDR")),
	}
	if cfg.ListenAddr == "" { cfg.ListenAddr = ":8426" }
	if err := cfg.Validate(); err != nil { return appstoreruntime.Config{}, err }
	return cfg, nil
}

func fatal(err error) { fmt.Fprintln(os.Stderr, err); os.Exit(1) }

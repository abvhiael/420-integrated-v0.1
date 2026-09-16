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

	verifyruntime "github.com/420integrated/420-integrated/verify/runtime"
)

func main() {
	cfg, err := loadConfig(os.Getenv); if err != nil { fatal(err) }
	probe := verifyruntime.NewRPCProbe(cfg)
	service, err := verifyruntime.NewService(cfg, probe); if err != nil { fatal(err) }
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	if err := service.Qualify(ctx); err != nil { cancel(); fatal(err) }
	cancel()

	server := &http.Server{Addr: cfg.ListenAddr, Handler: service.Handler(), ReadHeaderTimeout: 5*time.Second}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM); defer stop()
	errCh := make(chan error, 1)
	go func() { errCh <- server.ListenAndServe() }()
	select {
	case err := <-errCh:
		if err != nil && err != http.ErrServerClosed { fatal(err) }
	case <-ctx.Done():
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second); defer cancel()
		if err := server.Shutdown(shutdownCtx); err != nil { fatal(err) }
	}
}

func loadConfig(getenv func(string) string) (verifyruntime.Config, error) {
	chainID := uint64(420)
	if raw := strings.TrimSpace(getenv("VERIFY_CHAIN_ID")); raw != "" {
		v, err := strconv.ParseUint(raw, 10, 64); if err != nil || v == 0 { return verifyruntime.Config{}, fmt.Errorf("VERIFY_CHAIN_ID must be a non-zero uint64") }; chainID = v
	}
	cfg := verifyruntime.Config{
		ChainID: chainID,
		RPCURL: strings.TrimSpace(getenv("VERIFY_RPC_URL")),
		ReadinessAddress: strings.TrimSpace(getenv("VERIFY_READINESS_ADDRESS")),
		CompilerCache: strings.TrimSpace(getenv("VERIFY_COMPILER_CACHE")),
		EvidenceStore: strings.TrimSpace(getenv("VERIFY_EVIDENCE_STORE")),
		ListenAddr: strings.TrimSpace(getenv("VERIFY_LISTEN_ADDR")),
	}
	if cfg.ListenAddr == "" { cfg.ListenAddr = ":8425" }
	if err := cfg.Validate(); err != nil { return verifyruntime.Config{}, err }
	return cfg, nil
}

func fatal(err error) { fmt.Fprintln(os.Stderr, err); os.Exit(1) }

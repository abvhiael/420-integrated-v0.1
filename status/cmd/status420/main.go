package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"syscall"
	"time"

	runtime420 "github.com/420integrated/420-integrated/status/runtime"
)

func main() {
	cfg := runtime420.Config{
		ChainID:        mustUint64("STATUS_CHAIN_ID"),
		IndexerURL:     os.Getenv("STATUS_INDEXER_URL"),
		ListenAddr:     envOr("STATUS_LISTEN_ADDR", ":8422"),
		RequestTimeout: mustDurationOr("STATUS_REQUEST_TIMEOUT", 5*time.Second),
		MaxEvidenceAge: mustDurationOr("STATUS_MAX_EVIDENCE_AGE", 2*time.Minute),
	}
	probe, err := runtime420.NewHTTPIndexerProbe(cfg.IndexerURL, cfg.RequestTimeout)
	if err != nil { log.Fatal(err) }
	svc, err := runtime420.NewService(cfg, probe)
	if err != nil { log.Fatal(err) }
	ctx, cancel := context.WithTimeout(context.Background(), cfg.RequestTimeout)
	if err := svc.Qualify(ctx, time.Now().UTC()); err != nil { cancel(); log.Fatal(err) }
	cancel()

	server := &http.Server{Addr: cfg.ListenAddr, Handler: svc.Handler(), ReadHeaderTimeout: 5 * time.Second}
	errCh := make(chan error, 1)
	go func(){ errCh <- server.ListenAndServe() }()

	sig := make(chan os.Signal, 1)
	signal.Notify(sig, syscall.SIGINT, syscall.SIGTERM)
	select {
	case <-sig:
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = server.Shutdown(ctx)
	case err := <-errCh:
		if err != nil && err != http.ErrServerClosed { log.Fatal(err) }
	}
}

func envOr(name, fallback string) string { if v:=os.Getenv(name); v!="" { return v }; return fallback }
func mustUint64(name string) uint64 { v,err:=strconv.ParseUint(os.Getenv(name),10,64); if err!=nil || v==0 { log.Fatalf("%s must be a non-zero uint64",name) }; return v }
func mustDurationOr(name string, fallback time.Duration) time.Duration { raw:=os.Getenv(name); if raw=="" { return fallback }; d,err:=time.ParseDuration(raw); if err!=nil || d<=0 { log.Fatalf("%s must be a positive duration",name) }; return d }

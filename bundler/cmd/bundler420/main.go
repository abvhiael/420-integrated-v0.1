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

	rpcapi420 "github.com/420integrated/420-integrated/bundler/rpcapi"
	runtime420 "github.com/420integrated/420-integrated/bundler/runtime"
)

func main() {
	cfg := runtime420.Config{
		ChainID:        mustUint64("BUNDLER_CHAIN_ID"),
		ExecutionRPC:   os.Getenv("BUNDLER_EXECUTION_RPC"),
		EntryPoint:     os.Getenv("BUNDLER_ENTRY_POINT"),
		ListenAddr:     envOr("BUNDLER_LISTEN_ADDR", ":8423"),
		RequestTimeout: mustDurationOr("BUNDLER_REQUEST_TIMEOUT", 5*time.Second),
		MaxHeadAge:     mustDurationOr("BUNDLER_MAX_HEAD_AGE", 2*time.Minute),
	}

	probe, err := runtime420.NewHTTPExecutionProbe(cfg.ExecutionRPC, cfg.RequestTimeout)
	if err != nil { log.Fatal(err) }
	svc, err := runtime420.NewService(cfg, probe)
	if err != nil { log.Fatal(err) }

	ctx, cancel := context.WithTimeout(context.Background(), cfg.RequestTimeout)
	if err := svc.Qualify(ctx, time.Now().UTC()); err != nil {
		cancel()
		log.Fatal(err)
	}
	cancel()

	rpcHandler, err := rpcapi420.NewHandler(rpcapi420.BoundaryBackend{EntryPoint: cfg.EntryPoint})
	if err != nil { log.Fatal(err) }
	runtimeHandler := svc.Handler()
	mux := http.NewServeMux()
	mux.Handle("/healthz", runtimeHandler)
	mux.Handle("/readyz", runtimeHandler)
	mux.Handle("/", rpcHandler)

	server := &http.Server{
		Addr: cfg.ListenAddr,
		Handler: mux,
		ReadHeaderTimeout: 5*time.Second,
	}
	errCh := make(chan error,1)
	go func(){ errCh <- server.ListenAndServe() }()

	sig := make(chan os.Signal,1)
	signal.Notify(sig,syscall.SIGINT,syscall.SIGTERM)
	select {
	case <-sig:
		ctx,cancel:=context.WithTimeout(context.Background(),5*time.Second)
		defer cancel()
		_ = server.Shutdown(ctx)
	case err := <-errCh:
		if err != nil && err != http.ErrServerClosed { log.Fatal(err) }
	}
}

func envOr(name,fallback string) string {
	if v:=os.Getenv(name); v!="" { return v }
	return fallback
}

func mustUint64(name string) uint64 {
	v,err:=strconv.ParseUint(os.Getenv(name),10,64)
	if err!=nil || v==0 { log.Fatalf("%s must be a non-zero uint64",name) }
	return v
}

func mustDurationOr(name string,fallback time.Duration) time.Duration {
	raw:=os.Getenv(name)
	if raw=="" { return fallback }
	d,err:=time.ParseDuration(raw)
	if err!=nil || d<=0 { log.Fatalf("%s must be a positive duration",name) }
	return d
}

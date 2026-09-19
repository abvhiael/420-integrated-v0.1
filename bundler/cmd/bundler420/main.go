package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"syscall"
	"time"

	bundle420 "github.com/420integrated/420-integrated/bundler/bundle"
	gasestimation420 "github.com/420integrated/420-integrated/bundler/gasestimation"
	lifecycle420 "github.com/420integrated/420-integrated/bundler/lifecycle"
	peer420 "github.com/420integrated/420-integrated/bundler/peer"
	reputation420 "github.com/420integrated/420-integrated/bundler/reputation"
	mempool420 "github.com/420integrated/420-integrated/bundler/mempool"
	rpcapi420 "github.com/420integrated/420-integrated/bundler/rpcapi"
	runtime420 "github.com/420integrated/420-integrated/bundler/runtime"
	simulation420 "github.com/420integrated/420-integrated/bundler/simulation"
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

	simulator, err := simulation420.NewRPCSimulator(cfg.ExecutionRPC, cfg.RequestTimeout)
	if err != nil { log.Fatal(err) }
	validationEngine, err := simulation420.NewEngine(cfg.ChainID, cfg.EntryPoint, cfg.MaxHeadAge, simulator)
	if err != nil { log.Fatal(err) }
	pool, err := mempool420.New(mempool420.Config{
		MaxOperations: mustIntOr("BUNDLER_MEMPOOL_MAX_OPERATIONS", 4096),
		MaxPerSender: mustIntOr("BUNDLER_MEMPOOL_MAX_PER_SENDER", 16),
		TTL: mustDurationOr("BUNDLER_MEMPOOL_TTL", 10*time.Minute),
	})
	if err != nil { log.Fatal(err) }
	submitter, err := bundle420.NewRPCSubmitter(
		cfg.ExecutionRPC,
		os.Getenv("BUNDLER_SUBMITTER"),
		cfg.RequestTimeout,
	)
	if err != nil { log.Fatal(err) }
	bundleBuilder, err := bundle420.New(bundle420.Config{
		EntryPoint: cfg.EntryPoint,
		MaxOperations: mustIntOr("BUNDLER_BUNDLE_MAX_OPERATIONS", 16),
	}, pool, validationEngine, submitter)
	if err != nil { log.Fatal(err) }
	lifecycleStore := lifecycle420.NewStore()
	bundleBuilder.SetSubmissionRecorder(lifecycleStore)
	lifecycleTracker, err := lifecycle420.NewRPC(cfg.ExecutionRPC, cfg.RequestTimeout, lifecycleStore)
	if err != nil { log.Fatal(err) }

	reputationGuard, err := reputation420.New(reputation420.Config{
		Window: mustDurationOr("BUNDLER_REPUTATION_WINDOW", time.Minute),
		MaxRequestsPerSource: mustIntOr("BUNDLER_REPUTATION_MAX_REQUESTS_PER_SOURCE", 120),
		MaxFailuresPerSource: mustIntOr("BUNDLER_REPUTATION_MAX_FAILURES_PER_SOURCE", 20),
		MaxRequestsPerSender: mustIntOr("BUNDLER_REPUTATION_MAX_REQUESTS_PER_SENDER", 60),
		Backoff: mustDurationOr("BUNDLER_REPUTATION_BACKOFF", 5*time.Minute),
		MaxEntries: mustIntOr("BUNDLER_REPUTATION_MAX_ENTRIES", 8192),
	})
	if err != nil { log.Fatal(err) }
	peerHandler, err := peer420.NewHandler(cfg.ChainID, cfg.EntryPoint, validationEngine, pool)
	if err != nil { log.Fatal(err) }
	peerHandler.SetGuard(reputationGuard)
	peerBroadcaster, err := peer420.NewBroadcaster(
		cfg.ChainID,
		cfg.EntryPoint,
		csvEnv("BUNDLER_PEERS"),
		cfg.RequestTimeout,
	)
	if err != nil { log.Fatal(err) }
	gasEstimator, err := gasestimation420.NewRPC(
		cfg.ExecutionRPC,
		os.Getenv("BUNDLER_SUBMITTER"),
		cfg.RequestTimeout,
	)
	if err != nil { log.Fatal(err) }
	rpcHandler, err := rpcapi420.NewHandler(rpcapi420.BoundaryBackend{
		EntryPoint: cfg.EntryPoint,
		Validator: validationEngine,
		Mempool: pool,
		GasEstimator: gasEstimator,
		Lifecycle: lifecycleTracker,
		Propagator: peerBroadcaster,
	})
	if err != nil { log.Fatal(err) }
	runtimeHandler := svc.Handler()
	mux := http.NewServeMux()
	mux.Handle("/healthz", runtimeHandler)
	mux.Handle("/readyz", runtimeHandler)
	mux.Handle("/peer/v1/user-operation", peerHandler)
	mux.Handle("/", rpcHandler)

	server := &http.Server{
		Addr: cfg.ListenAddr,
		Handler: mux,
		ReadHeaderTimeout: 5*time.Second,
	}
	errCh := make(chan error,1)
	go func(){ errCh <- server.ListenAndServe() }()

	bundleCtx,bundleCancel:=context.WithCancel(context.Background())
	defer bundleCancel()
	go runBundleLoop(
		bundleCtx,
		bundleBuilder,
		mustDurationOr("BUNDLER_BUNDLE_INTERVAL",2*time.Second),
		cfg.RequestTimeout,
	)

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


func mustIntOr(name string,fallback int) int {
	raw:=os.Getenv(name)
	if raw=="" { return fallback }
	v,err:=strconv.Atoi(raw)
	if err!=nil || v<=0 { log.Fatalf("%s must be a positive integer",name) }
	return v
}


type bundleSubmitter interface {
	SubmitNext(context.Context,time.Time)(bundle420.Result,error)
}

func runBundleLoop(ctx context.Context,builder bundleSubmitter,interval,timeout time.Duration) {
	ticker:=time.NewTicker(interval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case now:=<-ticker.C:
			runCtx,cancel:=context.WithTimeout(ctx,timeout)
			result,err:=builder.SubmitNext(runCtx,now.UTC())
			cancel()
			if err!=nil {
				log.Printf("bundler submission cycle failed: %v",err)
				continue
			}
			if result.Selected>0 {
				log.Printf("bundler submission cycle selected=%d submitted=%d rejected=%d failed=%d",
					result.Selected,len(result.Submitted),len(result.Rejected),len(result.Failed))
			}
		}
	}
}


func csvEnv(name string) []string {
	raw:=strings.TrimSpace(os.Getenv(name))
	if raw=="" { return nil }
	parts:=strings.Split(raw,",")
	out:=make([]string,0,len(parts))
	for _,part:=range parts {
		if v:=strings.TrimSpace(part); v!="" { out=append(out,v) }
	}
	return out
}

package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"syscall"
	"time"

	statusapi "github.com/420integrated/420-integrated/status/api"
	"github.com/420integrated/420-integrated/status/components"
	"github.com/420integrated/420-integrated/status/evidence"
	"github.com/420integrated/420-integrated/status/history"
	"github.com/420integrated/420-integrated/status/incidents"
	runtime420 "github.com/420integrated/420-integrated/status/runtime"
	statusweb "github.com/420integrated/420-integrated/status/web"
)

// indexerSource records only evidence actually observed during a successful
// chain-matched Indexer qualification. It does not claim protocol authority.
type indexerSource struct{ observation evidence.Observation }

func (s indexerSource) ID() string { return "indexer-readiness" }
func (s indexerSource) Observe(_ components.Component, _ time.Time) (evidence.Observation, error) {
	return s.observation, nil
}

func publicHandler(svc *runtime420.Service, publicAPI *statusapi.PublicAPI) http.Handler {
	mux := http.NewServeMux()
	mux.Handle("/healthz", svc.Handler())
	mux.Handle("/readyz", svc.Handler())
	mux.Handle("/v1/", publicAPI.Handler())
	mux.Handle("/", statusweb.Handler())
	return mux
}

func refreshInterval(maxAge time.Duration) time.Duration {
	interval := maxAge / 3
	if interval > 30*time.Second { interval = 30*time.Second }
	if interval < time.Millisecond { interval = time.Millisecond }
	return interval
}

func main() {
	cfg := runtime420.Config{
		ChainID: mustUint64("STATUS_CHAIN_ID"),
		IndexerURL: os.Getenv("STATUS_INDEXER_URL"),
		ListenAddr: envOr("STATUS_LISTEN_ADDR", ":8422"),
		RequestTimeout: mustDurationOr("STATUS_REQUEST_TIMEOUT", 5*time.Second),
		MaxEvidenceAge: mustDurationOr("STATUS_MAX_EVIDENCE_AGE", 2*time.Minute),
	}
	probe, err := runtime420.NewHTTPIndexerProbe(cfg.IndexerURL, cfg.RequestTimeout)
	if err != nil { log.Fatal(err) }
	svc, err := runtime420.NewService(cfg, probe)
	if err != nil { log.Fatal(err) }

	// Only configure the components we actually observe. Other service classes
	// remain unknown until their real testnet probe integrations are qualified.
	network := fmt.Sprintf("chain-%d", cfg.ChainID)
	environment := envOr("STATUS_ENVIRONMENT", "testnet")
	registry := components.NewRegistry()
	if err := registry.Register(components.Component{
		ID: "indexer", Name: "420Indexer", Class: components.ClassIndexer,
		Network: network, Environment: environment, Public: true,
	}); err != nil { log.Fatal(err) }
	ingestor, err := evidence.NewIngestor(registry, network, environment)
	if err != nil { log.Fatal(err) }
	incidentStore := incidents.NewStore()
	historyStore := history.NewStore()
	publicAPI, err := statusapi.NewPublicAPI(registry, ingestor, incidentStore, historyStore)
	if err != nil { log.Fatal(err) }

	qualify := func() {
		now := time.Now().UTC()
		ctx, cancel := context.WithTimeout(context.Background(), cfg.RequestTimeout)
		err := svc.Qualify(ctx, now)
		cancel()
		if err != nil {
			log.Printf("420Status dependency unready: %v", err)
			return
		}
		observedAt := svc.ObservedAt()
		observation := evidence.Observation{
			ComponentID: "indexer", SourceID: "indexer-readiness",
			Network: network, Environment: environment,
			State: components.HealthHealthy, Live: true, Ready: true,
			ObservedAt: observedAt, ExpiresAt: observedAt.Add(cfg.MaxEvidenceAge),
			Canonical: false,
		}
		obs, err := ingestor.Ingest("indexer", indexerSource{observation}, now)
		if err != nil {
			log.Printf("420Status Indexer observation rejected: %v", err)
			return
		}
		if err := historyStore.AppendObservation(obs, now); err != nil {
			log.Printf("420Status history append rejected: %v", err)
		}
	}

	// Preserve startup fail-closed behavior: don't listen until the initial
	// Indexer identity, readiness and fresh observation are verified.
	now := time.Now().UTC()
	ctx, cancel := context.WithTimeout(context.Background(), cfg.RequestTimeout)
	err = svc.Qualify(ctx, now)
	cancel()
	if err != nil { log.Fatal(err) }
	observedAt := svc.ObservedAt()
	initial := evidence.Observation{
		ComponentID: "indexer", SourceID: "indexer-readiness",
		Network: network, Environment: environment,
		State: components.HealthHealthy, Live: true, Ready: true,
		ObservedAt: observedAt, ExpiresAt: observedAt.Add(cfg.MaxEvidenceAge),
	}
	obs, err := ingestor.Ingest("indexer", indexerSource{initial}, now)
	if err != nil { log.Fatal(err) }
	if err := historyStore.AppendObservation(obs, now); err != nil { log.Fatal(err) }

	// Requalify throughout the service lifetime. A dependency failure clears
	// readiness immediately; independent expiry guards still fail closed if
	// this loop stops or the dependency stops providing recent timestamps.
	stop := make(chan struct{})
	defer close(stop)
	go func() {
		ticker := time.NewTicker(refreshInterval(cfg.MaxEvidenceAge))
		defer ticker.Stop()
		for {
			select {
			case <-stop: return
			case <-ticker.C: qualify()
			}
		}
	}()

	server := &http.Server{Addr: cfg.ListenAddr, Handler: publicHandler(svc, publicAPI), ReadHeaderTimeout: 5*time.Second}
	errCh := make(chan error, 1)
	go func() { errCh <- server.ListenAndServe() }()

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

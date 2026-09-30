package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/420integrated/420-integrated/indexer/api"
	"github.com/420integrated/420-integrated/indexer/decoder"
	"github.com/420integrated/420-integrated/indexer/consensusview"
	"github.com/420integrated/420-integrated/indexer/ingest"
	indexerrpc "github.com/420integrated/420-integrated/indexer/rpc"
	"github.com/420integrated/420-integrated/indexer/store"
	"github.com/420integrated/420-integrated/indexer/version"
)

const (
	defaultHTTPAddr = ":8420"
	defaultPollInterval = 12 * time.Second
	defaultMaxHeadAge = 2 * time.Minute
)

type startup struct {
	Service       string `json:"service"`
	Status        string `json:"status"`
	ChainID       uint64 `json:"chainId"`
	RPCConfigured bool   `json:"rpcConfigured"`
	StorePath     string `json:"storePath"`
	HTTPAddr      string `json:"httpAddr"`
	PollInterval  string `json:"pollInterval"`
	Rebuild       bool   `json:"rebuild"`
	ConsensusStatusPath string `json:"consensusStatusPath"`
	ConsensusQualified bool `json:"consensusQualified"`
	MaxHeadAge string `json:"maxHeadAge"`
	ExpectedGenesisHashConfigured bool `json:"expectedGenesisHashConfigured"`
}

func main() {
	if err := run(); err != nil { fatal(err) }
}

func run() error {
	rpcURL := os.Getenv("INDEXER_RPC_URL")
	if rpcURL == "" { return errors.New("INDEXER_RPC_URL is required") }

	storePath := os.Getenv("INDEXER_STORE_PATH")
	if storePath == "" { storePath = "./var/420indexer/index.json" }

	httpAddr := os.Getenv("INDEXER_HTTP_ADDR")
	if httpAddr == "" { httpAddr = defaultHTTPAddr }

	pollInterval, err := parsePollInterval(os.Getenv("INDEXER_POLL_INTERVAL"))
	if err != nil { return err }
	maxHeadAge, err := parseMaxHeadAge(os.Getenv("INDEXER_MAX_HEAD_AGE"))
	if err != nil { return err }
	expectedGenesisHash := os.Getenv("INDEXER_EXPECTED_GENESIS_HASH")

	rebuild := os.Getenv("INDEXER_REBUILD") == "1"
	consensusStatusPath := os.Getenv("INDEXER_CONSENSUS_STATUS_PATH")
	consensusProvider, err := newConsensusProvider(consensusStatusPath)
	if err != nil { return err }
	out, _ := json.Marshal(startup{
		Service: "420Indexer", Status: "EXP_1_4_RUNTIME", ChainID: 420,
		RPCConfigured: true, StorePath: storePath, HTTPAddr: httpAddr,
		PollInterval: pollInterval.String(), Rebuild: rebuild,
		ConsensusStatusPath: consensusStatusPath, ConsensusQualified: true,
		MaxHeadAge: maxHeadAge.String(), ExpectedGenesisHashConfigured: expectedGenesisHash != "",
	})
	fmt.Println(string(out))

	durable, err := store.NewFileStore(storePath)
	if err != nil { return err }
	if rebuild {
		if err := durable.Reset(); err != nil { return fmt.Errorf("reset rebuildable index: %w", err) }
	}

	client := indexerrpc.NewClient(rpcURL, 15*time.Second)
	engine := ingest.New(420, version.Schema, client, durable).WithProducerAttributor(consensusProvider)

	ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer cancel()

	// Fail closed on startup: validate runtime RPC identity/finality/freshness
	// before exposing HTTP, then complete the first deterministic catch-up.
	if _, err := indexerrpc.Validate(indexerrpc.NewQualificationSource(ctx, client, 420, version.Schema), indexerrpc.Requirements{RequiredChainID:420, ExpectedGenesisHash:expectedGenesisHash, MaxHeadAge:maxHeadAge, Now:time.Now().UTC()}); err != nil {
		return fmt.Errorf("initial runtime source qualification: %w", err)
	}
	if err := engine.CatchUp(ctx); err != nil { return fmt.Errorf("initial catch-up: %w", err) }
	registryCatalog, err := decoder.RebuildProtocolRegistryCatalog420(durable)
	if err != nil { return fmt.Errorf("initial Registry projection rebuild: %w", err) }

	runtimeHealth := api.NewRuntimeHealth()
	runtimeHealth.MarkHealthy()
	backend := api.NewStoreBackend(durable, registryCatalog).WithConsensusProvider(consensusProvider).WithRuntimeHealth(runtimeHealth)
	server := &http.Server{
		Addr:              httpAddr,
		Handler:           api.NewServer(backend).Handler(),
		ReadHeaderTimeout: 5 * time.Second,
	}

	serverErr := make(chan error, 1)
	go func() {
		err := server.ListenAndServe()
		if err != nil && !errors.Is(err, http.ErrServerClosed) { serverErr <- err }
		close(serverErr)
	}()

	ticker := time.NewTicker(pollInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			shutdownCtx, stop := context.WithTimeout(context.Background(), 10*time.Second)
			defer stop()
			return server.Shutdown(shutdownCtx)
		case err, ok := <-serverErr:
			if ok && err != nil { return fmt.Errorf("http server: %w", err) }
			return nil
		case <-ticker.C:
			if _, err := indexerrpc.Validate(indexerrpc.NewQualificationSource(ctx, client, 420, version.Schema), indexerrpc.Requirements{RequiredChainID:420, ExpectedGenesisHash:expectedGenesisHash, MaxHeadAge:maxHeadAge, Now:time.Now().UTC()}); err != nil {
				runtimeHealth.MarkFailure(runtimeRPCIssue(err))
				fmt.Fprintf(os.Stderr, "420Indexer runtime source qualification failed: %v\n", err)
				continue
			}
			if _, err := consensusProvider.Consensus(); err != nil {
				runtimeHealth.MarkFailure("CONSENSUS_PROVIDER_UNAVAILABLE")
				fmt.Fprintf(os.Stderr, "420Indexer consensus qualification failed: %v\n", err)
				continue
			}
			if err := engine.CatchUp(ctx); err != nil {
				// Preserve the last known indexed state, but explicitly degrade
				// runtime health until a subsequent qualified poll succeeds.
				runtimeHealth.MarkFailure("INGEST_CATCHUP_FAILED")
				fmt.Fprintf(os.Stderr, "420Indexer catch-up failed: %v\n", err)
				continue
			}
			registryCatalog, err := decoder.RebuildProtocolRegistryCatalog420(durable)
			if err != nil {
				runtimeHealth.MarkFailure("REGISTRY_PROJECTION_REBUILD_FAILED")
				fmt.Fprintf(os.Stderr, "420Indexer Registry projection rebuild failed: %v\n", err)
				continue
			}
			backend.ReplaceRegistryCatalog(registryCatalog)
			runtimeHealth.MarkHealthy()
		}
	}
}

func newConsensusProvider(path string) (*consensusview.Provider, error) {
	if path == "" { return nil, errors.New("INDEXER_CONSENSUS_STATUS_PATH is required") }
	provider, err := consensusview.New(path)
	if err != nil { return nil, fmt.Errorf("consensus provider: %w", err) }
	if _, err := provider.Consensus(); err != nil { return nil, fmt.Errorf("consensus provider qualification: %w", err) }
	return provider, nil
}

func runtimeRPCIssue(err error) string {
	switch {
	case errors.Is(err, indexerrpc.ErrWrongChain): return "RPC_WRONG_CHAIN"
	case errors.Is(err, indexerrpc.ErrGenesisMismatch): return "RPC_GENESIS_MISMATCH"
	case errors.Is(err, indexerrpc.ErrFinalityOrdering): return "RPC_FINALITY_DIVERGENCE"
	case errors.Is(err, indexerrpc.ErrStaleSource): return "RPC_SOURCE_STALE"
	default: return "RPC_SOURCE_INVALID"
	}
}

func parseMaxHeadAge(raw string) (time.Duration,error) {
	if raw=="" { return defaultMaxHeadAge,nil }
	d,err:=time.ParseDuration(raw)
	if err!=nil { return 0,fmt.Errorf("INDEXER_MAX_HEAD_AGE: %w",err) }
	if d<time.Second { return 0,errors.New("INDEXER_MAX_HEAD_AGE must be at least 1s") }
	return d,nil
}

func parsePollInterval(raw string) (time.Duration, error) {
	if raw == "" { return defaultPollInterval, nil }
	d, err := time.ParseDuration(raw)
	if err != nil { return 0, fmt.Errorf("INDEXER_POLL_INTERVAL: %w", err) }
	if d < time.Second { return 0, errors.New("INDEXER_POLL_INTERVAL must be at least 1s") }
	return d, nil
}

func fatal(err error) {
	fmt.Fprintln(os.Stderr, err)
	os.Exit(1)
}

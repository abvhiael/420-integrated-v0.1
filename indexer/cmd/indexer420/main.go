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
	"github.com/420integrated/420-integrated/indexer/ingest"
	indexerrpc "github.com/420integrated/420-integrated/indexer/rpc"
	"github.com/420integrated/420-integrated/indexer/store"
	"github.com/420integrated/420-integrated/indexer/version"
)

const (
	defaultHTTPAddr = ":8420"
	defaultPollInterval = 12 * time.Second
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

	rebuild := os.Getenv("INDEXER_REBUILD") == "1"
	out, _ := json.Marshal(startup{
		Service: "420Indexer", Status: "EXP_1_4_RUNTIME", ChainID: 420,
		RPCConfigured: true, StorePath: storePath, HTTPAddr: httpAddr,
		PollInterval: pollInterval.String(), Rebuild: rebuild,
	})
	fmt.Println(string(out))

	durable, err := store.NewFileStore(storePath)
	if err != nil { return err }
	if rebuild {
		if err := durable.Reset(); err != nil { return fmt.Errorf("reset rebuildable index: %w", err) }
	}

	client := indexerrpc.NewClient(rpcURL, 15*time.Second)
	engine := ingest.New(420, version.Schema, client, durable)

	ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer cancel()

	// Fail closed on startup: do not expose a ready HTTP service until the
	// configured canonical source has passed validation and the first catch-up.
	if err := engine.CatchUp(ctx); err != nil { return fmt.Errorf("initial catch-up: %w", err) }

	backend := api.NewStoreBackend(durable, nil)
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
			if err := engine.CatchUp(ctx); err != nil {
				// Preserve the last known indexed state and keep the read API
				// available. Source/finality conflicts are reflected by the
				// indexer core and will fail closed rather than rewrite history.
				fmt.Fprintf(os.Stderr, "420Indexer catch-up failed: %v\n", err)
			}
		}
	}
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

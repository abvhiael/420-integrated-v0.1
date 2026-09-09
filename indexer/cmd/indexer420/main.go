package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/420integrated/420-integrated/indexer/ingest"
	indexerrpc "github.com/420integrated/420-integrated/indexer/rpc"
	"github.com/420integrated/420-integrated/indexer/store"
)

type startup struct {
	Service       string `json:"service"`
	Status        string `json:"status"`
	ChainID       uint64 `json:"chainId"`
	RPCConfigured bool   `json:"rpcConfigured"`
	StorePath     string `json:"storePath"`
}

func main() {
	rpcURL := os.Getenv("INDEXER_RPC_URL")
	storePath := os.Getenv("INDEXER_STORE_PATH")
	if storePath == "" { storePath = "./var/420indexer/index.json" }
	out, _ := json.Marshal(startup{Service: "420Indexer", Status: "GEN11_1B", ChainID: 420, RPCConfigured: rpcURL != "", StorePath: storePath})
	fmt.Println(string(out))
	if rpcURL == "" {
		fmt.Fprintln(os.Stderr, "INDEXER_RPC_URL is required")
		os.Exit(2)
	}

	durable, err := store.NewFileStore(storePath)
	if err != nil { fatal(err) }
	client := indexerrpc.NewClient(rpcURL, 15*time.Second)
	engine := ingest.New(420, "420-indexer-schema-v1", client, durable)
	ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer cancel()
	if err := engine.CatchUp(ctx); err != nil { fatal(err) }
	health, err := engine.Core().Health("baseline")
	if err != nil { fatal(err) }
	encoded, err := json.Marshal(health)
	if err != nil { fatal(err) }
	fmt.Println(string(encoded))
}

func fatal(err error) {
	fmt.Fprintln(os.Stderr, err)
	os.Exit(1)
}

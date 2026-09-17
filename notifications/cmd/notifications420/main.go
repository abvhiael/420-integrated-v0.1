package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"strconv"
	"time"

	notifyruntime "github.com/420integrated/420-integrated/notifications/runtime"
)

func main() {
	cfg := notifyruntime.Config{
		ChainID:        mustUint64("NOTIFICATIONS_CHAIN_ID"),
		IndexerURL:     mustEnv("NOTIFICATIONS_INDEXER_URL"),
		ListenAddr:     envOr("NOTIFICATIONS_LISTEN_ADDR", ":8421"),
		RequestTimeout: durationOr("NOTIFICATIONS_REQUEST_TIMEOUT", 5*time.Second),
	}
	probe, err := notifyruntime.NewHTTPIndexerProbe(cfg.IndexerURL, cfg.RequestTimeout)
	if err != nil { log.Fatal(err) }
	service, err := notifyruntime.NewService(cfg, probe)
	if err != nil { log.Fatal(err) }
	ctx, cancel := context.WithTimeout(context.Background(), cfg.RequestTimeout)
	defer cancel()
	if err := service.Qualify(ctx); err != nil { log.Fatalf("notifications startup qualification failed: %v", err) }
	server := &http.Server{Addr: cfg.ListenAddr, Handler: service.Handler(), ReadHeaderTimeout: 5 * time.Second}
	log.Printf("420Notifications listening on %s", cfg.ListenAddr)
	log.Fatal(server.ListenAndServe())
}

func mustEnv(name string) string {
	v := os.Getenv(name)
	if v == "" { log.Fatalf("%s is required", name) }
	return v
}

func mustUint64(name string) uint64 {
	v, err := strconv.ParseUint(mustEnv(name), 10, 64)
	if err != nil || v == 0 { log.Fatalf("%s must be a positive integer", name) }
	return v
}

func envOr(name, fallback string) string {
	if v := os.Getenv(name); v != "" { return v }
	return fallback
}

func durationOr(name string, fallback time.Duration) time.Duration {
	if v := os.Getenv(name); v != "" {
		d, err := time.ParseDuration(v)
		if err != nil || d <= 0 { log.Fatalf("%s must be a positive duration", name) }
		return d
	}
	return fallback
}

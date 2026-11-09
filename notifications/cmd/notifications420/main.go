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
	// Fail closed on partially supplied service-to-service authorization.
	keys := []string{"NOTIFICATIONS_DELIVERY_STORE","NOTIFICATIONS_DELIVERY_API_TOKEN",
		"NOTIFICATIONS_DELIVERY_TENANT","NOTIFICATIONS_DELIVERY_AUTHORITY_URL",
		"NOTIFICATIONS_DELIVERY_AUTHORITY_TOKEN"}
	present := 0
	for _, key := range keys { if os.Getenv(key)!="" { present++ } }
	if present!=0 && present!=len(keys) {log.Fatal("partial native delivery configuration is forbidden")}
	if present==len(keys) {
		if os.Getenv("NOTIFICATIONS_DELIVERY_TENANT")!="420bet" {
			log.Fatal("unsupported delivery tenant")
		}
		principal:=notifyruntime.DeliveryPrincipal{ServiceID:"bet-worker",Tenant:"420bet"}
		auth,e:=notifyruntime.BearerServiceAuthenticator(os.Getenv("NOTIFICATIONS_DELIVERY_API_TOKEN"),principal)
		if e!=nil {log.Fatal(e)}
		authority,e:=notifyruntime.NewHTTPDeliveryAuthority(
			os.Getenv("NOTIFICATIONS_DELIVERY_AUTHORITY_URL"),
			os.Getenv("NOTIFICATIONS_DELIVERY_AUTHORITY_TOKEN"),nil)
		if e!=nil {log.Fatal(e)}
		store,e:=notifyruntime.OpenDeliveryStore(os.Getenv("NOTIFICATIONS_DELIVERY_STORE"))
		if e!=nil {log.Fatal(e)}
		defer store.Close()
		api,e:=notifyruntime.NewDeliveryAPI(store,auth,authority.Consent,authority.Provenance)
		if e!=nil {log.Fatal(e)}
		if e=service.ConfigureDeliveryAPI(api);e!=nil {log.Fatal(e)}
		log.Print("private Notifications delivery API enabled with approved external authority")
	}
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

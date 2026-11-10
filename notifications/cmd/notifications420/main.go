package main

import (
	"context"
	"log"
 "net"
 "os/signal"
 "syscall"
 "errors"
	"net/http"
	"os"
	"strconv"
	"time"

 "github.com/420integrated/420-integrated/notifications/betconsent"
 "github.com/420integrated/420-integrated/notifications/betdelivery"

	notifyruntime "github.com/420integrated/420-integrated/notifications/runtime"
)

func main() {
	cfg := notifyruntime.Config{
		ChainID:        mustUint64("NOTIFICATIONS_CHAIN_ID"),
		IndexerURL:     mustEnv("NOTIFICATIONS_INDEXER_URL"),
		ListenAddr:     envOr("NOTIFICATIONS_LISTEN_ADDR", "127.0.0.1:8421"),
		RequestTimeout: durationOr("NOTIFICATIONS_REQUEST_TIMEOUT", 5*time.Second),
	}
	host,_,addrErr:=net.SplitHostPort(cfg.ListenAddr)
 if addrErr!=nil{log.Fatal("invalid notification listener address")}
 loopback:=host=="localhost"||(net.ParseIP(host)!=nil&&net.ParseIP(host).IsLoopback())
 if !loopback&&os.Getenv("NOTIFICATIONS_APPROVED_PRIVATE_NETWORK")!="true"{
  log.Fatal("Notifications may bind publicly only behind an approved private-network gateway")
 }
 probe, err := notifyruntime.NewHTTPIndexerProbe(cfg.IndexerURL, cfg.RequestTimeout)
	if err != nil { log.Fatal(err) }
	service, err := notifyruntime.NewService(cfg, probe)
	if err != nil { log.Fatal(err) }
	if path:=os.Getenv("NOTIFICATIONS_BET_CONSENT_PATH");path!="" {
  readToken:=mustEnv("NOTIFICATIONS_BET_CONSENT_READ_TOKEN")
  writeToken:=mustEnv("NOTIFICATIONS_BET_CONSENT_WRITE_TOKEN")
  store,e:=betconsent.Open(path);if e!=nil{log.Fatal(e)}
  defer store.Close()
  if e=service.EnableBetConsent(store,readToken,writeToken);e!=nil{log.Fatal(e)}
  if os.Getenv("NOTIFICATIONS_BET_ENROLL_TOKEN")!=""||os.Getenv("NOTIFICATIONS_BET_ENROLL_KEY")!=""{
   if e=service.EnableBetEnrollment(store,mustEnv("NOTIFICATIONS_BET_ENROLL_TOKEN"),
    mustEnv("NOTIFICATIONS_BET_ENROLL_KEY"));e!=nil{log.Fatal(e)}
  }
  if deliveryPath:=os.Getenv("NOTIFICATIONS_BET_DELIVERY_PATH");deliveryPath!="" {
   ledger,e:=betdelivery.Open(deliveryPath);if e!=nil{log.Fatal(e)}
   defer ledger.Close()
   if e=service.EnableBetDelivery(ledger,store,mustEnv("NOTIFICATIONS_BET_DELIVERY_TOKEN"));e!=nil{log.Fatal(e)}
   if os.Getenv("NOTIFICATIONS_BET_PROVIDER_TOKEN")!=""||os.Getenv("NOTIFICATIONS_BET_PROVIDER_KEY")!=""{
    if e=service.EnableBetProviderReceipts(ledger,store,
     mustEnv("NOTIFICATIONS_BET_PROVIDER_TOKEN"),mustEnv("NOTIFICATIONS_BET_PROVIDER_KEY"));e!=nil{log.Fatal(e)}
   }
  }
 }
 ctx, cancel := context.WithTimeout(context.Background(), cfg.RequestTimeout)
	defer cancel()
	if err := service.Qualify(ctx); err != nil { log.Fatalf("notifications startup qualification failed: %v", err) }
 server := &http.Server{Addr: cfg.ListenAddr, Handler: service.Handler(),
  ReadHeaderTimeout:5*time.Second,ReadTimeout:12*time.Second,
  WriteTimeout:15*time.Second,IdleTimeout:30*time.Second,MaxHeaderBytes:16<<10}
 lifecycle,stop:=signal.NotifyContext(context.Background(),syscall.SIGINT,syscall.SIGTERM)
 defer stop()
 go func(){
  ticker:=time.NewTicker(30*time.Second);defer ticker.Stop()
  for{
   select{
   case <-lifecycle.Done():
    ctx,cancel:=context.WithTimeout(context.Background(),10*time.Second)
    if err:=server.Shutdown(ctx);err!=nil{log.Printf("notification shutdown failed: %v",err)}
    cancel()
    return
   case <-ticker.C:
    ctx,cancel:=context.WithTimeout(lifecycle,cfg.RequestTimeout)
    if err:=service.Qualify(ctx);err!=nil{log.Printf("notification readiness recheck failed: %v",err)}
    cancel()
   }
  }
 }()
 log.Printf("420Notifications private service listening on %s",cfg.ListenAddr)
 if err:=server.ListenAndServe();err!=nil&&!errors.Is(err,http.ErrServerClosed){
  log.Printf("notification server terminated unexpectedly: %v",err)
  os.Exit(1)
 }
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

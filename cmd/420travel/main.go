// Command 420travel serves the GEN-SVC-3 public Travel application.
// Private Identity, Trips, claims, shares and Reputation remain disabled until
// independently wired and qualified against actual trusted services.
package main

import (
 "log"
 "net/http"
 "os"
 "strings"
 "time"

 "github.com/420integrated/420-integrated/genesis/svc3/travelapp"
)

func main() {
 address:=os.Getenv("TRAVEL_LISTEN_ADDR")
 if address=="" {address="127.0.0.1:8088"}
 mode:=strings.TrimSpace(os.Getenv("TRAVEL_DEPLOYMENT_MODE"))
 if mode!=""&&mode!="development"&&mode!="staging"&&mode!="production" {log.Fatal("invalid TRAVEL_DEPLOYMENT_MODE")}
 handler,err:=travelapp.NewPublicDeploymentHandler(travelapp.PublicDeploymentConfig{
  PublicServiceURL:os.Getenv("TRAVEL_PUBLIC_SERVICE_URL"),
  Strict:mode=="staging"||mode=="production",
 })
 if err!=nil {log.Fatalf("Travel public upstream configuration rejected: %v",err)}
 server:=&http.Server{
  Addr:address,
  Handler:handler,
  ReadHeaderTimeout:5*time.Second,
  ReadTimeout:10*time.Second,
  WriteTimeout:10*time.Second,
  IdleTimeout:30*time.Second,
 }
 log.Printf("420Travel public service listening on %s; readiness /readyz; private routes disabled",address)
 log.Fatal(server.ListenAndServe())
}

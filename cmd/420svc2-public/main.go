// Command 420svc2-public serves only GEN-SVC-2 public Location/Events projections.
package main

import (
 "log"
 "net/http"
 "os"
 "strings"
 "time"

 "github.com/420integrated/420-integrated/genesis/svc2/deployment"
)

func main(){
 address:=strings.TrimSpace(os.Getenv("SVC2_LISTEN_ADDR"))
 if address=="" {log.Fatal("SVC2_LISTEN_ADDR is required (for Railway, use 0.0.0.0:8080)")}
 handler,err:=deployment.NewHandler(deployment.Config{
  PlacesPath:os.Getenv("SVC2_PLACES_SNAPSHOT"),
  EventsPath:os.Getenv("SVC2_EVENTS_SNAPSHOT"),
  SourceID:os.Getenv("SVC2_PUBLICATION_SOURCE"),
 })
 if err!=nil {log.Fatalf("GEN-SVC-2 public startup refused: %v",err)}
 server:=&http.Server{Addr:address,Handler:handler,ReadHeaderTimeout:5*time.Second,ReadTimeout:10*time.Second,WriteTimeout:10*time.Second,IdleTimeout:30*time.Second}
 log.Printf("GEN-SVC-2 public service listening on %s; no mutation routes",address)
 log.Fatal(server.ListenAndServe())
}

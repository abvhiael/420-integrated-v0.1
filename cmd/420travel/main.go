// Command 420travel runs the local GEN-SVC-3 Travel shell.
// Production ingress, authentication, monitoring, and public service discovery
// remain explicit release gates and are not supplied by this development server.
package main

import (
    "log"
    "net/http"
    "os"
    "time"

    "github.com/420integrated/420-integrated/genesis/svc3/travelapp"
)

func main() {
    address := os.Getenv("TRAVEL_LISTEN_ADDR")
    if address == "" { address = "127.0.0.1:8088" }
    server := &http.Server{
        Addr: address,
        Handler: travelapp.Handler(),
        ReadHeaderTimeout: 5 * time.Second,
        ReadTimeout: 10 * time.Second,
        WriteTimeout: 10 * time.Second,
        IdleTimeout: 30 * time.Second,
    }
    log.Printf("420Travel development shell listening at http://%s/travel", address)
    log.Fatal(server.ListenAndServe())
}

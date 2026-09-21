package travelapp

import (
 "net/http"
 "os"
 "strings"
 "time"

 "github.com/420integrated/420-integrated/genesis/svc2/sdk"
)

// PublicTravelHandler is the normal Travel server entrypoint. It enables the
// public map/list UX but never turns on Identity, Trips, claims, sharing, or
// verified reviews merely because environment variables are present.
func PublicTravelHandler() http.Handler {
 base:=strings.TrimSpace(os.Getenv("TRAVEL_PUBLIC_SERVICE_URL"))
 if base=="" {return HandlerWithNearbyMap(nil)}
 return HandlerWithNearbyMap(sdk.Client{BaseURL:base,HTTP:&http.Client{Timeout:4*time.Second}})
}

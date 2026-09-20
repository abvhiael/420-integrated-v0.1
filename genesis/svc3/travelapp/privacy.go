package travelapp

import (
 "context"
 "errors"
 "reflect"

 "github.com/420integrated/420-integrated/genesis/svc2/consumers"
 "github.com/420integrated/420-integrated/genesis/svc2/sdk"
)

// loadPublicDiscovery rechecks the public place projection after fetching
// events. If a place is hidden, deleted, relocated, or changes precision while
// the requests are in flight, fail closed instead of rendering the first view.
// This is a best-effort check, NOT an atomic snapshot: upstream publication
// must still enforce canonical event visibility and consistent snapshots.
func loadPublicDiscovery(ctx context.Context, reader PublicReader, query sdk.EventQuery) (consumers.Feed, error) {
 feed, err := consumers.Load(ctx, reader, query)
 if err != nil { return consumers.Feed{}, err }
 latest, err := reader.Places(ctx)
 if err != nil { return consumers.Feed{}, err }
 if !reflect.DeepEqual(feed.Map, latest) {
  return consumers.Feed{}, errors.New("public place projection changed during discovery")
 }
 return feed, nil
}

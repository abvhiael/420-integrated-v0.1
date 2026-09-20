package consumers_test

import (
 "context"
 "net/http/httptest"
 "testing"
 "time"

 eventdiscovery "github.com/420integrated/420-integrated/events/discovery"
 eventmodel "github.com/420integrated/420-integrated/events/model"
 "github.com/420integrated/420-integrated/genesis/svc2/consumers"
 "github.com/420integrated/420-integrated/genesis/svc2/httpapi"
 "github.com/420integrated/420-integrated/genesis/svc2/sdk"
 locationmodel "github.com/420integrated/420-integrated/location/model"
 locationuikit "github.com/420integrated/420-integrated/location/uikit"
)

type placesSource []locationmodel.Place
func(s placesSource)ListAll()[]locationmodel.Place{return append([]locationmodel.Place(nil),s...)}
type eventsSource struct{items []eventmodel.Event}
func(s *eventsSource)ListAll()[]eventmodel.Event{return append([]eventmodel.Event(nil),s.items...)}

func TestPublicConsumersThroughHTTPAndSDK(t *testing.T){
 now:=time.Date(2026,10,1,10,0,0,0,time.UTC)
 lat,lon:=50.44,-104.61
 approxLat,approxLon:=50.95,-104.99
 owner:=locationmodel.SubjectRef{Type:"user",ID:"owner"}
 place:=func(id string,visibility locationmodel.Visibility,precision locationmodel.PlacePrecision,latitude,longitude *float64)locationmodel.Place{
  return locationmodel.Place{ID:id,Name:id,Category:locationmodel.CategoryVenue,Visibility:visibility,Precision:precision,Source:"canonical",Owner:owner,City:"Regina",Region:"SK",Country:"CA",Latitude:latitude,Longitude:longitude,Version:1,CreatedAt:now,UpdatedAt:now}
 }
 places:=placesSource{
  place("public-pin",locationmodel.VisibilityPublic,locationmodel.PrecisionExactPublic,&lat,&lon),
  place("public-area",locationmodel.VisibilityPublic,locationmodel.PrecisionApproximate,&approxLat,&approxLon),
  place("private-place",locationmodel.VisibilityPrivate,locationmodel.PrecisionPrivate,&lat,&lon),
  place("unlisted-place",locationmodel.VisibilityUnlisted,locationmodel.PrecisionApproximate,&lat,&lon),
 }
 makeEvent:=func(id,placeID string,visibility eventmodel.Visibility)eventmodel.Event{
  return eventmodel.Event{ID:id,Organizer:owner,Title:id,StartAt:now.Add(2*time.Hour),EndAt:now.Add(3*time.Hour),Timezone:"UTC",Visibility:visibility,Status:eventmodel.StatusScheduled,PlaceID:placeID,Version:1,CreatedAt:now,UpdatedAt:now}
 }
 events:= &eventsSource{items:[]eventmodel.Event{
  makeEvent("visible-pin","public-pin",eventmodel.VisibilityPublic),
  makeEvent("visible-area","public-area",eventmodel.VisibilityPublic),
  makeEvent("hidden-venue","private-place",eventmodel.VisibilityPublic),
  makeEvent("unlisted-venue","unlisted-place",eventmodel.VisibilityPublic),
  makeEvent("standalone","",eventmodel.VisibilityPublic),
  makeEvent("private-event","public-pin",eventmodel.VisibilityPrivate),
 }}
 from,to:=now,now.Add(24*time.Hour)
 index:=eventdiscovery.New()
 if err:=index.Rebuild(events,from,to);err!=nil{t.Fatal(err)}
 server:=httptest.NewServer(httpapi.Server{Places:places,Events:events,Discovery:index}.Handler());defer server.Close()
 client:=sdk.Client{BaseURL:server.URL,HTTP:server.Client()}
 query:=sdk.EventQuery{From:from,To:to,Limit:20}
 feed,err:=consumers.Load(context.Background(),client,query);if err!=nil{t.Fatal(err)}
 if len(feed.Map.Items)!=2||len(feed.Travel)!=2||len(feed.Calendar)!=3 {t.Fatalf("incorrect public projections: map=%d travel=%d calendar=%d",len(feed.Map.Items),len(feed.Travel),len(feed.Calendar))}
 seen:=map[string]bool{}
 for _,card:=range feed.Calendar{
  seen[card.EventID]=true
  if card.EventID=="hidden-venue"||card.EventID=="unlisted-venue"||card.EventID=="private-event"{t.Fatalf("private or unlisted venue/event exposed: %+v",card)}
 }
 for _,id:=range []string{"visible-pin","visible-area","standalone"}{if !seen[id]{t.Fatalf("missing public calendar event %q",id)}}
 for _,venue:=range feed.Travel{
  switch venue.Place.ID {
  case "public-pin":
   if venue.Place.Kind!=locationuikit.KindPin||venue.Place.Latitude==nil||venue.Place.Longitude==nil||len(venue.Events)!=1||venue.Events[0].EventID!="visible-pin"{t.Fatalf("invalid public pin consumer: %+v",venue)}
  case "public-area":
   if venue.Place.Kind!=locationuikit.KindArea||venue.Place.Latitude!=nil||venue.Place.Longitude!=nil||len(venue.Events)!=1||venue.Events[0].EventID!="visible-area"{t.Fatalf("approximate location leaked or event mismatch: %+v",venue)}
  default:t.Fatalf("nonpublic venue leaked to travel: %+v",venue)
  }
 }
 // Canonical changes must revoke stale discoveries before all three consumers render.
 events.items[0].Visibility=eventmodel.VisibilityPrivate
 after,err:=consumers.Load(context.Background(),client,query);if err!=nil{t.Fatal(err)}
 for _,venue:=range after.Travel{for _,card:=range venue.Events{if card.EventID=="visible-pin"{t.Fatal("stale private event reached travel")}}}
 for _,card:=range after.Calendar{if card.EventID=="visible-pin"{t.Fatal("stale private event reached calendar")}}
 // A public place becoming unlisted must immediately remove both its map item
 // and its previously discoverable event from consumer projections.
 places[1].Visibility=locationmodel.VisibilityUnlisted
 // Rebind the handler to the updated in-memory canonical place source.
 changed:=httptest.NewServer(httpapi.Server{Places:places,Events:events,Discovery:index}.Handler());defer changed.Close()
 changedClient:=sdk.Client{BaseURL:changed.URL,HTTP:changed.Client()}
 after,err=consumers.Load(context.Background(),changedClient,query);if err!=nil{t.Fatal(err)}
 if len(after.Map.Items)!=1||len(after.Travel)!=1{t.Fatalf("unlisted place still mapped: %+v",after)}
 for _,card:=range after.Calendar{if card.EventID=="visible-area"{t.Fatal("event linked to now-unlisted place reached calendar")}}
}

func TestPublicConsumersRejectInvalidInputsAndSDKFailure(t *testing.T){
 if _,err:=consumers.Load(context.Background(),nil,sdk.EventQuery{});err==nil{t.Fatal("nil consumer reader accepted")}
 client:=sdk.Client{BaseURL:"http://127.0.0.1:0"}
 if _,err:=consumers.Load(context.Background(),client,sdk.EventQuery{});err==nil{t.Fatal("unavailable public API accepted")}
}

package travelapp

import (
 "context"
 "errors"
 "time"

 "github.com/420integrated/420-integrated/genesis/svc2/sdk"
)

// ErrTripPublicationUnavailable deliberately does not identify a withdrawn
// reference to anonymous recipients of a shared trip.
var ErrTripPublicationUnavailable = errors.New("trip publication cannot be verified")

// CurrentPublicTripVerifier rechecks *all* saved references using the trusted
// public Location/Events projection for every shared read. It is not a
// canonical/private Location reader, a cache, or a public-trip publishing API.
// The deployment must separately qualify the upstream service's publication,
// withdrawal and snapshot guarantees before enabling shared-trip reads.
type CurrentPublicTripVerifier struct { Reader PublicReader }

func (v CurrentPublicTripVerifier) VerifyPublishedTrip(ctx context.Context, trip Trip) error {
 if v.Reader == nil || ctx == nil { return ErrTripPublicationUnavailable }
 if len(trip.PlaceIDs)>100 || len(trip.EventIDs)>100 { return ErrTripPublicationUnavailable }
 for _,id:=range trip.PlaceIDs {if !validPlaceID(id) {return ErrTripPublicationUnavailable}}
 for _,id:=range trip.EventIDs {if !validPlaceID(id) {return ErrTripPublicationUnavailable}}
 checked,cancel:=context.WithTimeout(ctx,5*time.Second)
 defer cancel()
 now:=time.Now().UTC()
 feed,err:=loadPublicDiscovery(checked,v.Reader,sdk.EventQuery{From:now,To:now.Add(30*24*time.Hour),Limit:100})
 if err!=nil {return ErrTripPublicationUnavailable}
 places:=make(map[string]struct{},len(feed.Travel))
 for _,venue:=range feed.Travel {if validPlaceID(venue.Place.ID){places[venue.Place.ID]=struct{}{}}}
 events:=make(map[string]struct{},len(feed.Calendar))
 for _,event:=range feed.Calendar {if validPlaceID(event.ID){events[event.ID]=struct{}{}}}
 for _,id:=range trip.PlaceIDs {if _,ok:=places[id];!ok{return ErrTripPublicationUnavailable}}
 for _,id:=range trip.EventIDs {if _,ok:=events[id];!ok{return ErrTripPublicationUnavailable}}
 return nil
}

var _ PublishedTripVerifier = CurrentPublicTripVerifier{}

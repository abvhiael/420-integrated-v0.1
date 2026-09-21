package travelapp

import (
 "context"
 "errors"
 "testing"
 "time"

 eventui "github.com/420integrated/420-integrated/events/uikit"
 locationui "github.com/420integrated/420-integrated/location/uikit"
)

func TestCurrentPublicTripVerifierChecksEveryReference(t *testing.T) {
 start:=time.Now().UTC().Add(time.Hour)
 reader:=&stubPublicReader{places:locationui.View{Items:[]locationui.Item{{ID:"pub",Name:"Published",Kind:locationui.KindArea}}},events:eventui.View{Items:[]eventui.Card{{ID:"event",Title:"Published event",PlaceID:"pub",StartAt:start}}}}
 verifier:=CurrentPublicTripVerifier{Reader:reader}
 trip:=Trip{PlaceIDs:[]string{"pub"},EventIDs:[]string{"event"}}
 if err:=verifier.VerifyPublishedTrip(context.Background(),trip);err!=nil {t.Fatalf("current public references: %v",err)}
 trip.PlaceIDs=append(trip.PlaceIDs,"withdrawn")
 if err:=verifier.VerifyPublishedTrip(context.Background(),trip);!errors.Is(err,ErrTripPublicationUnavailable){t.Fatalf("missing place must fail closed: %v",err)}
 trip.PlaceIDs=[]string{"pub"}
 reader.places.Items=nil
 if err:=verifier.VerifyPublishedTrip(context.Background(),trip);!errors.Is(err,ErrTripPublicationUnavailable){t.Fatalf("withdrawn venue must fail event and place: %v",err)}
 reader.placesErr=errors.New("downstream unavailable")
 if err:=verifier.VerifyPublishedTrip(context.Background(),Trip{});!errors.Is(err,ErrTripPublicationUnavailable){t.Fatalf("empty trip must still verify live feed: %v",err)}
 if err:=(CurrentPublicTripVerifier{}).VerifyPublishedTrip(context.Background(),Trip{});!errors.Is(err,ErrTripPublicationUnavailable){t.Fatalf("missing configured reader must fail: %v",err)}
}

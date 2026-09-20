// Package consumers joins the public GEN-SVC-2 SDK views for map, travel and
// calendar integrations. It is a presentation adapter, not an event, place,
// ticketing or booking authority.
package consumers

import (
 "context"
 "errors"

 eventuikit "github.com/420integrated/420-integrated/events/uikit"
 "github.com/420integrated/420-integrated/genesis/svc2/sdk"
 locationuikit "github.com/420integrated/420-integrated/location/uikit"
)

type PublicReader interface {
 Places(context.Context) (locationuikit.View,error)
 Events(context.Context,sdk.EventQuery) (eventuikit.View,error)
}

type Venue struct {
 Place locationuikit.Item `json:"place"`
 Events []eventuikit.Card `json:"events"`
}

// Feed is safe for public consumers. Calendar contains only standalone events
// and events whose referenced venues are visible in the public place view.
// Travel contains only events joined to an explicitly public venue.
type Feed struct {
 Map locationuikit.View `json:"map"`
 Travel []Venue `json:"travel"`
 Calendar []eventuikit.Card `json:"calendar"`
}

// Load uses only the versioned SDK's public projections. Never look up a
// missing place ID in the canonical repository to complete an event card.
func Load(ctx context.Context,reader PublicReader,query sdk.EventQuery)(Feed,error){
 if reader==nil{return Feed{},errors.New("public GEN-SVC-2 reader is required")}
 places,err:=reader.Places(ctx);if err!=nil{return Feed{},err}
 events,err:=reader.Events(ctx,query);if err!=nil{return Feed{},err}
 feed:=Feed{Map:places,Travel:make([]Venue,0),Calendar:make([]eventuikit.Card,0)}
 byID:=make(map[string]int,len(places.Items))
 for _,place:=range places.Items {
  if place.ID=="" {return Feed{},errors.New("public place identifier is required")}
  if _,found:=byID[place.ID];found{return Feed{},errors.New("duplicate public place identifier")}
  if place.Kind!=locationuikit.KindPin && place.Kind!=locationuikit.KindArea{return Feed{},errors.New("unknown public place kind")}
  if place.Kind==locationuikit.KindArea && (place.Latitude!=nil||place.Longitude!=nil){return Feed{},errors.New("area must not expose exact coordinates")}
  if place.Kind==locationuikit.KindPin && (place.Latitude==nil||place.Longitude==nil){return Feed{},errors.New("public pin requires coordinates")}
  byID[place.ID]=len(feed.Travel)
  feed.Travel=append(feed.Travel,Venue{Place:place,Events:make([]eventuikit.Card,0)})
 }
 for _,card:=range events.Items {
  if card.PlaceID=="" {
   feed.Calendar=append(feed.Calendar,card)
   continue
  }
  position,ok:=byID[card.PlaceID]
  if !ok {continue} // Avoid exposing unlisted, private or deleted venue references.
  feed.Calendar=append(feed.Calendar,card)
  feed.Travel[position].Events=append(feed.Travel[position].Events,card)
 }
 return feed,nil
}

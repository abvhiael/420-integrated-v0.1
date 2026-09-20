// Package uikit exposes a presentation-only, public event view for trusted UI consumers.
// Event state and audience authorization remain with the canonical Events service.
package uikit

import (
 "errors"
 "sort"
 "strings"
 "time"

 "github.com/420integrated/420-integrated/events/discovery"
 "github.com/420integrated/420-integrated/events/model"
)

const MaxEventCards = 100

type Card struct {
 ID string `json:"id"`
 EventID string `json:"eventId"`
 Title string `json:"title"`
 PlaceID string `json:"placeId,omitempty"`
 Tags []string `json:"tags,omitempty"`
 StartAt time.Time `json:"startAt"`
 EndAt time.Time `json:"endAt"`
 Timezone string `json:"timezone"`
 Version uint32 `json:"version"`
}

type View struct { Items []Card `json:"items"`; Empty bool `json:"empty"` }

// Build reads only trusted public discovery entries. A canonical source is
// required to re-check current visibility/status/version before projecting;
// stale discovery snapshots are not an authorization boundary.
func Build(entries []discovery.Entry, source discovery.Source) (View,error) {
 if source==nil {return View{},errors.New("canonical event source required")}
 if len(entries)>MaxEventCards {return View{},errors.New("event UI item limit exceeded")}
 canonical:=make(map[string]model.Event)
 for _,event:=range source.ListAll(){if _,exists:=canonical[event.ID];exists{return View{},errors.New("duplicate canonical event id")};canonical[event.ID]=event}
 cards:=make([]Card,0,len(entries)); seen:=make(map[string]struct{},len(entries))
 for _,entry:=range entries {
  event,ok:=canonical[entry.EventID]
  if !ok || event.Visibility!=model.VisibilityPublic || (event.Status!=model.StatusScheduled && event.Status!=model.StatusLive) || event.Version!=entry.Version {continue}
  if err:=event.Validate();err!=nil{return View{},err}
  if strings.TrimSpace(entry.Title)=="" || entry.StartAt.IsZero() || !entry.EndAt.After(entry.StartAt) || entry.StartAt.Before(event.StartAt) || entry.Timezone!=event.Timezone {return View{},errors.New("invalid public event discovery entry")}
  if entry.Title!=event.Title || entry.PlaceID!=event.PlaceID {return View{},errors.New("event discovery entry differs from canonical record")}
  // A recurring occurrence may have been excluded/cancelled since indexing.
  // Callers must rebuild discovery following all canonical event changes.
  id:=entry.EventID+"|"+entry.OriginalStartAt.UTC().Format(time.RFC3339Nano)
  if _,exists:=seen[id];exists{return View{},errors.New("duplicate public event occurrence")};seen[id]=struct{}{}
  cards=append(cards,Card{ID:id,EventID:event.ID,Title:event.Title,PlaceID:event.PlaceID,Tags:append([]string(nil),event.Tags...),StartAt:entry.StartAt.UTC(),EndAt:entry.EndAt.UTC(),Timezone:event.Timezone,Version:event.Version})
 }
 sort.Slice(cards,func(i,j int)bool{if !cards[i].StartAt.Equal(cards[j].StartAt){return cards[i].StartAt.Before(cards[j].StartAt)};return cards[i].ID<cards[j].ID})
 return View{Items:cards,Empty:len(cards)==0},nil
}

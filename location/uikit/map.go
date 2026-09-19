// Package uikit provides presentation-only models for 420Location map consumers.
// It never queries a provider or upgrades an approximate/private location to an exact pin.
package uikit

import (
 "errors"
 "math"
 "sort"
 "strings"

 "github.com/420integrated/420-integrated/location/model"
)

const MaxMapItems = 500

type Kind string
const (KindPin Kind = "pin"; KindArea Kind = "area")

type Item struct {
 ID string `json:"id"`
 Name string `json:"name"`
 Category model.Category `json:"category"`
 Kind Kind `json:"kind"`
 Latitude *float64 `json:"latitude,omitempty"`
 Longitude *float64 `json:"longitude,omitempty"`
 Region string `json:"region,omitempty"`
 City string `json:"city,omitempty"`
 Country string `json:"country,omitempty"`
}

type View struct { Items []Item `json:"items"`; Empty bool `json:"empty"` }

// Build accepts canonical places, emits public locations only and never emits
// coordinates for approximate locations (even if the source has coordinates).
// An invalid public record fails closed instead of leaking partially validated data.
func Build(places []model.Place)(View,error) {
 if len(places)>MaxMapItems {return View{},errors.New("map item limit exceeded")}
 out:=make([]Item,0,len(places))
 seen:=make(map[string]struct{},len(places))
 for _,p:=range places {
  if p.Visibility!=model.VisibilityPublic {continue}
  if err:=p.Validate();err!=nil{return View{},err}
  if _,ok:=seen[p.ID];ok{return View{},errors.New("duplicate public place id")};seen[p.ID]=struct{}{}
  item:=Item{ID:p.ID,Name:p.Name,Category:p.Category,Kind:KindArea,City:p.City,Region:p.Region,Country:p.Country}
  if p.Precision==model.PrecisionExactPublic {
   if p.Latitude==nil||p.Longitude==nil||math.IsNaN(*p.Latitude)||math.IsNaN(*p.Longitude) {return View{},errors.New("public pin coordinates missing")}
   lat,lon:=*p.Latitude,*p.Longitude
   item.Kind=KindPin;item.Latitude=&lat;item.Longitude=&lon
  } else {
   // Approximate entries expose only coarse textual geography, no street address,
   // original or inferred position, postal region, or provider alias.
   if strings.TrimSpace(item.City)==""&&strings.TrimSpace(item.Region)==""&&strings.TrimSpace(item.Country)=="" {continue}
  }
  out=append(out,item)
 }
 sort.Slice(out,func(i,j int)bool{if out[i].Name!=out[j].Name{return out[i].Name<out[j].Name};return out[i].ID<out[j].ID})
 return View{Items:out,Empty:len(out)==0},nil
}

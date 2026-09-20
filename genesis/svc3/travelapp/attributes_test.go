package travelapp

import (
 "net/http"
 "strings"
 "testing"
 "time"

 eventui "github.com/420integrated/420-integrated/events/uikit"
 locationmodel "github.com/420integrated/420-integrated/location/model"
 locationui "github.com/420integrated/420-integrated/location/uikit"
)

func TestCannabisDescriptorsRequireExplicitPublicCategoriesOrTags(t *testing.T) {
 if got:=cannabisPlaceLabels(locationmodel.CategoryHotel);len(got)!=0 {t.Fatalf("hotel cannot imply cannabis friendly: %v",got)}
 if got:=cannabisPlaceLabels(locationmodel.CategoryDispensary);len(got)!=1||got[0]!="Listed category: dispensary" {t.Fatalf("dispensary descriptor: %v",got)}
 if got:=cannabisPlaceLabels(locationmodel.CategoryFarm);len(got)!=1||!strings.Contains(got[0],"access unverified") {t.Fatalf("farm descriptor: %v",got)}
 if got:=cannabisEventLabels([]string{"cannabis", " CANNABIS-EVENT ", "grow-tour", "grow-attraction", "cannabis-friendly", "onsite-consumption", "legal", "other"});len(got)!=2 {t.Fatalf("only two recognized descriptive labels expected: %v",got)}
 if got:=cannabisEventLabels([]string{"cannabis-friendly", "onsite-consumption", "legal"});len(got)!=0 {t.Fatalf("unverified claims must not be presented: %v",got)}
}

func TestCannabisLabelsRenderOnlyForPublishedPublicEntities(t *testing.T) {
 now:=time.Now().UTC().Add(3*time.Hour)
 reader:=&stubPublicReader{places:locationui.View{Items:[]locationui.Item{
  {ID:"public-dispensary",Name:"Public shop",Kind:locationui.KindArea,Category:locationmodel.CategoryDispensary,City:"Regina"},
  {ID:"ordinary-hotel",Name:"Hotel",Kind:locationui.KindArea,Category:locationmodel.CategoryHotel,City:"Regina"},
 }},events:eventui.View{Items:[]eventui.Card{
  {ID:"pub",Title:"Public gathering",PlaceID:"public-dispensary",StartAt:now,Tags:[]string{"cannabis", "grow-tour"}},
  {ID:"private",Title:"Secret gathering",PlaceID:"private-location",StartAt:now,Tags:[]string{"cannabis"}},
  {ID:"hotel",Title:"Hotel talk",PlaceID:"ordinary-hotel",StartAt:now,Tags:[]string{"cannabis-friendly", "onsite-consumption"}},
 }}}
 for _,path:=range []string{"/travel", "/travel/events"} {
  t.Run(path,func(t *testing.T){response:=servePath(reader,path);if response.Code!=http.StatusOK {t.Fatalf("status=%d body=%s",response.Code,response.Body.String())}
   body:=response.Body.String()
   for _,want:=range []string{"Listed category: dispensary", "Tagged: cannabis event", "Tagged: grow-related attraction", "do not verify cannabis-friendly status"} {
    if !strings.Contains(body,want) {t.Errorf("missing %q",want)}
   }
   for _,bad:=range []string{"Secret gathering", "private-location", "Tagged: onsite consumption", "Verified cannabis-friendly", "Licensed dispensary"} {
    if strings.Contains(body,bad) {t.Errorf("unverified or private detail leaked: %q",bad)}
   }
  })
 }
}

func TestCannabisDescriptorsDoNotShowOnPrivateOnlyOrDisconnectedFeeds(t *testing.T) {
 reader:=&stubPublicReader{events:eventui.View{Items:[]eventui.Card{{ID:"hidden",Title:"Hidden cannabis event",PlaceID:"private",StartAt:time.Now().UTC().Add(time.Hour),Tags:[]string{"cannabis"}}}}}
 for _,path:=range []string{"/travel", "/travel/events"} {
  for _,source:=range []PublicReader{reader,nil} {
   response:=servePath(source,path)
   if response.Code!=http.StatusOK || strings.Contains(response.Body.String(),"Tagged: cannabis event") || strings.Contains(response.Body.String(),"Hidden cannabis event") {t.Fatalf("unsafe disclosure %s status=%d",path,response.Code)}
  }
 }
}

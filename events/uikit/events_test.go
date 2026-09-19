package uikit

import (
 "testing"
 "time"

 "github.com/420integrated/420-integrated/events/discovery"
 "github.com/420integrated/420-integrated/events/model"
 locationmodel "github.com/420integrated/420-integrated/location/model"
)

type fakeSource []model.Event
func (s fakeSource) ListAll() []model.Event {return append([]model.Event(nil),s...)}

func fixture() model.Event {
 start:=time.Date(2026,10,1,12,0,0,0,time.UTC)
 return model.Event{ID:"e1",Organizer:locationmodel.SubjectRef{Type:"user",ID:"u1"},Title:"Public festival",StartAt:start,EndAt:start.Add(time.Hour),Timezone:"UTC",Visibility:model.VisibilityPublic,Status:model.StatusScheduled,PlaceID:"p1",Tags:[]string{"music"},Version:1,CreatedAt:start.Add(-time.Hour),UpdatedAt:start.Add(-time.Hour)}
}
func listing(e model.Event) discovery.Entry {return discovery.Entry{EventID:e.ID,Title:e.Title,PlaceID:e.PlaceID,Tags:append([]string(nil),e.Tags...),StartAt:e.StartAt,EndAt:e.EndAt,OriginalStartAt:e.StartAt,Timezone:e.Timezone,Version:e.Version}}

func TestBuildPublicCardAndDefensiveCopy(t *testing.T){
 e:=fixture(); view,err:=Build([]discovery.Entry{listing(e)},fakeSource{e});if err!=nil{t.Fatal(err)}
 if view.Empty||len(view.Items)!=1||view.Items[0].Title!=e.Title||view.Items[0].ID!="e1|2026-10-01T12:00:00Z"{t.Fatalf("unexpected view: %+v",view)}
 view.Items[0].Tags[0]="mutated";if e.Tags[0]!="music"{t.Fatal("source tags mutated")}
}
func TestBuildFailsClosedOnVisibilityAndStaleness(t *testing.T){
 e:=fixture();entry:=listing(e)
 for _,visibility:=range []model.Visibility{model.VisibilityPrivate,model.VisibilityUnlisted,model.VisibilityFollowers,model.VisibilityCommunityOnly,model.VisibilityOrganizationMembers}{
  changed:=e;changed.Visibility=visibility
  view,err:=Build([]discovery.Entry{entry},fakeSource{changed});if err!=nil||!view.Empty{t.Fatalf("visibility %s leaked: %+v %v",visibility,view,err)}
 }
 changed:=e;changed.Status=model.StatusCancelled
 view,err:=Build([]discovery.Entry{entry},fakeSource{changed});if err!=nil||!view.Empty{t.Fatalf("cancelled event leaked: %+v %v",view,err)}
 changed=e;changed.Version=2
 view,err=Build([]discovery.Entry{entry},fakeSource{changed});if err!=nil||!view.Empty{t.Fatalf("stale event leaked: %+v %v",view,err)}
 view,err=Build([]discovery.Entry{entry},fakeSource{});if err!=nil||!view.Empty{t.Fatalf("deleted event leaked: %+v %v",view,err)}
}
func TestBuildDuplicateAndBounds(t *testing.T){
 e:=fixture();entry:=listing(e)
 if _,err:=Build([]discovery.Entry{entry,entry},fakeSource{e});err==nil{t.Fatal("duplicate occurrence accepted")}
 if _,err:=Build(make([]discovery.Entry,MaxEventCards+1),fakeSource{e});err==nil{t.Fatal("oversized view accepted")}
 if _,err:=Build([]discovery.Entry{entry},nil);err==nil{t.Fatal("missing canonical source accepted")}
 entry.Title="tampered";if _,err:=Build([]discovery.Entry{entry},fakeSource{e});err==nil{t.Fatal("tampered title accepted")}
}
func TestBuildOrdersOccurrences(t *testing.T){
 e:=fixture();first:=listing(e);second:=first;second.StartAt=first.StartAt.Add(24*time.Hour);second.EndAt=first.EndAt.Add(24*time.Hour);second.OriginalStartAt=second.StartAt
 view,err:=Build([]discovery.Entry{second,first},fakeSource{e});if err!=nil{t.Fatal(err)}
 if len(view.Items)!=2||!view.Items[0].StartAt.Before(view.Items[1].StartAt){t.Fatalf("not ordered: %+v",view)}
}

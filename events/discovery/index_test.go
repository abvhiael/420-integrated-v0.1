package discovery

import (
 "path/filepath"
 "testing"
 "time"

 "github.com/420integrated/420-integrated/events/model"
 "github.com/420integrated/420-integrated/events/repository"
 locationmodel "github.com/420integrated/420-integrated/location/model"
)

type memorySource struct{items []model.Event}
func(s memorySource)ListAll()[]model.Event{return s.items}

func event(id string,at time.Time)model.Event{
 return model.Event{ID:id,Title:"Cannabis Expo",Organizer:locationmodel.SubjectRef{Type:"ORGANIZATION",ID:"org"},StartAt:at,EndAt:at.Add(time.Hour),Timezone:"America/Regina",Visibility:model.VisibilityPublic,Status:model.StatusScheduled,Tags:[]string{"Expo","Community"},PlaceID:"hall",Version:1,CreatedAt:at.Add(-time.Hour),UpdatedAt:at.Add(-time.Hour)}
}

func TestDiscoveryFiltersNonpublicAndCancelled(t *testing.T){
 start:=time.Date(2026,10,1,18,0,0,0,time.UTC)
 visible:=event("visible",start)
 hidden:=event("private",start);hidden.Visibility=model.VisibilityPrivate
 unlisted:=event("unlisted",start);unlisted.Visibility=model.VisibilityUnlisted
 cancelled:=event("cancelled",start);cancelled.Status=model.StatusCancelled
 draft:=event("draft",start);draft.Status=model.StatusDraft
 idx:=New()
 if err:=idx.Rebuild(memorySource{[]model.Event{draft,hidden,unlisted,cancelled,visible}},start,start.Add(24*time.Hour));err!=nil{t.Fatal(err)}
 got,err:=idx.Search(Query{From:start,To:start.Add(24*time.Hour),Limit:10});if err!=nil{t.Fatal(err)}
 if len(got)!=1||got[0].EventID!="visible"{t.Fatalf("unexpected public results %+v",got)}
}

func TestRecurrenceExceptionsStablePaginationAndDeepCopy(t *testing.T){
 start:=time.Date(2026,10,1,18,0,0,0,time.UTC)
 e:=event("series",start)
 e.Recurrence=&model.RecurrenceSpec{Frequency:"DAILY",Interval:1,Count:4,Excluded:[]time.Time{start.Add(24*time.Hour)},Cancelled:[]time.Time{start.Add(48*time.Hour)}}
 idx:=New();end:=start.Add(5*24*time.Hour)
 if err:=idx.Rebuild(memorySource{[]model.Event{e}},start,end);err!=nil{t.Fatal(err)}
 first,err:=idx.Search(Query{From:start,To:end,Limit:1});if err!=nil{t.Fatal(err)}
 second,err:=idx.Search(Query{From:start,To:end,Limit:1,Offset:1});if err!=nil{t.Fatal(err)}
 if len(first)!=1||len(second)!=1||!first[0].StartAt.Equal(start)||!second[0].StartAt.Equal(start.Add(72*time.Hour)){t.Fatalf("first=%+v second=%+v",first,second)}
 first[0].Tags[0]="corrupted"
 again,err:=idx.Search(Query{From:start,To:end,Limit:10,Tag:"expo",PlaceID:"hall",Text:"cannabis"});if err!=nil{t.Fatal(err)}
 if len(again)!=2||again[0].Tags[0]!="Expo"{t.Fatalf("index aliased or filters failed %+v",again)}
}

func TestRebuildFromRestartedRepositoryAndVersion(t *testing.T){
 start:=time.Date(2026,10,1,18,0,0,0,time.UTC)
 file:=filepath.Join(t.TempDir(),"events.json")
 store,err:=repository.OpenFileStore(file);if err!=nil{t.Fatal(err)}
 e:=event("one",start)
 if _,err:=store.Create(e);err!=nil{t.Fatal(err)}
 reopened,err:=repository.OpenFileStore(file);if err!=nil{t.Fatal(err)}
 idx:=New();to:=start.Add(time.Hour)
 if err:=idx.Rebuild(reopened,start,to);err!=nil{t.Fatal(err)}
 got,err:=idx.Search(Query{From:start,To:to,Limit:10});if err!=nil{t.Fatal(err)}
 if len(got)!=1||got[0].Version!=1{t.Fatalf("restart discovery=%+v",got)}
 e.Status=model.StatusCancelled;e.Version=2;e.UpdatedAt=e.UpdatedAt.Add(time.Second)
 if _,err:=reopened.Update(e,1);err!=nil{t.Fatal(err)}
 if err:=idx.Rebuild(reopened,start,to);err!=nil{t.Fatal(err)}
 got,err=idx.Search(Query{From:start,To:to,Limit:10});if err!=nil{t.Fatal(err)}
 if len(got)!=0{t.Fatalf("cancelled event still indexed %+v",got)}
}

func TestFailedRebuildPreservesSnapshotAndBoundedQueries(t *testing.T){
 start:=time.Date(2026,10,1,18,0,0,0,time.UTC)
 idx:=New();to:=start.Add(time.Hour)
 if err:=idx.Rebuild(memorySource{[]model.Event{event("one",start)}},start,to);err!=nil{t.Fatal(err)}
 if err:=idx.Rebuild(memorySource{[]model.Event{event("invalid",time.Time{})}},start,to);err==nil{t.Fatal("expected failed rebuild")}
 got,err:=idx.Search(Query{From:start,To:to,Limit:1});if err!=nil||len(got)!=1||got[0].EventID!="one"{t.Fatalf("snapshot lost got=%+v err=%v",got,err)}
 for _,q:=range []Query{{From:start,To:to,Limit:0},{From:start,To:to,Limit:101},{From:start,To:start.Add(367*24*time.Hour),Limit:1},{From:start,To:to,Limit:1,Offset:-1}}{
  if _,err:=idx.Search(q);err==nil{t.Fatalf("unbounded query accepted %+v",q)}
 }
}

package discovery

import (
 "testing"
 "time"

 eventdiscovery "github.com/420integrated/420-integrated/events/discovery"
 "github.com/420integrated/420-integrated/events/model"
 locationmodel "github.com/420integrated/420-integrated/location/model"
)

type eventSource struct{ events []model.Event }
func(s eventSource)ListAll()[]model.Event{return s.events}

func searchEvent(id string,start time.Time)model.Event{
 return model.Event{ID:id,Organizer:locationmodel.SubjectRef{Type:"ORGANIZATION",ID:"org"},Title:"Public event",StartAt:start,EndAt:start.Add(time.Hour),Timezone:"UTC",Visibility:model.VisibilityPublic,Status:model.StatusScheduled,Version:1,CreatedAt:start.Add(-time.Hour),UpdatedAt:start.Add(-time.Hour)}
}

func TestEventProjectionFiltersAndRebuildRemovesStaleResults(t *testing.T){
 start:=time.Date(2026,10,1,18,0,0,0,time.UTC)
 from,to:=start.Add(-time.Hour),start.AddDate(0,0,5)
 public:=searchEvent("public",start)
 public.Recurrence=&model.RecurrenceSpec{Frequency:"DAILY",Interval:1,Count:3,Cancelled:[]time.Time{start.AddDate(0,0,1)},Excluded:[]time.Time{start.AddDate(0,0,2)}}
 private:=searchEvent("private",start);private.Visibility=model.VisibilityPrivate
 ended:=searchEvent("ended",start);ended.Status=model.StatusEnded
 index:=eventdiscovery.New()
 if err:=index.Rebuild(eventSource{[]model.Event{public,private,ended}},from,to);err!=nil{t.Fatal(err)}
 projector:=EventProjection{Index:index,Now:func()time.Time{return start}}
 first,err:=projector.Project(from,to);if err!=nil{t.Fatal(err)}
 if len(first)!=1||first[0].Presentation.Title!="Public event"||first[0].Presentation.Category!="event"{t.Fatalf("unexpected projection: %+v",first)}
 if err:=first[0].Validate();err!=nil{t.Fatal(err)}
 second,err:=projector.Project(from,to);if err!=nil{t.Fatal(err)}
 if len(second)!=1||first[0].ID!=second[0].ID{t.Fatal("unstable result identity")}
 public.Status=model.StatusCancelled
 if err:=index.Rebuild(eventSource{[]model.Event{public}},from,to);err!=nil{t.Fatal(err)}
 after,err:=projector.Project(from,to);if err!=nil{t.Fatal(err)}
 if len(after)!=0{t.Fatalf("stale results after cancellation: %+v",after)}
}

func TestEventProjectionDistinctRecurrences(t *testing.T){
 start:=time.Date(2026,10,1,18,0,0,0,time.UTC)
 e:=searchEvent("series",start)
 e.Recurrence=&model.RecurrenceSpec{Frequency:"DAILY",Interval:1,Count:2}
 index:=eventdiscovery.New()
 if err:=index.Rebuild(eventSource{[]model.Event{e}},start,start.AddDate(0,0,3));err!=nil{t.Fatal(err)}
 results,err:=(EventProjection{Index:index,Now:func()time.Time{return start}}).Project(start,start.AddDate(0,0,3))
 if err!=nil{t.Fatal(err)}
 if len(results)!=2||results[0].ID==results[1].ID{t.Fatalf("occurrence IDs not distinct: %+v",results)}
 for _,r:=range results{if r.Provenance.Authority!="420Events canonical public event repository"||r.Provenance.Source!="420Events:public"||r.Ranking.Canonical||r.Sponsorship.Canonical{t.Fatalf("authority leak: %+v",r)}}
}

func TestEventProjectionRequiresDependencies(t *testing.T){
 start:=time.Date(2026,10,1,18,0,0,0,time.UTC)
 if _,err:=(EventProjection{}).Project(start,start.Add(time.Hour));err==nil{t.Fatal("nil index accepted")}
 if _,err:=(EventProjection{Index:eventdiscovery.New()}).Project(start,start.Add(time.Hour));err==nil{t.Fatal("nil clock accepted")}
}

package httpapi_test

import (
 "context"
 "net/http/httptest"
 "path/filepath"
 "strings"
 "testing"
 "time"

 "github.com/420integrated/420-integrated/events/discovery"
 eventmodel "github.com/420integrated/420-integrated/events/model"
 eventrepo "github.com/420integrated/420-integrated/events/repository"
 "github.com/420integrated/420-integrated/genesis/svc2/httpapi"
 "github.com/420integrated/420-integrated/genesis/svc2/sdk"
 locationmodel "github.com/420integrated/420-integrated/location/model"
)

func persistedEvent(id, place string, start time.Time) eventmodel.Event {
 return eventmodel.Event{
  ID:id,Organizer:locationmodel.SubjectRef{Type:"user",ID:"organizer"},
  Title:"Public event "+id,DescriptionRef:"private-description-ref",PlaceID:place,
  StartAt:start,EndAt:start.Add(time.Hour),Timezone:"UTC",
  Visibility:eventmodel.VisibilityPublic,Status:eventmodel.StatusScheduled,
  Version:1,CreatedAt:start.Add(-time.Hour),UpdatedAt:start.Add(-time.Hour),
 }
}

func TestEventsE2ERepositoryDiscoveryHTTPAndSDK(t *testing.T) {
 ctx:=context.Background()
 path:=filepath.Join(t.TempDir(),"events.json")
 store,err:=eventrepo.OpenFileStore(path);if err!=nil{t.Fatal(err)}
 if err:=store.Ready(ctx);err!=nil{t.Fatal(err)}
 start:=time.Date(2026,10,1,12,0,0,0,time.UTC)
 first:=persistedEvent("public-1","venue-1",start)
 if _,err:=store.Create(first);err!=nil{t.Fatal(err)}
 unlisted:=persistedEvent("unlisted-1","venue-1",start.Add(time.Hour))
 unlisted.Visibility=eventmodel.VisibilityUnlisted
 if _,err:=store.Create(unlisted);err!=nil{t.Fatal(err)}
 // An actual repository restart must preserve canonical records and privacy.
 store,err=eventrepo.OpenFileStore(path);if err!=nil{t.Fatal(err)}
 if stored,err:=store.Get(first.ID);err!=nil||stored.Title!=first.Title{t.Fatalf("reopen: %+v %v",stored,err)}
 from,to:=start.Add(-time.Hour),start.Add(72*time.Hour)
 index:=discovery.New()
 if err:=index.Rebuild(store,from,to);err!=nil{t.Fatal(err)}
 server:=httptest.NewServer(httpapi.Server{Events:store,Discovery:index}.Handler());defer server.Close()
 client:=sdk.Client{BaseURL:server.URL,HTTP:server.Client()}
 query:=sdk.EventQuery{From:from,To:to,Limit:10}
 read:=func() []string {
  t.Helper()
  view,err:=client.Events(ctx,query);if err!=nil{t.Fatal(err)}
  ids:=make([]string,0,len(view.Items))
  for _,item:=range view.Items {ids=append(ids,item.EventID)}
  if view.Empty!=(len(ids)==0){t.Fatalf("incorrect empty flag: %+v",view)}
  return ids
 }
 if ids:=read();len(ids)!=1||ids[0]!=first.ID{t.Fatalf("public discovery returned %v",ids)}
 response,err:=server.Client().Get(server.URL+"/v1/events?from=2026-10-01T11:00:00Z&to=2026-10-04T12:00:00Z&limit=10");if err!=nil{t.Fatal(err)}
 body:=make([]byte,4096);n,_:=response.Body.Read(body);response.Body.Close()
 if response.StatusCode!=200{t.Fatalf("HTTP status: %d",response.StatusCode)}
 for _,secret:=range []string{"unlisted-1","private-description-ref","organizer","LifecycleHistory","TicketReference"}{
  if strings.Contains(string(body[:n]),secret){t.Fatalf("canonical/private field exposed: %s",secret)}
 }
 // A cached discovery snapshot must not override current canonical visibility.
 first.Visibility=eventmodel.VisibilityPrivate;first.Version=2;first.UpdatedAt=first.UpdatedAt.Add(time.Minute)
 if _,err:=store.Update(first,1);err!=nil{t.Fatal(err)}
 if ids:=read();len(ids)!=0{t.Fatalf("stale discovery leaked private event: %v",ids)}
 // After a restart the public index must still exclude the persisted private event.
 store,err=eventrepo.OpenFileStore(path);if err!=nil{t.Fatal(err)}
 if err:=index.Rebuild(store,from,to);err!=nil{t.Fatal(err)}
 restarted:=httptest.NewServer(httpapi.Server{Events:store,Discovery:index}.Handler());defer restarted.Close()
 client.BaseURL=restarted.URL;client.HTTP=restarted.Client()
 if ids:=read();len(ids)!=0{t.Fatalf("persisted private event leaked: %v",ids)}
 // Publishing again requires a canonical version change and explicit rebuild.
 first.Visibility=eventmodel.VisibilityPublic;first.Version=3;first.UpdatedAt=first.UpdatedAt.Add(time.Minute)
 if _,err:=store.Update(first,2);err!=nil{t.Fatal(err)}
 if ids:=read();len(ids)!=0{t.Fatalf("stale version leaked: %v",ids)}
 if err:=index.Rebuild(store,from,to);err!=nil{t.Fatal(err)}
 if ids:=read();len(ids)!=1||ids[0]!=first.ID{t.Fatalf("republished event not visible: %v",ids)}
 first.Status=eventmodel.StatusCancelled;first.Version=4;first.UpdatedAt=first.UpdatedAt.Add(time.Minute)
 if _,err:=store.Update(first,3);err!=nil{t.Fatal(err)}
 if ids:=read();len(ids)!=0{t.Fatalf("cancelled event leaked through old index: %v",ids)}
 if err:=index.Rebuild(store,from,to);err!=nil{t.Fatal(err)}
 if ids:=read();len(ids)!=0{t.Fatalf("cancelled event leaked through rebuilt index: %v",ids)}
}

func TestEventsE2ERecurrenceCancellationPlaceFilterAndPagination(t *testing.T){
 path:=filepath.Join(t.TempDir(),"recurring.json")
 store,err:=eventrepo.OpenFileStore(path);if err!=nil{t.Fatal(err)}
 start:=time.Date(2026,10,1,12,0,0,0,time.UTC)
 recurring:=persistedEvent("recurring-1","venue-1",start)
 recurring.Recurrence=&eventmodel.RecurrenceSpec{Frequency:"DAILY",Interval:1,Count:3,Cancelled:[]time.Time{start.Add(24*time.Hour)}}
 if _,err:=store.Create(recurring);err!=nil{t.Fatal(err)}
 other:=persistedEvent("other-venue","venue-2",start.Add(30*time.Minute))
 if _,err:=store.Create(other);err!=nil{t.Fatal(err)}
 store,err=eventrepo.OpenFileStore(path);if err!=nil{t.Fatal(err)}
 from,to:=start.Add(-time.Hour),start.Add(4*24*time.Hour)
 index:=discovery.New();if err:=index.Rebuild(store,from,to);err!=nil{t.Fatal(err)}
 server:=httptest.NewServer(httpapi.Server{Events:store,Discovery:index}.Handler());defer server.Close()
 client:=sdk.Client{BaseURL:server.URL,HTTP:server.Client()}
 q:=sdk.EventQuery{From:from,To:to,PlaceID:"venue-1",Limit:10}
 view,err:=client.Events(context.Background(),q);if err!=nil{t.Fatal(err)}
 if len(view.Items)!=2||view.Items[0].EventID!=recurring.ID||view.Items[1].EventID!=recurring.ID{t.Fatalf("filtered recurring events: %+v",view)}
 if !view.Items[0].StartAt.Equal(start)||!view.Items[1].StartAt.Equal(start.Add(48*time.Hour)){t.Fatalf("cancelled occurrence was returned: %+v",view)}
 if view.Items[0].ID==view.Items[1].ID{t.Fatal("recurrence occurrence IDs not unique")}
 q.Limit=1;q.Offset=1
 page,err:=client.Events(context.Background(),q);if err!=nil{t.Fatal(err)}
 if len(page.Items)!=1||page.Items[0].ID!=view.Items[1].ID{t.Fatalf("pagination changed order or filter: %+v",page)}
}

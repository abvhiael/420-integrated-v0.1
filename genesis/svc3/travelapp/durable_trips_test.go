package travelapp

import (
 "context"
 "errors"
 "net/http"
 "net/http/httptest"
 "net/url"
 "os"
 "path/filepath"
 "strings"
 "sync"
 "testing"
)

func privateTripDir(t *testing.T)string {t.Helper();dir:=t.TempDir();if err:=os.Chmod(dir,0700);err!=nil{t.Fatal(err)};return dir}
func openTripFixture(t *testing.T,dir string)*DurableTripStore {t.Helper();s,err:=OpenDurableTripStore(dir);if err!=nil{t.Fatal(err)};t.Cleanup(func(){_ = s.Close()});return s}

func TestDurableTripsRestartOwnerIsolationAndPublicIndex(t *testing.T) {
 dir:=privateTripDir(t);ctx:=context.Background();s:=openTripFixture(t,dir)
 if _,err:=s.Create(ctx,"alice",Trip{ID:"private-1",OwnerID:"bob",Title:"private itinerary",Visibility:TripPrivate});err!=nil{t.Fatal(err)}
 if _,err:=s.Create(ctx,"alice",Trip{ID:"unlisted-1",Title:"unlisted itinerary",Visibility:TripUnlisted});err!=nil{t.Fatal(err)}
 if _,err:=s.Create(ctx,"bob",Trip{ID:"public-1",Title:"public itinerary",Visibility:TripPublic});err!=nil{t.Fatal(err)}
 if _,err:=s.GetOwned(ctx,"bob","private-1");!errors.Is(err,ErrTripNotFound){t.Fatalf("cross-owner read: %v",err)}
 if _,err:=s.Replace(ctx,"bob",Trip{ID:"private-1",Title:"stolen",Visibility:TripPublic});!errors.Is(err,ErrTripNotFound){t.Fatalf("cross-owner write: %v",err)}
 if err:=s.Delete(ctx,"bob","private-1");!errors.Is(err,ErrTripNotFound){t.Fatalf("cross-owner delete: %v",err)}
 public,err:=s.ListPublic(ctx);if err!=nil||len(public)!=1||public[0].ID!="public-1"{t.Fatalf("public index leaked: %+v %v",public,err)}
 if err:=s.Close();err!=nil{t.Fatal(err)}
 s=openTripFixture(t,dir)
 owned,err:=s.ListOwned(ctx,"alice");if err!=nil||len(owned)!=2{t.Fatalf("restart lost private data: %+v %v",owned,err)}
 if owned[0].OwnerID!="alice"||owned[1].OwnerID!="alice"{t.Fatalf("persisted forged owner: %+v",owned)}
 public,err=s.ListPublic(ctx);if err!=nil||len(public)!=1||public[0].ID!="public-1"{t.Fatalf("public index after restart: %+v %v",public,err)}
 if _,err:=s.Create(ctx,"alice",Trip{ID:"public-1",Title:"duplicate",Visibility:TripPrivate});!errors.Is(err,ErrTripConflict){t.Fatalf("duplicate persisted ID: %v",err)}
 replacement,err:=s.Replace(ctx,"alice",Trip{ID:"private-1",Title:"updated",Visibility:TripPrivate});if err!=nil||replacement.Title!="updated"{t.Fatalf("replace: %+v %v",replacement,err)}
 if err:=s.Delete(ctx,"alice","private-1");err!=nil{t.Fatal(err)}
 if err:=s.Close();err!=nil{t.Fatal(err)}
 s=openTripFixture(t,dir)
 if _,err:=s.GetOwned(ctx,"alice","private-1");!errors.Is(err,ErrTripNotFound){t.Fatalf("deleted trip reappeared: %v",err)}
 info,err:=os.Stat(filepath.Join(dir,"trips.json"));if err!=nil||info.Mode().Perm()!=0600{t.Fatalf("snapshot permissions: %v %v",info,err)}
}

func TestDurableTripsExclusiveWriterAndUnsafePaths(t *testing.T) {
 dir:=privateTripDir(t);s:=openTripFixture(t,dir)
 if another,err:=OpenDurableTripStore(dir);err==nil{another.Close();t.Fatal("concurrent writer admitted")}
 if err:=s.Close();err!=nil{t.Fatal(err)}
 if _,err:=OpenDurableTripStore(dir);err!=nil{t.Fatalf("lock not released: %v",err)}
 // Close the separately opened instance before its temporary directory goes away.
 reopened,err:=OpenDurableTripStore(dir);if err==nil{reopened.Close();t.Fatal("second writer admitted")}
 world:=t.TempDir();if err:=os.Chmod(world,0755);err!=nil{t.Fatal(err)}
 if _,err:=OpenDurableTripStore(world);err==nil{t.Fatal("world-readable directory admitted")}
 link:=filepath.Join(t.TempDir(),"link");if err:=os.Symlink(dir,link);err!=nil{t.Fatal(err)}
 if _,err:=OpenDurableTripStore(link);err==nil{t.Fatal("symlink directory admitted")}
}

func TestDurableTripsConcurrentCreateAndHTTPIdentityBinding(t *testing.T) {
 dir:=privateTripDir(t);s:=openTripFixture(t,dir);ctx:=context.Background()
 var wg sync.WaitGroup;fail:=make(chan error,20)
 for i:=0;i<20;i++{wg.Add(1);go func(i int){defer wg.Done();id:=strings.Repeat("x",i+1);_,err:=s.Create(ctx,"owner",Trip{ID:id,Title:"plan",Visibility:TripPrivate});if err!=nil{fail<-err}}(i)}
 wg.Wait();close(fail);for err:=range fail{t.Fatal(err)}
 alice,err:=s.ListOwned(ctx,"owner");if err!=nil||len(alice)!=20{t.Fatalf("concurrent lost updates: %d %v",len(alice),err)}
 token:=strings.Repeat("s",40)
 h:=HandlerWithUserDependencies(nil,TravelUserDependencies{Identity:testIdentity{subject:"alice",token:token},Trips:s,Claims:NewClaimStore(nil)})
 form:=url.Values{"title":{"from secure session"},"visibility":{"PRIVATE"},"owner_id":{"bob"},"csrf_token":{token}}
 request:=httptest.NewRequest(http.MethodPost,"/travel/trips",strings.NewReader(form.Encode()));request.Header.Set("Content-Type","application/x-www-form-urlencoded")
 response:=httptest.NewRecorder();h.ServeHTTP(response,request)
 if response.Code!=http.StatusSeeOther{t.Fatalf("identity-bound POST: %d %s",response.Code,response.Body.String())}
 bob,err:=s.ListOwned(ctx,"bob");if err!=nil||len(bob)!=0{t.Fatalf("forged owner persisted: %+v %v",bob,err)}
 if err:=s.Close();err!=nil{t.Fatal(err)}
 reopened:=openTripFixture(t,dir);owned,err:=reopened.ListOwned(ctx,"alice")
 if err!=nil||len(owned)!=1||owned[0].Title!="from secure session"{t.Fatalf("HTTP-created trip not durable: %+v %v",owned,err)}
}

func TestDurableTripsRejectCorruptSnapshot(t *testing.T){
 dir:=privateTripDir(t);if err:=os.WriteFile(filepath.Join(dir,"trips.json"),[]byte(`{"version":1,"trips":[{"id":"x","title":"forged"}]}`),0600);err!=nil{t.Fatal(err)}
 if s,err:=OpenDurableTripStore(dir);err==nil{s.Close();t.Fatal("corrupt snapshot accepted")}
}

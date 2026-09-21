package deployment

import (
 "net/http"
 "net/http/httptest"
 "os"
 "path/filepath"
 "strings"
 "testing"
 "time"

 eventrepo "github.com/420integrated/420-integrated/events/repository"
 placerepo "github.com/420integrated/420-integrated/location/repository"
)

func TestRequiredConfigurationFailsClosed(t *testing.T){
 if _,err:=NewHandler(Config{});err==nil {t.Fatal("missing source ID accepted")}
 if _,err:=NewHandler(Config{SourceID:"canonical"});err==nil {t.Fatal("missing repository paths accepted")}
 dir:=t.TempDir()
 if _,err:=NewHandler(Config{SourceID:"canonical",PlacesPath:filepath.Join(dir,"missing-places.json"),EventsPath:filepath.Join(dir,"missing-events.json")});err==nil {t.Fatal("missing snapshots were silently created")}
 if _,err:=NewHandler(Config{SourceID:"canonical",PlacesPath:dir,EventsPath:dir});err==nil {t.Fatal("directories accepted as snapshots")}
}

func TestPublicEndpointsAndReadiness(t *testing.T){
 dir:=t.TempDir();placesPath:=filepath.Join(dir,"places.json");eventsPath:=filepath.Join(dir,"events.json")
 if _,err:=placerepo.OpenFileStore(placesPath);err!=nil {t.Fatal(err)}
 if _,err:=eventrepo.OpenFileStore(eventsPath);err!=nil {t.Fatal(err)}
 h,err:=NewHandler(Config{SourceID:"authorized-publisher",PlacesPath:placesPath,EventsPath:eventsPath});if err!=nil {t.Fatal(err)}
 for _,tc:=range []struct{path string;status int;contains string}{
  {"/readyz",200,"canonical snapshots readable"},
  {"/v1/places",200,"\"version\":\"v1\""},
  {"/v1/events?from="+time.Now().UTC().Format(time.RFC3339)+"&to="+time.Now().UTC().Add(24*time.Hour).Format(time.RFC3339)+"&limit=10",200,"\"version\":\"v1\""},
  {"/v1/events?from=bad&to=bad",400,"invalid"},
 }{
  response:=httptest.NewRecorder();h.ServeHTTP(response,httptest.NewRequest(http.MethodGet,tc.path,nil))
  if response.Code!=tc.status||!strings.Contains(response.Body.String(),tc.contains){t.Fatalf("%s: status=%d body=%s",tc.path,response.Code,response.Body.String())}
 }
 denied:=httptest.NewRecorder();h.ServeHTTP(denied,httptest.NewRequest(http.MethodPost,"/v1/places",nil));if denied.Code==http.StatusOK{t.Fatal("mutation accepted")}
 if err:=os.Remove(eventsPath);err!=nil {t.Fatal(err)}
 for _,path:=range []string{"/readyz","/v1/places"}{response:=httptest.NewRecorder();h.ServeHTTP(response,httptest.NewRequest(http.MethodGet,path,nil));if response.Code!=503{t.Fatalf("%s after storage removal: %d",path,response.Code)}}
}

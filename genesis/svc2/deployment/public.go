// Package deployment wires the existing GEN-SVC-2 read-only HTTP API to
// explicitly provisioned canonical Location and Events repositories.
package deployment

import (
 "errors"
 "fmt"
 "net/http"
 "os"
 "path/filepath"
 "strings"
 "time"

 "github.com/420integrated/420-integrated/events/discovery"
 eventrepo "github.com/420integrated/420-integrated/events/repository"
 "github.com/420integrated/420-integrated/genesis/svc2/httpapi"
 placerepo "github.com/420integrated/420-integrated/location/repository"
)

// Config requires existing snapshots from the authorized publisher. SourceID
// identifies the operator-configured data source; it is NOT proof of provenance.
type Config struct {
 PlacesPath string
 EventsPath string
 SourceID string
}

func existingSnapshot(path string) (string, error) {
 if strings.TrimSpace(path)=="" { return "",errors.New("canonical snapshot path is required") }
 absolute,err:=filepath.Abs(filepath.Clean(path));if err!=nil{return "",err}
 info,err:=os.Lstat(absolute);if err!=nil{return "",fmt.Errorf("canonical snapshot unavailable: %w",err)}
 if !info.Mode().IsRegular()||info.Size()==0{return "",errors.New("canonical snapshot must be an existing nonempty regular file")}
 if info.Mode().Perm()&0o022!=0{return "",errors.New("canonical snapshot must not be group/world writable")}
 return absolute,nil
}

// NewHandler rejects missing/unreadable canonical repositories at startup.
// The publisher owns and updates the snapshots; this process exposes no writes.
// Loading new snapshots on each request avoids serving stale in-memory data
// after a publisher atomically replaces a canonical snapshot.
func NewHandler(config Config)(http.Handler,error){
 if strings.TrimSpace(config.SourceID)=="" {return nil,errors.New("SVC2_PUBLICATION_SOURCE is required")}
 placesPath,err:=existingSnapshot(config.PlacesPath);if err!=nil{return nil,fmt.Errorf("places: %w",err)}
 eventsPath,err:=existingSnapshot(config.EventsPath);if err!=nil{return nil,fmt.Errorf("events: %w",err)}
 if placesPath==eventsPath{return nil,errors.New("places and events snapshots must differ")}
 load:=func()(*placerepo.FileStore,*eventrepo.FileStore,error){
  if _,err:=existingSnapshot(placesPath);err!=nil{return nil,nil,err}
  if _,err:=existingSnapshot(eventsPath);err!=nil{return nil,nil,err}
  places,err:=placerepo.OpenFileStore(placesPath);if err!=nil{return nil,nil,err}
  events,err:=eventrepo.OpenFileStore(eventsPath);if err!=nil{return nil,nil,err}
  return places,events,nil
 }
 if _,_,err:=load();err!=nil{return nil,fmt.Errorf("load canonical snapshots: %w",err)}
 return http.HandlerFunc(func(w http.ResponseWriter,r *http.Request){
  w.Header().Set("Cache-Control","no-store")
  w.Header().Set("X-Content-Type-Options","nosniff")
  places,events,err:=load();if err!=nil {http.Error(w,"public feed unavailable",http.StatusServiceUnavailable);return}
  if r.URL.Path=="/readyz" {
   if r.Method!=http.MethodGet {w.Header().Set("Allow","GET");http.Error(w,"method not allowed",http.StatusMethodNotAllowed);return}
   w.Header().Set("Content-Type","text/plain; charset=utf-8")
   _,_=w.Write([]byte("canonical snapshots readable; publication provenance requires independent verification\n"));return
  }
  index:=discovery.New()
  if r.URL.Path=="/v1/events"&&r.Method==http.MethodGet {
   from,errFrom:=time.Parse(time.RFC3339,r.URL.Query().Get("from"))
   to,errTo:=time.Parse(time.RFC3339,r.URL.Query().Get("to"))
   if errFrom==nil&&errTo==nil {
    if err:=index.Rebuild(events,from,to);err!=nil {
     // Invalid windows are rejected by the existing API. Any failure on an
     // otherwise valid window must not silently return an empty 200 response.
     if from.IsZero()||to.IsZero()||to.Before(from)||to.Sub(from)>discovery.MaxWindow {
      httpapi.Server{Places:places,Events:events,Discovery:index}.Handler().ServeHTTP(w,r);return
     }
     http.Error(w,"public event discovery unavailable",http.StatusServiceUnavailable);return
    }
   }
  }
  httpapi.Server{Places:places,Events:events,Discovery:index}.Handler().ServeHTTP(w,r)
 }),nil
}

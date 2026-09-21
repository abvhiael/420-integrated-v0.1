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

// Config requires existing snapshots from the authorized publisher. Merely
// creating empty stores is not a valid deployment data-source configuration.
type Config struct {
 PlacesPath string
 EventsPath string
 SourceID string // operator-managed provenance identifier, not proof of publication
}

func existingSnapshot(path string) (string, error) {
 if strings.TrimSpace(path)=="" { return "",errors.New("canonical snapshot path is required") }
 absolute,err:=filepath.Abs(filepath.Clean(path));if err!=nil{return "",err}
 info,err:=os.Lstat(absolute);if err!=nil{return "",fmt.Errorf("canonical snapshot unavailable: %w",err)}
 if !info.Mode().IsRegular()||info.Size()==0{return "",errors.New("canonical snapshot must be an existing nonempty regular file")}
 if info.Mode().Perm()&0o022!=0{return "",errors.New("canonical snapshot must not be group/world writable")}
 return absolute,nil
}

// NewHandler accepts only existing, validated canonical snapshots. This is a
// single-process read-only deployment; all writes belong to an independently
// qualified canonical publisher, not to this HTTP process.
func NewHandler(config Config)(http.Handler,error){
 if strings.TrimSpace(config.SourceID)=="" {return nil,errors.New("SVC2_PUBLICATION_SOURCE is required")}
 placesPath,err:=existingSnapshot(config.PlacesPath);if err!=nil{return nil,fmt.Errorf("places: %w",err)}
 eventsPath,err:=existingSnapshot(config.EventsPath);if err!=nil{return nil,fmt.Errorf("events: %w",err)}
 if placesPath==eventsPath{return nil,errors.New("places and events snapshots must differ")}
 places,err:=placerepo.OpenFileStore(placesPath);if err!=nil{return nil,fmt.Errorf("load canonical places: %w",err)}
 events,err:=eventrepo.OpenFileStore(eventsPath);if err!=nil{return nil,fmt.Errorf("load canonical events: %w",err)}
 // Construct a new discovery index for each event request: there is never a
 // stale shared index after an event publication/cancellation or time rollover.
 // The index is rebuilt for the exact requested interval; the existing HTTP
 // API remains the authority for query parsing and error responses.
 return http.HandlerFunc(func(w http.ResponseWriter,r *http.Request){
  w.Header().Set("Cache-Control","no-store")
  w.Header().Set("X-Content-Type-Options","nosniff")
  if _,err:=existingSnapshot(placesPath);err!=nil {http.Error(w,"public feed unavailable",http.StatusServiceUnavailable);return}
  if _,err:=existingSnapshot(eventsPath);err!=nil {http.Error(w,"public feed unavailable",http.StatusServiceUnavailable);return}
  if r.URL.Path=="/readyz" {
   if r.Method!=http.MethodGet {w.Header().Set("Allow","GET");http.Error(w,"method not allowed",http.StatusMethodNotAllowed);return}
   // Check both public projections, not just that their files exist.
   if _,err:=placerepo.OpenFileStore(placesPath);err!=nil {http.Error(w,"public feed unavailable",http.StatusServiceUnavailable);return}
   if _,err:=eventrepo.OpenFileStore(eventsPath);err!=nil {http.Error(w,"public feed unavailable",http.StatusServiceUnavailable);return}
   w.Header().Set("Content-Type","text/plain; charset=utf-8")
   _,_=w.Write([]byte("public projection storage available; publication not independently verified\n"));return
  }
  index:=discovery.New()
  if r.URL.Path=="/v1/events"&&r.Method==http.MethodGet {
   from,errFrom:=time.Parse(time.RFC3339,r.URL.Query().Get("from"))
   to,errTo:=time.Parse(time.RFC3339,r.URL.Query().Get("to"))
   if errFrom==nil&&errTo==nil {
    if err:=index.Rebuild(events,from,to);err!=nil {httpapi.Server{Places:places,Events:events,Discovery:index}.Handler().ServeHTTP(w,r);return}
   }
  }
  httpapi.Server{Places:places,Events:events,Discovery:index}.Handler().ServeHTTP(w,r)
 }),nil
}

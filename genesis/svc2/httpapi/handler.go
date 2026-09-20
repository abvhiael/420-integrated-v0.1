// Package httpapi defines the versioned, read-only public GEN-SVC-2 API.
// Private records are never serialized; mutations remain with canonical services.
package httpapi

import (
 "encoding/json"
 "net/http"
 "strconv"
 "time"

 eventdiscovery "github.com/420integrated/420-integrated/events/discovery"
 eventuikit "github.com/420integrated/420-integrated/events/uikit"
 locationmodel "github.com/420integrated/420-integrated/location/model"
 locationuikit "github.com/420integrated/420-integrated/location/uikit"
)

const Version = "v1"

type Places interface { ListAll() []locationmodel.Place }

// Discovery is explicitly rebuilt by the application when canonical event
// data changes. HTTP and its SDK never become a lifecycle authority.
type Server struct {
 Places Places
 Events eventdiscovery.Source
 Discovery *eventdiscovery.Index
}

func (s Server) Handler() http.Handler {
 mux:=http.NewServeMux()
 mux.HandleFunc("GET /v1/places",s.places)
 mux.HandleFunc("GET /v1/events",s.events)
 return mux
}

type envelope[T any] struct { Version string `json:"version"`; Data T `json:"data"` }
type apiError struct { Error string `json:"error"` }
func reply(w http.ResponseWriter,status int,payload any) {
 w.Header().Set("Content-Type","application/json; charset=utf-8")
 w.Header().Set("Cache-Control","no-store")
 w.Header().Set("X-Content-Type-Options","nosniff")
 w.WriteHeader(status)
 _=json.NewEncoder(w).Encode(payload)
}
func reject(w http.ResponseWriter,status int,message string){reply(w,status,apiError{Error:message})}

func (s Server) places(w http.ResponseWriter,r *http.Request){
 if s.Places==nil {reject(w,http.StatusServiceUnavailable,"place source unavailable");return}
 if len(r.URL.Query())!=0 {reject(w,http.StatusBadRequest,"unsupported places parameters");return}
 public:=make([]locationmodel.Place,0)
 for _,p:=range s.Places.ListAll() {if p.Visibility==locationmodel.VisibilityPublic {public=append(public,p)}}
 view,err:=locationuikit.Build(public)
 if err!=nil {reject(w,http.StatusUnprocessableEntity,"place projection unavailable");return}
 reply(w,http.StatusOK,envelope[locationuikit.View]{Version:Version,Data:view})
}

func (s Server) events(w http.ResponseWriter,r *http.Request){
 if s.Events==nil||s.Discovery==nil {reject(w,http.StatusServiceUnavailable,"event source unavailable");return}
 values:=r.URL.Query()
 for key,all:=range values {
  switch key {case "from","to","limit","offset","placeId": default:reject(w,http.StatusBadRequest,"unsupported events parameter");return}
  if len(all)!=1 {reject(w,http.StatusBadRequest,"duplicate events parameter");return}
 }
 from,err:=time.Parse(time.RFC3339,values.Get("from"));if err!=nil {reject(w,http.StatusBadRequest,"invalid from time");return}
 to,err:=time.Parse(time.RFC3339,values.Get("to"));if err!=nil {reject(w,http.StatusBadRequest,"invalid to time");return}
 limit:=50
 if raw:=values.Get("limit");raw!="" {limit,err=strconv.Atoi(raw);if err!=nil {reject(w,http.StatusBadRequest,"invalid limit");return}}
 offset:=0
 if raw:=values.Get("offset");raw!="" {offset,err=strconv.Atoi(raw);if err!=nil {reject(w,http.StatusBadRequest,"invalid offset");return}}
 if limit<1||limit>eventuikit.MaxEventCards||offset<0 {reject(w,http.StatusBadRequest,"invalid pagination");return}
 entries,err:=s.Discovery.Search(eventdiscovery.Query{From:from,To:to,Limit:limit,Offset:offset,PlaceID:values.Get("placeId")})
 if err!=nil {reject(w,http.StatusBadRequest,"invalid event search window or pagination");return}
 view,err:=eventuikit.Build(entries,s.Events)
 if err!=nil {reject(w,http.StatusUnprocessableEntity,"event projection unavailable");return}
 reply(w,http.StatusOK,envelope[eventuikit.View]{Version:Version,Data:view})
}

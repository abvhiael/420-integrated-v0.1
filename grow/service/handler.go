// Package service exposes a read-only, versioned Grow discovery projection.
package service

import (
 "context"
 "encoding/json"
 "net/http"
 "strconv"
 "strings"
 "time"

 grow "github.com/420integrated/420-integrated/grow/location"
 "github.com/420integrated/420-integrated/location/model"
 "github.com/420integrated/420-integrated/location/uikit"
)

type Reader interface { Read(context.Context) (grow.View,error) }
type ReaderFunc func(context.Context)(grow.View,error)
func (f ReaderFunc) Read(ctx context.Context)(grow.View,error){return f(ctx)}
type Handler struct { Reader Reader }
// New binds the handler exclusively to the validated 420Location public SDK.
func New(source interface{ Places(context.Context)(uikit.View,error) }) Handler {
 return Handler{Reader:ReaderFunc(func(ctx context.Context)(grow.View,error){return grow.Read(ctx,source)})}
}
type response struct { Version string `json:"version"`; Data page `json:"data"` }
type page struct { Items []grow.Card `json:"items"`; Empty bool `json:"empty"`; NextOffset *int `json:"nextOffset,omitempty"`; Total int `json:"total"` }
func (h Handler) ServeHTTP(w http.ResponseWriter,r *http.Request){
 w.Header().Set("Cache-Control","no-store")
 w.Header().Set("X-Content-Type-Options","nosniff")
 w.Header().Set("Content-Type","application/json; charset=utf-8")
 fail:=func(status int){w.WriteHeader(status);_ = json.NewEncoder(w).Encode(map[string]string{"error":"public discovery unavailable"})}
 if r.URL.Path!="/v1/grow/places"{fail(http.StatusNotFound);return}
 if r.Method!=http.MethodGet{w.Header().Set("Allow","GET");fail(http.StatusMethodNotAllowed);return}
 q:=r.URL.Query()
 for key,values:=range q {if key!="category"&&key!="query"&&key!="limit"&&key!="offset"||len(values)!=1{fail(http.StatusBadRequest);return}}
 category:=q.Get("category")
 if category!=""&&category!="ALL"&&category!=string(model.CategoryFarm)&&category!=string(model.CategoryBusiness){fail(http.StatusBadRequest);return}
 query:=strings.TrimSpace(q.Get("query"));if len(query)>120{fail(http.StatusBadRequest);return}
 limit:=50;offset:=0
 if q.Has("limit"){v,e:=strconv.Atoi(q.Get("limit"));if e!=nil||v<1||v>100{fail(http.StatusBadRequest);return};limit=v}
 if q.Has("offset"){v,e:=strconv.Atoi(q.Get("offset"));if e!=nil||v<0||v>100000{fail(http.StatusBadRequest);return};offset=v}
 if h.Reader==nil{fail(http.StatusServiceUnavailable);return}
 ctx,cancel:=context.WithTimeout(r.Context(),8*time.Second);defer cancel()
 view,err:=h.Reader.Read(ctx);if err!=nil{fail(http.StatusServiceUnavailable);return}
 if !view.ProvenanceAvailable||view.Empty!=(len(view.Items)==0){fail(http.StatusBadGateway);return}
 // Validate the public projection through the upstream Grow adapter, which is
 // expected to run before this handler. This endpoint never reads canonical state.
 filtered:=make([]grow.Card,0,len(view.Items))
 for _,item:=range view.Items{
  if strings.TrimSpace(item.ID)==""||strings.TrimSpace(item.Source)==""||(item.Category!=model.CategoryBusiness&&item.Category!=model.CategoryFarm){fail(http.StatusBadGateway);return}
  if category!=""&&category!="ALL"&&category!=string(item.Category){continue}
  if query!=""&&!strings.Contains(strings.ToLower(item.Name+" "+item.City+" "+item.Region+" "+item.Country),strings.ToLower(query)){continue}
  filtered=append(filtered,item)
 }
 result:=page{Items:make([]grow.Card,0),Total:len(filtered),Empty:true}
 if offset<len(filtered){end:=offset+limit;if end>len(filtered){end=len(filtered)};result.Items=append(result.Items,filtered[offset:end]...);result.Empty=len(result.Items)==0;if end<len(filtered){result.NextOffset=&end}}
 _=json.NewEncoder(w).Encode(response{Version:"v1",Data:result})
}

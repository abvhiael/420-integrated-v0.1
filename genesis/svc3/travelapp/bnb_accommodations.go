package travelapp

// BnB accommodation discovery is a fresh, nonbinding projection. Travel never
// decides jurisdiction rules, invents coordinates, or creates reservations.
import (
 "encoding/json"
 "errors"
 "html/template"
 "io"
 "net/http"
 "net/url"
 "os"
 "regexp"
 "strings"
 "time"
)

type bnbStay struct {
 PropertyID string `json:"property_id"`
 Title string `json:"title"`
 PublicRegion string `json:"public_region"`
 Capacity int `json:"capacity"`
}
type bnbDiscovery struct {
 Version string `json:"version"`
 Nonbinding bool `json:"nonbinding"`
 TransactionEnabled bool `json:"transaction_enabled"`
 PlaceID string `json:"place_id"`
 Listings []bnbStay `json:"listings"`
}
var bnbPlaceID = regexp.MustCompile(`^[A-Za-z0-9_-]{1,128}$`)
var bnbPropertyID = regexp.MustCompile(`^[a-fA-F0-9-]{36}$`)
var bnbTemplate=template.Must(template.New("accommodations").Parse(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Public stays | 420Travel</title><style>body{font:16px system-ui;background:#101913;color:#fff;max-width:60rem;margin:auto;padding:2rem}a{color:#a2e8a4}article{padding:1rem;border:1px solid #456b4d;margin:1rem 0}a:focus-visible{outline:3px solid #a2e8a4}</style></head><body><main><h1>Public accommodations</h1><p>Only current independently eligible published stays appear. Region only: no precise property map markers. Prices, availability and legal terms must be rechecked with 420BnB. No booking occurs in 420Travel.</p>{{range .Listings}}<article><h2>{{.Title}}</h2><p>{{.PublicRegion}} · Capacity {{.Capacity}}</p><a href="/travel/accommodations/handoff?property_id={{.PropertyID}}">Review stay details in 420BnB</a></article>{{else}}<p>No currently eligible accommodations for this place.</p>{{end}}</main></body></html>`))

func withBnBAccommodations(next http.Handler)http.Handler{
 base:=strings.TrimSpace(os.Getenv("TRAVEL_BNB_PUBLIC_URL"))
 client:=&http.Client{Timeout:4*time.Second,CheckRedirect:func(_ *http.Request,_ []*http.Request)error{return errors.New("redirect not allowed")}}
 return http.HandlerFunc(func(w http.ResponseWriter,r *http.Request){
  if r.URL.Path=="/travel/accommodations/handoff" {
   w.Header().Set("Cache-Control","no-store")
   if r.Method!="GET" {w.Header().Set("Allow","GET");http.Error(w,"method not allowed",405);return}
   id:=r.URL.Query().Get("property_id")
   destination,err:=url.Parse(strings.TrimSpace(os.Getenv("TRAVEL_BNB_WEB_URL")))
   if !bnbPropertyID.MatchString(id)||err!=nil||destination.Scheme!="https"||destination.Host==""||destination.User!=nil||destination.RawQuery!=""||destination.Fragment!=""||destination.Path!=""&&destination.Path!="/" {
    http.Error(w,"handoff unavailable",503);return
   }
   destination.Path="/"
   destination.RawQuery=url.Values{"property_id":[]string{id}}.Encode()
   http.Redirect(w,r,destination.String(),http.StatusSeeOther)
   return
  }
  if r.URL.Path!="/travel/accommodations" {next.ServeHTTP(w,r);return}
  w.Header().Set("Cache-Control","no-store");w.Header().Set("X-Content-Type-Options","nosniff")
  w.Header().Set("Referrer-Policy","no-referrer")
  w.Header().Set("Content-Security-Policy","default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'")
  if r.Method!="GET" {w.Header().Set("Allow","GET");http.Error(w,"method not allowed",405);return}
  id:=r.URL.Query().Get("place_id")
  if !bnbPlaceID.MatchString(id){http.Error(w,"invalid place",400);return}
  endpoint,err:=url.Parse(base)
  if err!=nil||endpoint.Scheme!="https"||endpoint.Host==""||endpoint.User!=nil||endpoint.RawQuery!=""||endpoint.Fragment!=""||endpoint.Path!=""&&endpoint.Path!="/" {
   http.Error(w,"BnB discovery not configured",503);return
  }
  query:=endpoint.ResolveReference(&url.URL{Path:"/v1/bnb/travel/authorized",RawQuery:url.Values{"place_id":[]string{id}}.Encode()})
  request,err:=http.NewRequestWithContext(r.Context(),"GET",query.String(),nil)
  if err!=nil {http.Error(w,"discovery unavailable",503);return}
  response,err:=client.Do(request)
  if err!=nil {http.Error(w,"discovery unavailable",503);return}
  defer response.Body.Close()
  if response.StatusCode!=200 {http.Error(w,"discovery unavailable",503);return}
  var data bnbDiscovery
  if err=json.NewDecoder(io.LimitReader(response.Body,262144)).Decode(&data);err!=nil||data.Version!="bnb-travel-authorized/v1"||!data.Nonbinding||data.TransactionEnabled||data.PlaceID!=id||len(data.Listings)>50 {
   http.Error(w,"invalid discovery response",502);return
  }
  for _,item:=range data.Listings {
   if !bnbPropertyID.MatchString(item.PropertyID)||item.Title==""||len(item.Title)>160||len(item.PublicRegion)>100||item.Capacity<1||item.Capacity>1000 {
    http.Error(w,"invalid discovery listing",502);return
   }
  }
  w.Header().Set("Content-Type","text/html; charset=utf-8")
  _=bnbTemplate.Execute(w,data)
 })
}

package travelapp

import (
 "context"
 "errors"
 "fmt"
 "net"
 "net/http"
 "net/url"
 "strings"
 "time"

 "github.com/420integrated/420-integrated/genesis/svc2/sdk"
)

// PublicDeploymentConfig deliberately does not authorize private Travel routes.
// In strict mode a missing or non-TLS remote public feed prevents startup.
type PublicDeploymentConfig struct {
 PublicServiceURL string
 Strict bool
}

func (c PublicDeploymentConfig) Validate() error {
 raw:=strings.TrimSpace(c.PublicServiceURL)
 if raw=="" {if c.Strict{return errors.New("public Location/Events service is required")};return nil}
 u,err:=url.Parse(raw)
 if err!=nil||u.User!=nil||u.Host==""||u.RawQuery!=""||u.Fragment!=""||u.Path!=""&&u.Path!="/" {return errors.New("invalid public service URL")}
 if u.Scheme=="https" {return nil}
 hostname:=u.Hostname()
 ip:=net.ParseIP(hostname)
 if u.Scheme=="http"&&!c.Strict&&(strings.EqualFold(hostname,"localhost")||ip!=nil&&ip.IsLoopback()) {return nil}
 return errors.New("public service requires HTTPS (HTTP loopback is development-only)")
}

// NewPublicDeploymentHandler is opt-in and returns an error instead of silently
// enabling an unqualified upstream. It does not enable Identity or private data.
func NewPublicDeploymentHandler(c PublicDeploymentConfig)(http.Handler,error){
 if err:=c.Validate();err!=nil{return nil,err}
 raw:=strings.TrimSpace(c.PublicServiceURL)
 if raw=="" {return WithPublicReadiness(WithPublicJSON(HandlerWithNearbyMap(nil),nil),nil),nil}
 reader:=sdk.Client{BaseURL:raw,HTTP:&http.Client{Timeout:4*time.Second}}
 return WithPublicReadiness(WithPublicJSON(HandlerWithNearbyMap(reader),reader),reader),nil
}

// WithPublicReadiness probes the actual public projection on every readiness
// request, never a sample or cached snapshot. An outage returns 503. This is a
// PUBLIC-only readiness gate, not proof of private service or production readiness.
func WithPublicReadiness(next http.Handler, reader PublicReader)http.Handler {
 return http.HandlerFunc(func(w http.ResponseWriter,r *http.Request){
  if r.URL.Path!="/readyz" {next.ServeHTTP(w,r);return}
  if r.Method!=http.MethodGet {w.Header().Set("Allow","GET");http.Error(w,"method not allowed",http.StatusMethodNotAllowed);return}
  w.Header().Set("Cache-Control","no-store")
  w.Header().Set("Content-Type","text/plain; charset=utf-8")
  if reader==nil {http.Error(w,"public feed not configured",http.StatusServiceUnavailable);return}
  ctx,cancel:=context.WithTimeout(r.Context(),5*time.Second);defer cancel()
  now:=time.Now().UTC()
  _,err:=loadPublicDiscovery(ctx,reader,sdk.EventQuery{From:now,To:now.Add(24*time.Hour),Limit:1})
  if err!=nil {http.Error(w,"public feed unavailable",http.StatusServiceUnavailable);return}
  _,_=fmt.Fprintln(w,"public feed ready; private features disabled")
 })
}

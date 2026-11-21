package social

import (
 "bytes"
 "context"
 "errors"
 "io"
 "net/http"
 "strings"
 "testing"
 "time"
)

type readyTransport func(*http.Request)(*http.Response,error)
func (f readyTransport)RoundTrip(r *http.Request)(*http.Response,error){return f(r)}

func TestSSORedirectProbesReal420IDReadinessWithoutCredentials(t *testing.T){
 secret:=encodeToken(bytes.Repeat([]byte{0x77},32))
 var called int
 client:=&http.Client{Transport:readyTransport(func(r *http.Request)(*http.Response,error){
  called++
  if r.Method!=http.MethodGet||r.URL.String()!="https://auth.420integrated.org/healthz"{
   t.Fatalf("unexpected identity probe %s %s",r.Method,r.URL)
  }
  if r.Header.Get("Cookie")!=""||r.Header.Get("Authorization")!=""||
   r.Header.Get("Content-Type")!=""||r.Header.Get("Cache-Control")!="no-store"{
   t.Fatal("identity wake probe sent a credential or failed to bypass cache")
  }
  return &http.Response{StatusCode:200,Header:http.Header{"Content-Type":[]string{"application/json; charset=utf-8"}},Body:io.NopCloser(strings.NewReader(`{"ready":true}`))},nil
 })}
 broker,e:=NewHTTPBroker("https://auth.420integrated.org",
  "https://bonggoggles.420integrated.org/social-api/auth/callback","bong-goggles",secret,client)
 if e!=nil{t.Fatal(e)}
 ctx,cancel:=context.WithTimeout(context.Background(),5*time.Second);defer cancel()
 if e:=broker.Ready(ctx);e!=nil{t.Fatal(e)}
 if called!=1{t.Fatalf("unexpected readiness probes: %d",called)}
}

func TestSSORedirectReadinessFailsClosedOnSleepingIdentity(t *testing.T){
 secret:=encodeToken(bytes.Repeat([]byte{0x77},32))
 for _,tc:=range []struct{name string;status int;contentType,body string}{
  {"render sleeping",503,"text/html","<h1>Starting up</h1>"},
  {"gateway bad",502,"text/html","502"},
  {"unavailable",504,"text/html","504"},
  {"unauthorized redirect",302,"text/html",""},
  {"HTML masquerading as success",200,"text/html","OK"},
  {"wrong readiness",200,"application/json",`{"ready":false}`},
  {"unknown fields",200,"application/json",`{"ready":true,"issuer":"untrusted"}`},
  {"malformed JSON",200,"application/json",`{"ready":`},
  {"two JSON values",200,"application/json",`{"ready":true}{"ready":true}`},
 }{
  t.Run(tc.name,func(t *testing.T){
   client:=&http.Client{Transport:readyTransport(func(r *http.Request)(*http.Response,error){
    return &http.Response{StatusCode:tc.status,Header:http.Header{"Content-Type":[]string{tc.contentType}},
     Body:io.NopCloser(strings.NewReader(tc.body))},nil
   })}
   broker,e:=NewHTTPBroker("https://auth.420integrated.org",
    "https://bonggoggles.420integrated.org/social-api/auth/callback","bong-goggles",secret,client)
   if e!=nil{t.Fatal(e)}
   if e:=broker.Ready(context.Background());!errors.Is(e,ErrUnavailable){t.Fatalf("expected fail-closed readiness, got %v",e)}
  })
 }
}

func TestSSORedirectReadinessFailsClosedOnNetworkFailure(t *testing.T){
 client:=&http.Client{Transport:readyTransport(func(_ *http.Request)(*http.Response,error){
  return nil,errors.New("origin unreachable")
 })}
 broker,e:=NewHTTPBroker("https://auth.420integrated.org",
  "https://bonggoggles.420integrated.org/social-api/auth/callback","bong-goggles",
  encodeToken(bytes.Repeat([]byte{0x77},32)),client)
 if e!=nil{t.Fatal(e)}
 if e:=broker.Ready(context.Background());!errors.Is(e,ErrUnavailable){t.Fatal("network failure did not fail closed",e)}
}

package sdk

import (
 "context"
 "errors"
 "net/http"
 "net/http/httptest"
 "strings"
 "testing"
 "time"
)

func TestClientPlacesAndEvents(t *testing.T){
 server:=httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter,r *http.Request){
  w.Header().Set("Content-Type","application/json")
  switch r.URL.Path {
  case "/v1/places":_,_=w.Write([]byte(`{"version":"v1","data":{"items":[],"empty":true}}`))
  case "/v1/events":
   if r.URL.Query().Get("limit")!="2"||r.URL.Query().Get("placeId")!="venue & 1"{t.Errorf("query not encoded: %s",r.URL.RawQuery)}
   _,_=w.Write([]byte(`{"version":"v1","data":{"items":[],"empty":true}}`))
  default:http.NotFound(w,r)
  }
 }));defer server.Close()
 client:=Client{BaseURL:server.URL,HTTP:server.Client()}
 places,err:=client.Places(context.Background());if err!=nil||!places.Empty{t.Fatalf("places: %+v %v",places,err)}
 from:=time.Date(2026,9,20,0,0,0,0,time.UTC)
 events,err:=client.Events(context.Background(),EventQuery{From:from,To:from.Add(time.Hour),Limit:2,PlaceID:"venue & 1"})
 if err!=nil||!events.Empty{t.Fatalf("events: %+v %v",events,err)}
 if _,err:=client.Events(context.Background(),EventQuery{From:from,To:from.Add(time.Hour),Limit:101});err==nil{t.Fatal("invalid pagination accepted")}
}

func TestClientPropagatesErrorsAndRejectsMalformedEndpoints(t *testing.T){
 server:=httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter,r *http.Request){w.Header().Set("Content-Type","application/json");w.WriteHeader(http.StatusServiceUnavailable);_,_=w.Write([]byte(`{"error":"source unavailable"}`))}));defer server.Close()
 client:=Client{BaseURL:server.URL,HTTP:server.Client()}
 _,err:=client.Places(context.Background());var failure *APIError
 if !errors.As(err,&failure)||failure.Status!=503||!strings.Contains(failure.Message,"unavailable"){t.Fatalf("unexpected error: %v",err)}
 _,err= (Client{BaseURL:"javascript://invalid"}).Places(context.Background());if err==nil{t.Fatal("unsafe scheme accepted")}
}

package travelapp

import (
 "context"
 "net/http"
 "net/http/httptest"
 "net/url"
 "strings"
 "testing"
)

func TestQualifiedShareLinkPageOwnerOnlySingleDisplayAndRevocation(t *testing.T) {
 ctx:=context.Background()
 trips:=NewTripStore()
 if _,err:=trips.Create(ctx,"alice",Trip{ID:"trip-a",Title:"Alice itinerary",Visibility:TripUnlisted});err!=nil{t.Fatal(err)}
 grants:=&testTripGrants{}
 shares:=TripSharing{Trips:trips,Grants:grants,Published:&testPublishedTrip{}}
 csrf:=strings.Repeat("c",40)
 alice:=HandlerWithQualifiedJourneys(nil,nil,TravelUserDependencies{Identity:testIdentity{subject:"alice",token:csrf},Trips:trips},shares)
 bob:=HandlerWithQualifiedJourneys(nil,nil,TravelUserDependencies{Identity:testIdentity{subject:"bob",token:csrf},Trips:trips},shares)
 path:="/travel/trips/trip-a/share"
 post:=func(h http.Handler,token string)*httptest.ResponseRecorder{
  r:=httptest.NewRequest(http.MethodPost,path,strings.NewReader(url.Values{"csrf_token":{token}}.Encode()))
  r.Header.Set("Content-Type","application/x-www-form-urlencoded")
  w:=httptest.NewRecorder();h.ServeHTTP(w,r);return w
 }
 if w:=post(bob,csrf);w.Code!=http.StatusNotFound||strings.Contains(w.Body.String(),"/travel/shared/"){t.Fatalf("other owner: %d %s",w.Code,w.Body.String())}
 if w:=post(alice,"forged");w.Code!=http.StatusForbidden{t.Fatalf("forged CSRF: %d",w.Code)}
 w:=post(alice,csrf)
 if w.Code!=http.StatusOK||!strings.Contains(w.Body.String(),"New sharing link")||!strings.Contains(w.Body.String(),"/travel/shared/")||!strings.Contains(w.Body.String(),"Expires")||!strings.Contains(w.Body.String(),"Revoke all sharing links"){t.Fatalf("owner issuance: %d %s",w.Code,w.Body.String())}
 if w.Header().Get("Cache-Control")!="no-store"||w.Header().Get("Referrer-Policy")!="no-referrer"||!strings.Contains(w.Header().Get("Content-Security-Policy"),"default-src 'none'"){t.Fatal("missing secret-page headers")}
 if len(grants.grants)!=1{t.Fatalf("unexpected grant count %d",len(grants.grants))}
 get:=httptest.NewRecorder();alice.ServeHTTP(get,httptest.NewRequest(http.MethodGet,path,nil))
 if get.Code!=http.StatusMethodNotAllowed||strings.Contains(get.Body.String(),"/travel/shared/"){t.Fatalf("GET redisplayed link: %d %s",get.Code,get.Body.String())}
 revoke:=httptest.NewRequest(http.MethodPost,"/travel/trips/trip-a/revoke-shares",strings.NewReader(url.Values{"csrf_token":{csrf}}.Encode()))
 revoke.Header.Set("Content-Type","application/x-www-form-urlencoded")
 revoked:=httptest.NewRecorder();alice.ServeHTTP(revoked,revoke)
 if revoked.Code!=http.StatusSeeOther||len(grants.grants)!=0{t.Fatalf("revoke: %d %d",revoked.Code,len(grants.grants))}
}

func TestQualifiedShareLinkPageDisabledWithoutPublisher(t *testing.T){
 trips:=NewTripStore()
 if _,err:=trips.Create(context.Background(),"alice",Trip{ID:"trip-a",Title:"test",Visibility:TripUnlisted});err!=nil{t.Fatal(err)}
 csrf:=strings.Repeat("c",40)
 h:=HandlerWithQualifiedJourneys(nil,nil,TravelUserDependencies{Identity:testIdentity{subject:"alice",token:csrf},Trips:trips},TripSharing{Trips:trips,Grants:&testTripGrants{}})
 r:=httptest.NewRequest(http.MethodPost,"/travel/trips/trip-a/share",strings.NewReader(url.Values{"csrf_token":{csrf}}.Encode()))
 r.Header.Set("Content-Type","application/x-www-form-urlencoded")
 w:=httptest.NewRecorder();h.ServeHTTP(w,r)
 if w.Code!=http.StatusServiceUnavailable||strings.Contains(w.Body.String(),"/travel/shared/"){t.Fatalf("unverified sharing: %d %s",w.Code,w.Body.String())}
}

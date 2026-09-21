package travelapp

import (
 "context"
 "errors"
 "net/http"
 "net/http/httptest"
 "net/url"
 "strings"
 "testing"
)

func TestTripShareIssueRequiresFreshPublication(t *testing.T) {
 ctx:=context.Background()
 trips:=NewTripStore()
 if _,err:=trips.Create(ctx,"alice",Trip{ID:"unlisted-review",Title:"Test",Visibility:TripUnlisted,PlaceIDs:[]string{"public-place"}});err!=nil{t.Fatal(err)}
 grants:=&testTripGrants{}
 sharing:=TripSharing{Trips:trips,Grants:grants}
 if _,err:=sharing.Issue(ctx,"alice","unlisted-review");!errors.Is(err,ErrTripShareUnavailable){t.Fatalf("missing verifier allowed issuance: %v",err)}
 verifier:=&testPublishedTrip{err:errors.New("withdrawn")}
 sharing.Published=verifier
 if _,err:=sharing.Issue(ctx,"alice","unlisted-review");!errors.Is(err,ErrTripShareUnavailable){t.Fatalf("withdrawn place allowed issuance: %v",err)}
 if len(grants.grants)!=0{t.Fatal("share grant was created despite failure")}
 verifier.err=nil
 if _,err:=sharing.Issue(ctx,"alice","unlisted-review");err!=nil{t.Fatalf("verified share should issue: %v",err)}
 if verifier.calls!=2{t.Fatalf("expected per-issue publication checks, got %d",verifier.calls)}
}

func TestTripShareHTTPWithoutPublicationVerifierReturnsUnavailable(t *testing.T){
 ctx:=context.Background()
 trips:=NewTripStore()
 if _,err:=trips.Create(ctx,"alice",Trip{ID:"unlisted-http",Title:"Test",Visibility:TripUnlisted});err!=nil{t.Fatal(err)}
 token:=strings.Repeat("c",40)
 h:=HandlerWithTripSharing(nil,TravelUserDependencies{Identity:testIdentity{subject:"alice",token:token},Trips:trips},TripSharing{Trips:trips,Grants:&testTripGrants{}})
 body:=url.Values{"csrf_token":{token}}.Encode()
 request:=httptest.NewRequest(http.MethodPost,"/travel/trips/unlisted-http/share",strings.NewReader(body))
 request.Header.Set("Content-Type","application/x-www-form-urlencoded")
 result:=httptest.NewRecorder();h.ServeHTTP(result,request)
 if result.Code!=http.StatusServiceUnavailable{t.Fatalf("issued share without verifier: %d %s",result.Code,result.Body.String())}
 if strings.Contains(result.Body.String(),"/travel/shared/"){t.Fatal("share token exposed")}
}

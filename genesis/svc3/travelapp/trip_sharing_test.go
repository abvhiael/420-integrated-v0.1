package travelapp

import (
 "context"
 "crypto/sha256"
 "encoding/hex"
 "errors"
 "net/http"
 "net/http/httptest"
 "net/url"
 "strings"
 "sync"
 "testing"
 "time"
)

type testTripGrants struct {mu sync.Mutex; grants map[string]struct{owner,id string;expires time.Time}}
func (s *testTripGrants) Issue(_ context.Context,owner,id,hash string,expiry time.Time)error{s.mu.Lock();defer s.mu.Unlock();if s.grants==nil{s.grants=make(map[string]struct{owner,id string;expires time.Time})};s.grants[hash]=struct{owner,id string;expires time.Time}{owner,id,expiry};return nil}
func (s *testTripGrants) Revoke(_ context.Context,owner,id string)error{s.mu.Lock();defer s.mu.Unlock();for hash,g:=range s.grants{if g.owner==owner&&g.id==id{delete(s.grants,hash)}};return nil}
func (s *testTripGrants) Resolve(_ context.Context,hash string)(string,string,error){s.mu.Lock();defer s.mu.Unlock();g,ok:=s.grants[hash];if !ok||!g.expires.After(time.Now()){return "","",ErrTripNotFound};return g.owner,g.id,nil}
type testPublishedTrip struct{err error;calls int}
func (s *testPublishedTrip) VerifyPublishedTrip(_ context.Context,_ Trip)error{s.calls++;return s.err}
func TestUnlistedShareRevocationAndPublicationGate(t *testing.T){
 ctx:=context.Background();repo:=NewTripStore();trip,err:=repo.Create(ctx,"alice",Trip{ID:"sharing-one",Title:"private itinerary",Visibility:TripUnlisted});if err!=nil{t.Fatal(err)}
 grants:=&testTripGrants{};public:=&testPublishedTrip{};sharing:=TripSharing{Trips:repo,Grants:grants,Published:public}
 token,err:=sharing.Issue(ctx,"alice",trip.ID);if err!=nil||len(token)!=64{t.Fatalf("share token: %v",err)}
 hash:=sha256.Sum256([]byte(token));if _,ok:=grants.grants[hex.EncodeToString(hash[:])];!ok{t.Fatal("grant not hashed")};if _,ok:=grants.grants[token];ok{t.Fatal("raw token persisted")}
 if _,err:=sharing.Issue(ctx,"bob",trip.ID);!errors.Is(err,ErrTripNotFound){t.Fatalf("foreign owner issued share: %v",err)}
 if got,err:=sharing.Resolve(ctx,token);err!=nil||got.OwnerID!=""||got.Title!=trip.Title{t.Fatalf("authorized shared read: %+v %v",got,err)}
 public.err=errors.New("place withdrawn");if _,err:=sharing.Resolve(ctx,token);!errors.Is(err,ErrTripNotFound){t.Fatalf("unpublished references disclosed: %v",err)}
 public.err=nil;sharing.Published=nil;if _,err:=sharing.Resolve(ctx,token);!errors.Is(err,ErrTripNotFound){t.Fatalf("nil verifier allowed sharing: %v",err)};sharing.Published=public
 trip.Visibility=TripPrivate;if _,err:=repo.Replace(ctx,"alice",trip);err!=nil{t.Fatal(err)}
 if _,err:=sharing.Resolve(ctx,token);!errors.Is(err,ErrTripNotFound){t.Fatalf("private trip readable by old token: %v",err)}
 if _,err:=sharing.Issue(ctx,"alice",trip.ID);!errors.Is(err,ErrTripShareUnavailable){t.Fatalf("private trip share created: %v",err)}
 trip.Visibility=TripUnlisted;if _,err:=repo.Replace(ctx,"alice",trip);err!=nil{t.Fatal(err)}
 if err:=sharing.Revoke(ctx,"bob",trip.ID);!errors.Is(err,ErrTripNotFound){t.Fatalf("cross-owner revoked share: %v",err)}
 if err:=sharing.Revoke(ctx,"alice",trip.ID);err!=nil{t.Fatal(err)}
 if _,err:=sharing.Resolve(ctx,token);!errors.Is(err,ErrTripNotFound){t.Fatalf("revoked token works: %v",err)}
 if public.calls<2{t.Fatalf("expected fresh publication checks: %d",public.calls)}
}
func TestShareHTTPRequiresIdentityAndCSRF(t *testing.T){
 ctx:=context.Background();repo:=NewTripStore();_,err:=repo.Create(ctx,"alice",Trip{ID:"sharing-two",Title:"test",Visibility:TripUnlisted});if err!=nil{t.Fatal(err)}
 csrf:=strings.Repeat("c",40);shares:=TripSharing{Trips:repo,Grants:&testTripGrants{},Published:&testPublishedTrip{}}
 handler:=HandlerWithTripSharing(nil,TravelUserDependencies{Identity:testIdentity{subject:"alice",token:csrf},Trips:repo},shares)
 post:=func(path,token string)*httptest.ResponseRecorder{r:=httptest.NewRequest(http.MethodPost,path,strings.NewReader(url.Values{"csrf_token":{token}}.Encode()));r.Header.Set("Content-Type","application/x-www-form-urlencoded");w:=httptest.NewRecorder();handler.ServeHTTP(w,r);return w}
 if w:=post("/travel/trips/sharing-two/share","forged");w.Code!=http.StatusForbidden{t.Fatalf("forged csrf: %d",w.Code)}
 w:=post("/travel/trips/sharing-two/share",csrf);if w.Code!=http.StatusOK{t.Fatalf("issue: %d %s",w.Code,w.Body.String())}
 link:=strings.TrimSpace(w.Body.String());if !strings.HasPrefix(link,"/travel/shared/"){t.Fatal("missing share URL")}
 get:=func()*httptest.ResponseRecorder{r:=httptest.NewRequest(http.MethodGet,link,nil);v:=httptest.NewRecorder();handler.ServeHTTP(v,r);return v}
 if w:=get();w.Code!=http.StatusOK||!strings.Contains(w.Body.String(),"test"){t.Fatalf("shared read: %d %s",w.Code,w.Body.String())}
 if w:=post("/travel/trips/sharing-two/revoke-shares",csrf);w.Code!=http.StatusSeeOther{t.Fatalf("revoke: %d",w.Code)}
 if w:=get();w.Code!=http.StatusNotFound{t.Fatalf("revoked link: %d",w.Code)}
}

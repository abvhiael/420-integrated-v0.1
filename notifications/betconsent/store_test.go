package betconsent

import(
 "bytes"
 "encoding/json"
 "net/http"
 "net/http/httptest"
 "path/filepath"
 "testing"
)
func fixture() Subscription {return Subscription{Tenant:"420bet",UserID:"subject-1",SubscriptionID:"sub-1",Recipient:"route-1",Channel:"notifications",PolicyVersion:"policy-1",Active:true,Consent:true}}
func query() Check {return Check{Tenant:"420bet",UserID:"subject-1",SubscriptionID:"sub-1",Recipient:"route-1",Channel:"notifications",PolicyVersion:"policy-1",Kind:"wager-settled"}}
func TestPersistentConsentRevocationAndVersionTombstone(t *testing.T){
 path:=filepath.Join(t.TempDir(),"consent.json")
 s,err:=Open(path);if err!=nil{t.Fatal(err)}
 if s.Check(query()).Consent {t.Fatal("unknown subscription must deny")}
 v,err:=s.Apply(fixture(),0);if err!=nil{t.Fatal(err)}
 if v.Revision!=1||!s.Check(query()).Consent{t.Fatal("missing initial opt-in")}
 if err=s.Close();err!=nil{t.Fatal(err)}
 s2,err:=Open(path);if err!=nil{t.Fatal(err)}
 if !s2.Check(query()).Consent {t.Fatal("restart lost consent")}
 v,err=s2.Revoke(query(),1);if err!=nil{t.Fatal(err)}
 if !v.Revoked||v.Consent||v.Active{t.Fatal("revocation not durable")}
 if err=s2.Close();err!=nil{t.Fatal(err)}
 s3,err:=Open(path);if err!=nil{t.Fatal(err)}
 if allowed:=s3.Check(query());allowed.Consent||!allowed.Revoked{t.Fatal("revocation bypassed after restart")}
 if _,err=s3.Apply(fixture(),2);err==nil{t.Fatal("revoked subscription reactivated")}
 defer s3.Close()
 if _,err=s3.Revoke(query(),1);err==nil{t.Fatal("stale revision accepted")}
}
func TestConsentFailClosedForCrossScopeAndMute(t *testing.T){
 s,err:=Open(filepath.Join(t.TempDir(),"c.json"));if err!=nil{t.Fatal(err)}
 v,err:=s.Apply(fixture(),0);if err!=nil{t.Fatal(err)}
 cross:=query();cross.UserID="another-subject"
 if x:=s.Check(cross);x.Consent||!x.Revoked{t.Fatal("cross-subject consent leaked")}
 cross=query();cross.Recipient="different-route"
 if x:=s.Check(cross);x.Consent||!x.Revoked{t.Fatal("cross-recipient consent leaked")}
 cross=query();cross.PolicyVersion="policy-2"
 if x:=s.Check(cross);x.Consent||!x.Revoked{t.Fatal("old policy consent reused")}
 updated:=v;updated.Muted=true
 if _,err=s.Apply(updated,1);err!=nil{t.Fatal(err)}
 if x:=s.Check(query());!x.Muted{t.Fatal("mute missing")}
}
func TestPrivateHTTPAuthenticationAndDurableRevocation(t *testing.T){
 s,err:=Open(filepath.Join(t.TempDir(),"c.json"));if err!=nil{t.Fatal(err)}
 token:="test-service-credential-with-more-than-32-characters"
 writeToken:="independent-mutation-credential-with-more-than-32-chars"
 h,err:=Handler(s,token,writeToken);if err!=nil{t.Fatal(err)}
 invoke:=func(path string,body any,authorization string)*httptest.ResponseRecorder{
  b,_:=json.Marshal(body)
  req:=httptest.NewRequest(http.MethodPost,path,bytes.NewReader(b))
  req.Header.Set("Authorization",authorization)
  w:=httptest.NewRecorder();h.ServeHTTP(w,req);return w
 }
 if w:=invoke("/v1/420bet/subscriptions/apply",map[string]any{"subscription":fixture(),"expectedRevision":0},"");w.Code!=403{t.Fatalf("unauthorized write %d",w.Code)}
 if w:=invoke("/v1/420bet/subscriptions/apply",map[string]any{"subscription":fixture(),"expectedRevision":0},"Bearer "+writeToken);w.Code!=200{t.Fatalf("apply %d %s",w.Code,w.Body)}
 if w:=invoke("/v1/420bet/subscriptions/apply",map[string]any{"subscription":fixture(),"expectedRevision":1},"Bearer "+token);w.Code!=403{t.Fatalf("read token can mutate %d",w.Code)}
 if w:=invoke("/v1/420bet/subscriptions/check",query(),"Bearer "+token);w.Code!=200||!bytes.Contains(w.Body.Bytes(),[]byte(`"consent":true`)){t.Fatalf("check %d %s",w.Code,w.Body)}
 if w:=invoke("/v1/420bet/subscriptions/revoke",map[string]any{"check":query(),"expectedRevision":1},"Bearer "+writeToken);w.Code!=200{t.Fatalf("revoke %d %s",w.Code,w.Body)}
 if w:=invoke("/v1/420bet/subscriptions/check",query(),"Bearer "+token);w.Code!=200||!bytes.Contains(w.Body.Bytes(),[]byte(`"revoked":true`)){t.Fatalf("revoked check %d %s",w.Code,w.Body)}
}

func TestRevocationEventsPersistAndRetainOrder(t *testing.T){
 path:=filepath.Join(t.TempDir(),"revocations.json")
 s,err:=Open(path);if err!=nil{t.Fatal(err)}
 v,err:=s.Apply(fixture(),0);if err!=nil{t.Fatal(err)}
 v.Muted=true
 if _,err=s.Apply(v,1);err!=nil{t.Fatal(err)}
 events,err:=s.Revocations(0,10);if err!=nil{t.Fatal(err)}
 if len(events)!=1||events[0].Sequence!=1||events[0].Reason!="consent_withdrawn"{t.Fatalf("bad mute feed: %#v",events)}
 v.Muted=false
 if _,err=s.Apply(v,2);err!=nil{t.Fatal(err)}
 if _,err=s.Revoke(query(),3);err!=nil{t.Fatal(err)}
 events,err=s.Revocations(1,10);if err!=nil{t.Fatal(err)}
 if len(events)!=1||events[0].Sequence!=2||events[0].Reason!="revoked"{t.Fatalf("bad revoke feed: %#v",events)}
 if _,err=s.Revocations(100,10);err==nil{t.Fatal("future cursor accepted")}
 if err=s.Close();err!=nil{t.Fatal(err)}
 restarted,err:=Open(path);if err!=nil{t.Fatal(err)};defer restarted.Close()
 events,err=restarted.Revocations(0,10);if err!=nil{t.Fatal(err)}
 if len(events)!=2||events[1].Sequence!=2{t.Fatalf("restarted feed wrong: %#v",events)}
}
func TestRevocationFeedSeparateReadCredential(t *testing.T){
 s,err:=Open(filepath.Join(t.TempDir(),"consent.json"));if err!=nil{t.Fatal(err)};defer s.Close()
 read:="reader-credential-which-is-longer-than-32-bytes"
 writeToken:="writer-credential-which-is-longer-than-32-bytes"
 h,err:=Handler(s,read,writeToken);if err!=nil{t.Fatal(err)}
 b:=[]byte(`{"after":0,"limit":10}`)
 ask:=func(token string)int{
  req:=httptest.NewRequest(http.MethodPost,"/v1/420bet/subscriptions/revocations",bytes.NewReader(b))
  req.Header.Set("Authorization","Bearer "+token)
  w:=httptest.NewRecorder();h.ServeHTTP(w,req);return w.Code
 }
 if ask(writeToken)!=403{t.Fatal("writer token can read revocation feed")}
 if ask(read)!=200{t.Fatal("reader cannot access revocation feed")}
}

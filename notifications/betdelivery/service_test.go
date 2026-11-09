package betdelivery

import(
 "bytes"
 "encoding/json"
 "net/http"
 "net/http/httptest"
 "path/filepath"
 "testing"

 "github.com/420integrated/420-integrated/notifications/betconsent"
)
func sample()Delivery{return Delivery{
 Tenant:"420bet",UserID:"subject-1",SubscriptionID:"sub-1",Recipient:"route-1",
 PolicyVersion:"p1",IdempotencyKey:"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
 Event:Event{Schema:"420bet-notification-v1",Kind:"wager-settled",Game:"casino-dice",
  ChainID:"420",BlockNumber:"24",EventID:"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  Finality:"finalized"},
}}
func TestRealGoPendingDeliveryPersistenceAndRevocation(t *testing.T){
 dir:=t.TempDir()
 subs,e:=betconsent.Open(filepath.Join(dir,"consent.json"));if e!=nil{t.Fatal(e)}
 defer subs.Close()
 _,e=subs.Apply(betconsent.Subscription{Tenant:"420bet",UserID:"subject-1",
  SubscriptionID:"sub-1",Recipient:"route-1",Channel:"notifications",
  PolicyVersion:"p1",Consent:true,Active:true},0)
 if e!=nil{t.Fatal(e)}
 path:=filepath.Join(dir,"deliveries.json")
 ledger,e:=Open(path);if e!=nil{t.Fatal(e)}
 d:=sample()
 first,e:=ledger.Send(d,subs);if e!=nil{t.Fatal(e)}
 if first.Status!="pending"{t.Fatal("Go service fabricated downstream delivery")}
 second,e:=ledger.Send(d,subs);if e!=nil||second!=first{t.Fatal("idempotent send changed receipt",e)}
 altered:=d;altered.Recipient="stolen-route"
 if _,e=ledger.Send(altered,subs);e==nil{t.Fatal("cross-recipient idempotency accepted")}
 q:=lookup{Tenant:"420bet",UserID:"subject-1",DeliveryID:first.DeliveryID,IdempotencyKey:d.IdempotencyKey}
 wrong:=q;wrong.UserID="attacker"
 if _,e=ledger.Receipt(wrong,false);e==nil{t.Fatal("cross-user lookup accepted")}
 if e=ledger.Close();e!=nil{t.Fatal(e)}
 ledger,e=Open(path);if e!=nil{t.Fatal(e)};defer ledger.Close()
 after,e:=ledger.Receipt(q,false);if e!=nil||after!=first{t.Fatal("restart lost receipt",e)}
 cancelled,e:=ledger.Receipt(q,true);if e!=nil||cancelled.Status!="cancelled"{t.Fatal("cancel failed",e)}
 _,e=subs.Revoke(betconsent.Check{Tenant:"420bet",UserID:"subject-1",SubscriptionID:"sub-1",
  Recipient:"route-1",Channel:"notifications",PolicyVersion:"p1",Kind:"wager-settled"},1)
 if e!=nil{t.Fatal(e)}
 other:=sample();other.IdempotencyKey="cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc"
 if _,e=ledger.Send(other,subs);e==nil{t.Fatal("revoked subscription delivered")}
}
func TestGoDeliveryHTTPAuthenticationAndAdversarialScopes(t *testing.T){
 dir:=t.TempDir();subs,e:=betconsent.Open(filepath.Join(dir,"subs.json"));if e!=nil{t.Fatal(e)};defer subs.Close()
 _,e=subs.Apply(betconsent.Subscription{Tenant:"420bet",UserID:"subject-1",SubscriptionID:"sub-1",
  Recipient:"route-1",Channel:"notifications",PolicyVersion:"p1",Consent:true,Active:true},0)
 if e!=nil{t.Fatal(e)}
 ledger,e:=Open(filepath.Join(dir,"delivery.json"));if e!=nil{t.Fatal(e)};defer ledger.Close()
 token:="qualified-service-only-token-123456789"
 h,e:=Handler(ledger,subs,token);if e!=nil{t.Fatal(e)}
 send:=func(path,credential string,input any)*httptest.ResponseRecorder{
  b,_:=json.Marshal(input)
  r:=httptest.NewRequest(http.MethodPost,path,bytes.NewReader(b))
  r.Header.Set("Authorization",credential)
  w:=httptest.NewRecorder();h.ServeHTTP(w,r);return w
 }
 if w:=send("/v1/420bet/deliveries/send","Bearer wrong",sample());w.Code!=403{t.Fatal("forged credential accepted")}
 if w:=send("/v1/420bet/deliveries/send","Bearer "+token,sample());w.Code!=200{t.Fatal(w.Code,w.Body.String())}
 if w:=send("/v1/420bet/deliveries/send","Bearer "+token,map[string]any{"untrusted":true});w.Code!=400{t.Fatal("unknown fields accepted")}
 forged:=sample();forged.Tenant="another"
 if w:=send("/v1/420bet/deliveries/send","Bearer "+token,forged);w.Code==200{t.Fatal("cross-tenant send accepted")}
}

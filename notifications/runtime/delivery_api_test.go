package runtime

import (
 "bytes"
 "context"
 "crypto/sha256"
 "encoding/hex"
 "encoding/json"
 "net/http/httptest"
 "os"
 "path/filepath"
 "strings"
 "testing"
)
func testDelivery() DeliverySubmit {
 h:=sha256.Sum256([]byte("opaque finalized receipt"))
 eventID:=hex.EncodeToString(h[:])
 k:=sha256.Sum256([]byte("420bet|owner|sub|event"))
 return DeliverySubmit{
  Tenant:"420bet",UserID:"subject-1",SubscriptionID:"subscription-1",
  Recipient:"opaque-recipient",IdempotencyKey:hex.EncodeToString(k[:]),
  PolicyVersion:"policy-2",
  Event:DeliveryEvent{Schema:"420bet-notification-v1",Kind:"wager-settled",
   Game:"casino-dice",ChainID:"420",BlockNumber:"23",
   EventID:eventID,Finality:"finalized"},
 }
}
func testNativeAPI(t *testing.T)(*Service,*DeliveryStore,*bool){
 t.Helper()
 path:=filepath.Join(t.TempDir(),"outbox.json")
 store,err:=OpenDeliveryStore(path);if err!=nil{t.Fatal(err)}
 t.Cleanup(func(){_ =store.Close()})
 secret:=strings.Repeat("n",64)
 auth,err:=BearerServiceAuthenticator(secret,DeliveryPrincipal{ServiceID:"bet-worker",Tenant:"420bet"})
 if err!=nil{t.Fatal(err)}
 consent:=true
 api,err:=NewDeliveryAPI(store,auth,func(_ context.Context,p DeliveryPrincipal,r DeliverySubmit)(DeliveryDecision,error){
  return DeliveryDecision{Owner:p.Tenant==r.Tenant&&r.UserID=="subject-1"&&
   r.SubscriptionID=="subscription-1"&&r.Recipient=="opaque-recipient",
   Consent:consent},nil
 },func(_ context.Context,r DeliverySubmit)(bool,error){
  return r.Event.BlockNumber=="23",nil
 })
 if err!=nil{t.Fatal(err)}
 service,err:=NewService(validConfig(),fakeProbe{chainID:420})
 if err!=nil{t.Fatal(err)}
 if err=service.ConfigureDeliveryAPI(api);err!=nil{t.Fatal(err)}
 return service,store,&consent
}
func callNative(s *Service,method,path,secret string,body any)*httptest.ResponseRecorder {
 var data []byte
 if body!=nil{data,_=json.Marshal(body)}
 r:=httptest.NewRequest(method,path,bytes.NewReader(data))
 if body!=nil{r.Header.Set("Content-Type","application/json")}
 if secret!=""{r.Header.Set("Authorization","Bearer "+secret)}
 w:=httptest.NewRecorder();s.Handler().ServeHTTP(w,r)
 return w
}
func readNativeReceipt(t *testing.T,w *httptest.ResponseRecorder)DeliveryReceipt{
 t.Helper();var rec DeliveryReceipt
 if e:=json.Unmarshal(w.Body.Bytes(),&rec);e!=nil{t.Fatal(e)}
 return rec
}
func TestNativeDeliveryRequiresExplicitAuthConsentAndReadiness(t *testing.T){
 s,_,_:=testNativeAPI(t);token:=strings.Repeat("n",64)
 w:=callNative(s,"POST","/v1/deliveries",token,testDelivery())
 if w.Code!=503{t.Fatalf("unqualified %d",w.Code)}
 if e:=s.Qualify(context.Background());e!=nil{t.Fatal(e)}
 w=callNative(s,"POST","/v1/deliveries","bad",testDelivery())
 if w.Code!=401{t.Fatalf("bad secret %d",w.Code)}
 w=callNative(s,"POST","/v1/deliveries",token,testDelivery())
 if w.Code!=201{t.Fatalf("qualified %d: %s",w.Code,w.Body.String())}
 rec:=readNativeReceipt(t,w)
 if rec.Status!="pending"||rec.IdempotencyKey!=testDelivery().IdempotencyKey{
  t.Fatalf("invalid receipt %#v",rec)
 }
 if strings.Contains(w.Body.String(),"subject-1")||strings.Contains(w.Body.String(),"recipient"){
  t.Fatal("private identity leaked")
 }
}
func TestNativeDeliveryIdempotencyConflictAndDurableRestart(t *testing.T){
 s,store,_:=testNativeAPI(t);token:=strings.Repeat("n",64)
 if err:=s.Qualify(context.Background());err!=nil{t.Fatal(err)}
 first:=callNative(s,"POST","/v1/deliveries",token,testDelivery())
 if first.Code!=201{t.Fatal(first.Body.String())}
 r:=readNativeReceipt(t,first)
 again:=callNative(s,"POST","/v1/deliveries",token,testDelivery())
 if again.Code!=200||readNativeReceipt(t,again).ID!=r.ID{t.Fatal("duplicate not suppressed")}
 changed:=testDelivery();changed.PolicyVersion="policy-3"
 conflict:=callNative(s,"POST","/v1/deliveries",token,changed)
 if conflict.Code!=409{t.Fatalf("conflicting key status %d",conflict.Code)}
 path:=store.file
 if err:=store.Close();err!=nil{t.Fatal(err)}
 reopened,err:=OpenDeliveryStore(path);if err!=nil{t.Fatal(err)}
 defer reopened.Close()
 got,ok:=reopened.Find(r.ID)
 if !ok||got.Receipt.IdempotencyKey!=r.IdempotencyKey{t.Fatal("receipt not durable")}
 st,e:=os.Stat(path);if e!=nil||st.Mode().Perm()!=0600{t.Fatal("unsafe file permissions")}
}
func TestNativeDeliveryScopedReadCancelAndNoForgedDelivery(t *testing.T){
 s,store,consent:=testNativeAPI(t);token:=strings.Repeat("n",64)
 if err:=s.Qualify(context.Background());err!=nil{t.Fatal(err)}
 w:=callNative(s,"POST","/v1/deliveries",token,testDelivery())
 r:=readNativeReceipt(t,w)
 if got:=callNative(s,"GET","/v1/deliveries/"+r.ID,token,nil);got.Code!=200{
  t.Fatalf("get %d",got.Code)
 }
 *consent=false // explicit opt-out still permits owner lookup/cancellation
 if got:=callNative(s,"POST","/v1/deliveries",token,testDelivery());got.Code!=403{
  t.Fatalf("revoked consent post %d",got.Code)
 }
 cancelled:=callNative(s,"POST","/v1/deliveries/"+r.ID+"/cancel",token,nil)
 if cancelled.Code!=200||readNativeReceipt(t,cancelled).Status!="cancelled"{
  t.Fatalf("cancel %d %s",cancelled.Code,cancelled.Body.String())
 }
 if _,e:=store.MarkDelivered(r.ID);e==nil{t.Fatal("cancelled receipt delivered")}
 if got:=callNative(s,"GET","/v1/deliveries/"+r.ID,token,nil);got.Code!=200{
  t.Fatalf("revoked owner receipt %d",got.Code)
 }
 unknown:=callNative(s,"GET","/v1/deliveries/nonexistent",token,nil)
 if unknown.Code!=404{t.Fatal("existence leak")}
}
func TestNativeDeliveryRejectsCrossTenantCrossOwnerAndMalformedPayload(t *testing.T){
 s,_,_:=testNativeAPI(t);token:=strings.Repeat("n",64)
 if err:=s.Qualify(context.Background());err!=nil{t.Fatal(err)}
 for _,req:=range []DeliverySubmit{
  func()DeliverySubmit{x:=testDelivery();x.Tenant="other";return x}(),
  func()DeliverySubmit{x:=testDelivery();x.UserID="stranger";return x}(),
  func()DeliverySubmit{x:=testDelivery();x.Event.Finality="pending";return x}(),
  func()DeliverySubmit{x:=testDelivery();x.Recipient="person@example.com";return x}(),
 }{
  w:=callNative(s,"POST","/v1/deliveries",token,req)
  if w.Code!=403{t.Fatalf("expected denial: %d %s",w.Code,w.Body.String())}
 }
 forged:=testDelivery();forged.Event.BlockNumber="99"
 if got:=callNative(s,"POST","/v1/deliveries",token,forged);got.Code!=403{
  t.Fatalf("unverified finalized event accepted: %d",got.Code)
 }
 w:=callNative(s,"POST","/v1/deliveries?unexpected=true",token,testDelivery())
 if w.Code!=400{t.Fatalf("query accepted: %d",w.Code)}
 w=callNative(s,"GET","/healthz","",nil)
 if w.Code!=200{t.Fatal("original health endpoint changed")}
}
func TestNativeDeliveryRequiresRealQualifiedDependencies(t *testing.T){
 if _,e:=NewDeliveryAPI(nil,nil,nil,nil);e==nil{t.Fatal("nil dependencies accepted")}
 if _,e:=BearerServiceAuthenticator("short",DeliveryPrincipal{ServiceID:"service",Tenant:"420bet"});e==nil{
  t.Fatal("weak bearer accepted")
 }
 base,err:=NewService(validConfig(),fakeProbe{chainID:420})
 if err!=nil{t.Fatal(err)}
 w:=callNative(base,"POST","/v1/deliveries","bad",testDelivery())
 if w.Code!=404{t.Fatalf("unconfigured delivery endpoint exposed: %d",w.Code)}
}

func TestNativeDeliveryExternalWorkerCannotOverrideTerminalReceipt(t *testing.T){
 s,store,_:=testNativeAPI(t)
 if err:=s.Qualify(context.Background());err!=nil{t.Fatal(err)}
 key:=strings.Repeat("n",64)
 made:=callNative(s,"POST","/v1/deliveries",key,testDelivery())
 if made.Code!=201{t.Fatalf("create status %d",made.Code)}
 rec:=readNativeReceipt(t,made)
 delivered,err:=store.MarkDelivered(rec.ID)
 if err!=nil||delivered.Status!="delivered"{t.Fatalf("verified provider result: %v",err)}
 after:=callNative(s,"POST","/v1/deliveries/"+rec.ID+"/cancel",key,nil)
 if after.Code!=409{t.Fatalf("cancelled already delivered receipt: %d",after.Code)}
 checked:=callNative(s,"GET","/v1/deliveries/"+rec.ID,key,nil)
 if checked.Code!=200||readNativeReceipt(t,checked).Status!="delivered"{
  t.Fatal("delivered receipt was rewritten")
 }
}

package betdelivery
import(
 "bytes"
 "crypto/hmac"
 "crypto/sha256"
 "encoding/hex"
 "encoding/json"
 "net/http"
 "net/http/httptest"
 "path/filepath"
 "testing"
 "time"
 "github.com/420integrated/420-integrated/notifications/betconsent"
)
func signedEvidence(v ProviderEvidence,key string)ProviderEvidence{
 mac:=hmac.New(sha256.New,[]byte(key))
 _,_=mac.Write([]byte(providerPreimage(v)))
 v.Signature=hex.EncodeToString(mac.Sum(nil));return v
}
func TestProviderSignedDeliveryReceiptPersistenceReplayAndCancellationFence(t *testing.T){
 dir:=t.TempDir()
 subs,e:=betconsent.Open(filepath.Join(dir,"sub.json"));if e!=nil{t.Fatal(e)};defer subs.Close()
 if _,e=subs.Apply(betconsent.Subscription{Tenant:"420bet",UserID:"subject-1",
  SubscriptionID:"sub-1",Recipient:"route-1",PolicyVersion:"p1",
  Channel:"notifications",Active:true,Consent:true},0);e!=nil{t.Fatal(e)}
 path:=filepath.Join(dir,"deliveries.json")
 ledger,e:=Open(path);if e!=nil{t.Fatal(e)}
 first,e:=ledger.Send(sample(),subs);if e!=nil{t.Fatal(e)}
 key:="independent-provider-receipt-signing-key-00000"
 evidence:=signedEvidence(ProviderEvidence{Tenant:"420bet",UserID:"subject-1",
  DeliveryID:first.DeliveryID,IdempotencyKey:first.IdempotencyKey,
  ProviderReceiptID:"real-provider-receipt-1",Status:"delivered",
  OccurredAt:time.Now().UnixMilli()},key)
 forged:=evidence;forged.ProviderReceiptID="untrusted-receipt"
 if _,e=ledger.ConfirmProvider(forged,[]byte(key),time.Now());e==nil{t.Fatal("forged callback accepted")}
 finished,e:=ledger.ConfirmProvider(evidence,[]byte(key),time.Now())
 if e!=nil||finished.Status!="delivered"||finished.ProviderReceiptID!=evidence.ProviderReceiptID{
  t.Fatal("real provider signature rejected",e)
 }
 if _,e=ledger.ConfirmProvider(evidence,[]byte(key),time.Now());e!=nil{t.Fatal("idempotent callback rejected",e)}
 conflicting:=evidence;conflicting.ProviderReceiptID="different-receipt"
 conflicting=signedEvidence(conflicting,key)
 if _,e=ledger.ConfirmProvider(conflicting,[]byte(key),time.Now());e==nil{t.Fatal("conflicting provider evidence accepted")}
 if e=ledger.Close();e!=nil{t.Fatal(e)}
 ledger,e=Open(path);if e!=nil{t.Fatal(e)};defer ledger.Close()
 r,e:=ledger.Receipt(lookup{Tenant:"420bet",UserID:"subject-1",
  DeliveryID:first.DeliveryID,IdempotencyKey:first.IdempotencyKey},false)
 if e!=nil||r.Status!="delivered"{t.Fatal("real receipt not durable",e)}
 if _,e=ledger.Receipt(lookup{Tenant:"420bet",UserID:"subject-1",
  DeliveryID:first.DeliveryID,IdempotencyKey:first.IdempotencyKey},true);e!=nil{t.Fatal(e)}
 if _,e=ledger.ConfirmProvider(signedEvidence(ProviderEvidence{Tenant:"420bet",
  UserID:"subject-1",DeliveryID:"forged-other",IdempotencyKey:first.IdempotencyKey,
  ProviderReceiptID:"real-provider-receipt-1",Status:"delivered",
  OccurredAt:time.Now().UnixMilli()},key),[]byte(key),time.Now());e==nil{
  t.Fatal("wrong owner delivery accepted")}
}
func TestAuthenticatedProviderCallbackStrictSeparation(t *testing.T){
 dir:=t.TempDir()
 subs,e:=betconsent.Open(filepath.Join(dir,"sub.json"));if e!=nil{t.Fatal(e)};defer subs.Close()
 if _,e=subs.Apply(betconsent.Subscription{Tenant:"420bet",UserID:"subject-1",
  SubscriptionID:"sub-1",Recipient:"route-1",PolicyVersion:"p1",
  Channel:"notifications",Active:true,Consent:true},0);e!=nil{t.Fatal(e)}
 ledger,e:=Open(filepath.Join(dir,"deliveries.json"));if e!=nil{t.Fatal(e)};defer ledger.Close()
 r,e:=ledger.Send(sample(),subs);if e!=nil{t.Fatal(e)}
 providerToken:="independent-provider-credential-000000000000"
 key:="independent-provider-signing-credential-000"
 h,e:=ProviderReceiptHandler(ledger,subs,providerToken,key);if e!=nil{t.Fatal(e)}
 v:=signedEvidence(ProviderEvidence{Tenant:"420bet",UserID:"subject-1",DeliveryID:r.DeliveryID,
  IdempotencyKey:r.IdempotencyKey,ProviderReceiptID:"provider123",Status:"delivered",
  OccurredAt:time.Now().UnixMilli()},key)
 ask:=func(token string,proof any)int{
  b,_:=json.Marshal(proof)
  req:=httptest.NewRequest(http.MethodPost,"/v1/420bet/provider-receipts/confirm",bytes.NewReader(b))
  req.Header.Set("Authorization","Bearer "+token)
  w:=httptest.NewRecorder();h.ServeHTTP(w,req)
  return w.Code
 }
 if ask("bet-worker-token-xxxxxxxxxxxxxxxxxxxxxxxx",v)!=403{t.Fatal("worker can forge external provider receipt")}
 if ask(providerToken,v)!=200{t.Fatal("approved downstream callback rejected")}
}

func TestPrivateProviderClaimLeaseConsentAndRestart(t *testing.T){
 dir:=t.TempDir()
 subs,e:=betconsent.Open(filepath.Join(dir,"sub.json"));if e!=nil{t.Fatal(e)};defer subs.Close()
 record:=betconsent.Subscription{Tenant:"420bet",UserID:"subject-1",SubscriptionID:"sub-1",
  Recipient:"route-1",PolicyVersion:"p1",Channel:"notifications",Active:true,Consent:true}
 if _,e=subs.Apply(record,0);e!=nil{t.Fatal(e)}
 path:=filepath.Join(dir,"delivery.json")
 ledger,e:=Open(path);if e!=nil{t.Fatal(e)}
 if _,e=ledger.Send(sample(),subs);e!=nil{t.Fatal(e)}
 now:=time.Now()
 list,e:=ledger.ClaimPending(subs,10,now)
 if e!=nil||len(list)!=1{t.Fatal("missing consent-eligible claim",e)}
 next,e:=ledger.ClaimPending(subs,10,now.Add(5*time.Second))
 if e!=nil||len(next)!=0{t.Fatal("claimed message sent twice")}
 if e=ledger.Close();e!=nil{t.Fatal(e)}
 ledger,e=Open(path);if e!=nil{t.Fatal(e)};defer ledger.Close()
 replay,e:=ledger.ClaimPending(subs,10,now.Add(31*time.Second))
 if e!=nil||len(replay)!=1{t.Fatal("crash lease did not recover",e)}
 record.Muted=true
 if _,e=subs.Apply(record,1);e!=nil{t.Fatal(e)}
 withheld,e:=ledger.ClaimPending(subs,10,now.Add(62*time.Second))
 if e!=nil||len(withheld)!=0{t.Fatal("muted audience leaked to provider")}
}

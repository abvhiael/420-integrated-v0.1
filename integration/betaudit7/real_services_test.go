package betaudit7

import (
 "context"
 "crypto/sha256"
 "crypto/subtle"
 "encoding/hex"
 "encoding/json"
 "errors"
 "fmt"
 "net/http"
 "net/http/httptest"
 "os"
 "os/exec"
 "path/filepath"
 "strings"
 "sync"
 "testing"
 "time"

 "github.com/420integrated/420-integrated/mail"
 "github.com/420integrated/420-integrated/notifications/betconsent"
 "github.com/420integrated/420-integrated/notifications/betdelivery"
 notificationruntime "github.com/420integrated/420-integrated/notifications/runtime"
)
const mailToken="local-only-mail-identity-credential-000000000"
const readToken="local-only-consent-reader-credential-0000"
const writeToken="local-only-consent-writer-credential-0000"
const deliveryToken="local-only-notifications-delivery-token-0000"
type ids map[string]bool
func (d ids)ResolveIdentity(_ context.Context,id string)error{
 if !d[id]{return errors.New("identity not approved")}
 return nil
}
type policy struct{}
func(policy)CanMessage(context.Context,string,string)error{return nil}
type blobs struct{mu sync.Mutex;data map[string][]byte}
func(b *blobs)PutPrivate(_ context.Context,owner string,v []byte)(string,string,error){
 b.mu.Lock();defer b.mu.Unlock()
 if b.data==nil{b.data=map[string][]byte{}}
 sum:=sha256.Sum256(v);d:=hex.EncodeToString(sum[:])
 key:=owner+":"+d
 b.data[key]=append([]byte(nil),v...)
 return key,d,nil
}
func(b *blobs)GetPrivate(_ context.Context,owner,ref string)([]byte,error){
 b.mu.Lock();defer b.mu.Unlock()
 if !strings.HasPrefix(ref,owner+":"){return nil,errors.New("owner mismatch")}
 v,ok:=b.data[ref];if !ok{return nil,errors.New("blob absent")}
 return append([]byte(nil),v...),nil
}
type qualifiedProbe struct{}
func(qualifiedProbe)ChainID(context.Context)(uint64,error){return 420,nil}
func(qualifiedProbe)Ready(context.Context)error{return nil}
func TestActualGoServicesAndNodeDeliveryWorkerEndToEnd(t *testing.T){
 if testing.Short(){t.Skip("Go HTTP + Node process qualification")}
 dir:=t.TempDir()
 subs,e:=betconsent.Open(filepath.Join(dir,"subscriptions.json"))
 if e!=nil{t.Fatal(e)}
 defer subs.Close()
 for _,sub:=range []betconsent.Subscription{
  {Tenant:"420bet",UserID:"subject-1",SubscriptionID:"sub-mail",
   Recipient:"recipient-1",Channel:"mail",PolicyVersion:"p1",Active:true,Consent:true},
  {Tenant:"420bet",UserID:"subject-1",SubscriptionID:"sub-push",
   Recipient:"route-1",Channel:"notifications",PolicyVersion:"p1",Active:true,Consent:true},
 }{
  if _,e=subs.Apply(sub,0);e!=nil{t.Fatal(e)}
 }
 ledger,e:=betdelivery.Open(filepath.Join(dir,"notification-ledger.json"))
 if e!=nil{t.Fatal(e)}
 defer ledger.Close()
 notify,e:=notificationruntime.NewService(notificationruntime.Config{ChainID:420,
  IndexerURL:"http://127.0.0.1:8420",ListenAddr:"127.0.0.1:0",RequestTimeout:time.Second},qualifiedProbe{})
 if e!=nil{t.Fatal(e)}
 if e=notify.EnableBetConsent(subs,readToken,writeToken);e!=nil{t.Fatal(e)}
 if e=notify.EnableBetDelivery(ledger,subs,deliveryToken);e!=nil{t.Fatal(e)}
 if e=notify.Qualify(context.Background());e!=nil{t.Fatal(e)}
 notificationsHTTP:=httptest.NewServer(notify.Handler());defer notificationsHTTP.Close()
 mailPath:=filepath.Join(dir,"mail-metadata.json")
 mailStore,e:=mail.OpenDurableStore(mailPath);if e!=nil{t.Fatal(e)}
 service:=mail.NewService(ids{"sender-id":true,"recipient-1":true},policy{},&blobs{},nil,mailStore)
 mailHandler:=mail.HTTPHandler{Service:service,Authenticate:func(r *http.Request)(string,error){
  expected:="Bearer "+mailToken
  given:=r.Header.Get("Authorization")
  if subtle.ConstantTimeCompare([]byte(given),[]byte(expected))!=1{return "",errors.New("bad Mail bearer")}
  return "sender-id",nil
 }}
 mailHTTP:=httptest.NewServer(mailHandler);defer mailHTTP.Close()
 node:="../../clients/420bet-lobby/tests/real-go-services-bridge.mjs"
 ctx,cancel:=context.WithTimeout(context.Background(),60*time.Second);defer cancel()
 command:=exec.CommandContext(ctx,"node",node)
 command.Env=append(os.Environ(),
  "LOCAL_GO_MAIL_URL="+mailHTTP.URL,
  "LOCAL_GO_NOTIFICATIONS_URL="+notificationsHTTP.URL,
  "LOCAL_GO_MAIL_TOKEN="+mailToken,
  "LOCAL_GO_CONSENT_READ_TOKEN="+readToken,
  "LOCAL_GO_CONSENT_WRITE_TOKEN="+writeToken,
  "LOCAL_GO_NOTIFICATION_DELIVERY_TOKEN="+deliveryToken,
  "LOCAL_GO_OUTBOX_PATH="+filepath.Join(dir,"bet-outbox.json"))
 output,e:=command.CombinedOutput()
 if e!=nil{t.Fatalf("actual Go service ↔ Node broker E2E failed: %v\n%s",e,string(output))}
 var result struct {Passed bool `json:"passed"`;MailStatus string `json:"mailStatus"`;
   NotificationStatus string `json:"notificationStatus"`;RevocationCursor int `json:"revocationCursor"`}
 if e=json.Unmarshal(output,&result);e!=nil{t.Fatalf("invalid E2E evidence: %v: %q",e,string(output))}
 if !result.Passed||result.MailStatus!="delivered"||result.NotificationStatus!="cancelled"||
  result.RevocationCursor!=1{t.Fatalf("real Go service evidence incomplete: %+v",result)}
 // Re-open both genuine Go metadata stores rather than trusting a Node summary.
 reopened,e:=mail.OpenDurableStore(mailPath);if e!=nil{t.Fatal(e)}
 if !reopened.Durable(){t.Fatal("Mail metadata is not durable")}
 push,e:=betdelivery.Open(filepath.Join(dir,"notification-ledger.json"))
 if e==nil{_ =push.Close();t.Fatal("second Notifications delivery writer bypassed lock")}
 if !strings.Contains(e.Error(),"exist"){t.Fatal("wrong lock refusal",e)}
 events,e:=subs.Revocations(0,10);if e!=nil||len(events)!=1||events[0].Reason!="revoked"{
  t.Fatalf("missing actual Go revocation event: %#v %v",events,e)
 }
 // Local adapter evidence cannot qualify live chain authority or external provider delivery.
 _=fmt.Sprintf
}

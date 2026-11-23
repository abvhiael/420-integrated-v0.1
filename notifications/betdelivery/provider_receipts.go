package betdelivery

import(
 "crypto/hmac"
 "crypto/sha256"
 "crypto/subtle"
 "encoding/hex"
 "errors"
 "net/http"
 "sort"

 "github.com/420integrated/420-integrated/notifications/betconsent"
 "strconv"
 "strings"
 "time"
)
// ProviderEvidence is a signed assertion from an independently authenticated,
// designated downstream push provider, NOT from the 420Bet delivery caller.
type ProviderEvidence struct {
 Tenant string `json:"tenant"`
 UserID string `json:"userId"`
 DeliveryID string `json:"deliveryId"`
 IdempotencyKey string `json:"idempotencyKey"`
 ProviderReceiptID string `json:"providerReceiptId"`
 Status string `json:"status"`
 OccurredAt int64 `json:"occurredAt"`
 Signature string `json:"signature"`
}
func providerPreimage(v ProviderEvidence)string{
 return strings.Join([]string{"420BET-NOTIFICATION-PROVIDER-V1",
 v.Tenant,v.UserID,v.DeliveryID,v.IdempotencyKey,v.ProviderReceiptID,
 v.Status,strconv.FormatInt(v.OccurredAt,10)},"\n")
}
func(s *Store) ConfirmProvider(v ProviderEvidence,secret []byte,now time.Time)(receipt,error){
 if v.Tenant!="420bet"||!ident.MatchString(v.UserID)||!ident.MatchString(v.DeliveryID)||
 !digest.MatchString(v.IdempotencyKey)||!ident.MatchString(v.ProviderReceiptID)||
 (v.Status!="delivered"&&v.Status!="failed")||v.OccurredAt>now.Add(time.Minute).UnixMilli()||
 v.OccurredAt<now.Add(-2*time.Minute).UnixMilli()||len(secret)<32{
  return receipt{},errors.New("invalid provider evidence")
 }
 sig,e:=hex.DecodeString(v.Signature)
 mac:=hmac.New(sha256.New,secret);_,_=mac.Write([]byte(providerPreimage(v)))
 if e!=nil||subtle.ConstantTimeCompare(sig,mac.Sum(nil))!=1{
  return receipt{},errors.New("provider signature invalid")
 }
 s.mu.Lock();defer s.mu.Unlock()
 if s.closed{return receipt{},errors.New("delivery ledger closed")}
 prior,ok:=s.state.Items[v.DeliveryID]
 if !ok||prior.Request.Tenant!=v.Tenant||prior.Request.UserID!=v.UserID||
 prior.Request.IdempotencyKey!=v.IdempotencyKey{
  return receipt{},errors.New("provider scope mismatch")
 }
 // Reject late acknowledgement of cancelled queue entries. Cancellation is a
 // durable terminal safety fence; ambiguous external sends need operations review.
 if prior.Receipt.Status==v.Status&&prior.Receipt.ProviderReceiptID==v.ProviderReceiptID{
  return prior.Receipt,nil
 }
 if prior.Receipt.Status!="pending"{return receipt{},errors.New("conflicting or late provider receipt")}
 next:=snapshot{Schema:1,Items:make(map[string]entry,len(s.state.Items))}
 for k,x:=range s.state.Items{next.Items[k]=x}
 prior.Receipt.Status=v.Status;prior.Receipt.ProviderReceiptID=v.ProviderReceiptID
 next.Items[v.DeliveryID]=prior
 if err:=s.persist(next);err!=nil{return receipt{},err}
 s.state=next
 return prior.Receipt,nil
}
// ClaimPending hands out only consent-eligible notifications, using a durable
// lease and idempotency key. A crashed provider may reclaim after expiry.
// A provider MUST independently recheck current consent immediately before send.
type ProviderClaim struct{
 DeliveryID string `json:"deliveryId"`
 Delivery Delivery `json:"delivery"`
}
func(s *Store) ClaimPending(consent *betconsent.Store,limit int,now time.Time)([]ProviderClaim,error){
 if consent==nil||limit<1||limit>50{return nil,errors.New("invalid provider claim")}
 s.mu.Lock();defer s.mu.Unlock()
 if s.closed{return nil,errors.New("delivery ledger closed")}
 keys:=make([]string,0,len(s.state.Items))
 for k:=range s.state.Items{keys=append(keys,k)}
 sort.Strings(keys)
 selected:=make([]ProviderClaim,0,limit)
 next:=snapshot{Schema:1,Items:make(map[string]entry,len(s.state.Items))}
 for k,x:=range s.state.Items{next.Items[k]=x}
 for _,key:=range keys{
  if len(selected)>=limit{break}
  x:=next.Items[key]
  if x.Receipt.Status!="pending"||x.NextClaimAt>now.UnixMilli()||
   x.ClaimAttempts>=100{continue}
  d:=x.Request
  c:=consent.Check(betconsent.Check{Tenant:d.Tenant,UserID:d.UserID,
   SubscriptionID:d.SubscriptionID,Recipient:d.Recipient,Channel:"notifications",
   PolicyVersion:d.PolicyVersion,Kind:d.Event.Kind})
  if !c.Active||!c.Consent||c.Revoked||c.Muted{continue}
  x.NextClaimAt=now.Add(30*time.Second).UnixMilli()
  x.ClaimAttempts++
  next.Items[key]=x
  selected=append(selected,ProviderClaim{DeliveryID:x.Receipt.DeliveryID,Delivery:d})
 }
 if len(selected)>0{
  if err:=s.persist(next);err!=nil{return nil,err}
  s.state=next
 }
 return selected,nil
}
func ProviderReceiptHandler(store *Store,consent *betconsent.Store,token,secret string)(http.Handler,error){
 if store==nil||consent==nil||len(token)<32||len(secret)<32||token==secret{
  return nil,errors.New("separate downstream provider credentials required")
 }
 mux:=http.NewServeMux()
 mux.HandleFunc("POST /v1/420bet/provider-receipts/claim",func(w http.ResponseWriter,r *http.Request){
  if subtle.ConstantTimeCompare([]byte(r.Header.Get("Authorization")),[]byte("Bearer "+token))!=1{
   send(w,403,map[string]string{"error":"access denied"});return
  }
  var q struct{Limit int `json:"limit"`}
  if e:=body(r,&q);e!=nil{send(w,400,map[string]string{"error":"invalid claim"});return}
  pending,e:=store.ClaimPending(consent,q.Limit,time.Now())
  if e!=nil{send(w,503,map[string]string{"error":"provider claim unavailable"});return}
  send(w,200,map[string]any{"deliveries":pending})
 })
 mux.HandleFunc("POST /v1/420bet/provider-receipts/confirm",func(w http.ResponseWriter,r *http.Request){
  if subtle.ConstantTimeCompare([]byte(r.Header.Get("Authorization")),[]byte("Bearer "+token))!=1{
   send(w,403,map[string]string{"error":"access denied"});return
  }
  var p ProviderEvidence
  if e:=body(r,&p);e!=nil{send(w,400,map[string]string{"error":"invalid provider receipt"});return}
  receipt,e:=store.ConfirmProvider(p,[]byte(secret),time.Now())
  if e!=nil{send(w,409,map[string]string{"error":"unverified provider receipt"});return}
  send(w,200,receipt)
 })
 return mux,nil
}

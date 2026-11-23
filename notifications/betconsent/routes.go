package betconsent

import (
 "crypto/hmac"
 "crypto/sha256"
 "crypto/subtle"
 "encoding/hex"
 "errors"
 "net/http"
 "regexp"
 "strconv"
 "strings"
 "time"
)
type RouteBinding struct{
 Tenant string `json:"tenant"`
 UserID string `json:"userId"`
 Channel string `json:"channel"`
 Recipient string `json:"recipient"`
 Active bool `json:"active"`
 ExpiresAt int64 `json:"expiresAt"`
 Revision uint64 `json:"revision"`
}
type RouteAssertion struct{
 Tenant string `json:"tenant"`
 UserID string `json:"userId"`
 Channel string `json:"channel"`
 Recipient string `json:"recipient"`
 Action string `json:"action"`
 IssuedAt int64 `json:"issuedAt"`
 ExpiresAt int64 `json:"expiresAt"`
 Nonce string `json:"nonce"`
 ExpectedRevision uint64 `json:"expectedRevision"`
 Signature string `json:"signature"`
}
func routeKey(channel,recipient string)string{return channel+"|"+recipient}
func validRouteBinding(r RouteBinding)bool{
 return r.Tenant=="420bet"&&id.MatchString(r.UserID)&&id.MatchString(r.Recipient)&&
  (r.Channel=="mail"||r.Channel=="notifications")&&r.Revision>0&&r.ExpiresAt>0
}
func routeProofText(a RouteAssertion)string{
 return strings.Join([]string{"420BET-ROUTE-PROVIDER-V1",a.Action,a.Tenant,
  a.UserID,a.Channel,a.Recipient,strconv.FormatInt(a.IssuedAt,10),
  strconv.FormatInt(a.ExpiresAt,10),a.Nonce,strconv.FormatUint(a.ExpectedRevision,10)},"\n")
}
func(s *Store)routeValid(user,channel,recipient string,now int64)bool{
 v,ok:=s.data.Routes[routeKey(channel,recipient)]
 return ok&&v.Active&&v.UserID==user&&v.ExpiresAt>now
}
// RequireRoutes installs fail-closed consent validation. It does not create or
// transfer a recipient route. Call only after approved provider configuration.
func(s *Store)RequireRoutes(){s.mu.Lock();s.requireRoutes=true;s.mu.Unlock()}
func(s *Store)AttestRoute(a RouteAssertion,secret []byte,now time.Time)(RouteBinding,error){
 candidate:=RouteBinding{Tenant:a.Tenant,UserID:a.UserID,Channel:a.Channel,
  Recipient:a.Recipient}
 if a.Tenant!="420bet"||!id.MatchString(a.UserID)||!id.MatchString(a.Recipient)||
  (a.Channel!="mail"&&a.Channel!="notifications")||
  !regexp.MustCompile(`^[a-f0-9]{64}$`).MatchString(a.Nonce)||
  (a.Action!="bind"&&a.Action!="revoke")||len(secret)<32||
  a.IssuedAt>now.Add(time.Minute).UnixMilli()||
  a.IssuedAt<now.Add(-time.Minute).UnixMilli()||
  a.ExpiresAt<=now.UnixMilli()||a.ExpiresAt>now.Add(30*24*time.Hour).UnixMilli(){
  return RouteBinding{},errors.New("invalid provider route attestation")
 }
 proof,e:=hex.DecodeString(a.Signature)
 mac:=hmac.New(sha256.New,secret);_,_=mac.Write([]byte(routeProofText(a)))
 if e!=nil||subtle.ConstantTimeCompare(proof,mac.Sum(nil))!=1{
  return RouteBinding{},errors.New("invalid provider route signature")
 }
 s.mu.Lock();defer s.mu.Unlock()
 if s.closed{return RouteBinding{},errors.New("route authority closed")}
 if s.data.RouteNonces[a.Nonce]>now.UnixMilli(){return RouteBinding{},errors.New("route attestation replay")}
 k:=routeKey(a.Channel,a.Recipient)
 previous,exists:=s.data.Routes[k]
 if exists&&previous.Revision!=a.ExpectedRevision||!exists&&a.ExpectedRevision!=0{
  return RouteBinding{},ErrConflict
 }
 if exists&&previous.UserID!=a.UserID&&previous.Active&&previous.ExpiresAt>now.UnixMilli(){
  return RouteBinding{},errors.New("active route belongs to another subject")
 }
 if a.Action=="revoke"&&(!exists||previous.UserID!=a.UserID){
  return RouteBinding{},ErrMissing
 }
 candidate.Active=a.Action=="bind";candidate.Revision=a.ExpectedRevision+1
 candidate.ExpiresAt=a.ExpiresAt
 next:=state{Schema:1,Items:make(map[string]Subscription,len(s.data.Items)),
  Revocations:append([]Revocation(nil),s.data.Revocations...),
  EnrollmentNonces:s.data.EnrollmentNonces,
  Routes:make(map[string]RouteBinding,len(s.data.Routes)+1),
  RouteNonces:make(map[string]int64,len(s.data.RouteNonces)+1)}
 for key,value:=range s.data.Routes{next.Routes[key]=value}
 for key,value:=range s.data.Items{next.Items[key]=value}
 for key,expiry:=range s.data.RouteNonces{if expiry>now.UnixMilli(){next.RouteNonces[key]=expiry}}
 if len(next.RouteNonces)>=10000{return RouteBinding{},errors.New("route attestation capacity exceeded")}
 // Provider removal or a transfer to a different subject must atomically
 // tombstone all eligible subscriptions for the old route, emitting the same
 // ordered cancellation feed consumed by 420Bet's persistent outbox.
 if exists&&(a.Action=="revoke"||previous.UserID!=a.UserID){
  for itemKey,sub:=range next.Items{
   if sub.UserID==previous.UserID&&sub.Channel==previous.Channel&&
    sub.Recipient==previous.Recipient&&sub.Active&&sub.Consent&&!sub.Revoked{
    sub.Active=false;sub.Consent=false;sub.Revoked=true
    sub.Revision++;sub.UpdatedAt=now.UnixMilli()
    next.Items[itemKey]=sub
    next.Revocations=append(next.Revocations,Revocation{
     Sequence:uint64(len(next.Revocations)+1),Tenant:sub.Tenant,
     UserID:sub.UserID,SubscriptionID:sub.SubscriptionID,
     Revision:sub.Revision,Reason:"route_withdrawn"})
   }
  }
 }
 next.Routes[k]=candidate;next.RouteNonces[a.Nonce]=now.Add(2*time.Minute).UnixMilli()
 if e:=s.persist(next);e!=nil{return RouteBinding{},e}
 s.data=next
 return candidate,nil
}
func(s *Store)VerifyRoute(user,channel,recipient string,now time.Time)(RouteBinding,error){
 if !id.MatchString(user)||!id.MatchString(recipient)||
 (channel!="mail"&&channel!="notifications"){return RouteBinding{},errors.New("invalid route lookup")}
 s.mu.Lock();defer s.mu.Unlock()
 if s.closed||!s.routeValid(user,channel,recipient,now.UnixMilli()){
  return RouteBinding{},errors.New("route not independently attested")
 }
 v:=s.data.Routes[routeKey(channel,recipient)]
 // Recheck in 60 seconds, never promise a long lived delivery authorization.
 limit:=now.Add(time.Minute).UnixMilli()
 if v.ExpiresAt>limit{v.ExpiresAt=limit}
 return v,nil
}
func RouteHandler(s *Store,readToken,providerToken,providerKey string)(http.Handler,error){
 if s==nil||len(readToken)<32||len(providerToken)<32||len(providerKey)<32||
 readToken==providerToken||readToken==providerKey||providerToken==providerKey{
  return nil,errors.New("separate route lookup and attesting provider credentials required")
 }
 mux:=http.NewServeMux()
 authorized:=func(w http.ResponseWriter,r *http.Request,token string)bool{
  if subtle.ConstantTimeCompare([]byte(r.Header.Get("Authorization")),[]byte("Bearer "+token))!=1{
   write(w,403,map[string]string{"error":"access denied"});return false
  }
  return true
 }
 mux.HandleFunc("POST /v1/420bet/routes/verify",func(w http.ResponseWriter,r *http.Request){
  if !authorized(w,r,readToken){return}
  var q struct{Tenant string `json:"tenant"`;UserID string `json:"userId"`;
   Channel string `json:"channel"`;Recipient string `json:"recipient"`}
  if e:=decode(r,&q);e!=nil||q.Tenant!="420bet"{
   write(w,400,map[string]string{"error":"invalid route scope"});return
  }
  result,e:=s.VerifyRoute(q.UserID,q.Channel,q.Recipient,time.Now())
  if e!=nil{write(w,409,map[string]string{"error":"route not verified"});return}
  write(w,200,map[string]any{"tenant":result.Tenant,"userId":result.UserID,
   "channel":result.Channel,"recipient":result.Recipient,"verified":true,
   "active":true,"expiresAt":result.ExpiresAt})
 })
 mux.HandleFunc("POST /v1/420bet/routes/attest",func(w http.ResponseWriter,r *http.Request){
  if !authorized(w,r,providerToken){return}
  var a RouteAssertion
  if e:=decode(r,&a);e!=nil{write(w,400,map[string]string{"error":"invalid provider attestation"});return}
  result,e:=s.AttestRoute(a,[]byte(providerKey),time.Now())
  if e!=nil{write(w,409,map[string]string{"error":"route attestation rejected"});return}
  write(w,200,result)
 })
 return mux,nil
}

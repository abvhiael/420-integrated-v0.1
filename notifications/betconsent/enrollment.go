package betconsent

import (
 "crypto/hmac"
 "crypto/sha256"
 "crypto/subtle"
 "encoding/hex"
 "errors"
 "net/http"
 "strconv"
 "strings"
 "time"
)

// EnrollmentAssertion is accepted only from the separately authenticated,
// wallet-signature-verifying 420Bet broker. It is NOT a browser API.
type EnrollmentAssertion struct {
 Tenant string `json:"tenant"`
 UserID string `json:"userId"`
 SubscriptionID string `json:"subscriptionId"`
 Recipient string `json:"recipient"`
 Channel string `json:"channel"`
 PolicyVersion string `json:"policyVersion"`
 Nonce string `json:"nonce"`
 ExpiresAt int64 `json:"expiresAt"`
 ExpectedRevision uint64 `json:"expectedRevision"`
 Action string `json:"action"`
 Signature string `json:"signature"`
}
func enrollmentPayload(e EnrollmentAssertion)string{
 return strings.Join([]string{"420BET-CONSENT-BROKER-V1",e.Action,e.Tenant,e.UserID,
  e.SubscriptionID,e.Recipient,e.Channel,e.PolicyVersion,e.Nonce,
  strconv.FormatInt(e.ExpiresAt,10),strconv.FormatUint(e.ExpectedRevision,10)},"\n")
}
func (s *Store) VerifiedEnrollment(a EnrollmentAssertion,sharedKey []byte,now time.Time)(Subscription,error){
 v:=Subscription{Tenant:a.Tenant,UserID:a.UserID,SubscriptionID:a.SubscriptionID,
  Recipient:a.Recipient,Channel:a.Channel,PolicyVersion:a.PolicyVersion}
 if !valid(v)||!nonceDigest.MatchString(a.Nonce)||a.ExpiresAt<=now.UnixMilli()||
  a.ExpiresAt>now.Add(2*time.Minute).UnixMilli()||
  (a.Action!="enroll"&&a.Action!="revoke")||len(sharedKey)<32{
  return Subscription{},errors.New("invalid broker enrollment assertion")
 }
 mac:=hmac.New(sha256.New,sharedKey);_,_=mac.Write([]byte(enrollmentPayload(a)))
 sig,err:=hex.DecodeString(a.Signature)
 if err!=nil||subtle.ConstantTimeCompare(sig,mac.Sum(nil))!=1{
  return Subscription{},errors.New("invalid broker signature")
 }
 s.mu.Lock();defer s.mu.Unlock()
 if s.closed{return Subscription{},errors.New("consent store closed")}
 if s.data.EnrollmentNonces[a.Nonce]>now.UnixMilli(){return Subscription{},errors.New("enrollment replay")}
 if s.requireRoutes&&a.Action=="enroll"&&
  !s.routeValid(a.UserID,a.Channel,a.Recipient,now.UnixMilli()){
  return Subscription{},errors.New("provider route ownership not attested")
 }
 k:=key(v.Tenant,v.UserID,v.SubscriptionID)
 prior,exists:=s.data.Items[k]
 if exists&&prior.Revoked{return Subscription{},errors.New("permanently revoked subscription")}
 if !exists&&a.ExpectedRevision!=0||exists&&prior.Revision!=a.ExpectedRevision{
  return Subscription{},ErrConflict
 }
 if exists&&(prior.Recipient!=a.Recipient||prior.Channel!=a.Channel){
  return Subscription{},errors.New("immutable consent destination")
 }
 // A new policy version requires a new, independently verified wallet
 // signature and fresh nonce. That evidence is carried by this assertion.
 v.Active=a.Action=="enroll";v.Consent=a.Action=="enroll"
 v.Muted=false;v.Revoked=a.Action=="revoke"
 v.Revision=a.ExpectedRevision+1;v.UpdatedAt=now.UnixMilli()
 next:=state{Schema:1,Items:make(map[string]Subscription,len(s.data.Items)+1),
  Revocations:append([]Revocation(nil),s.data.Revocations...),
  EnrollmentNonces:make(map[string]int64,len(s.data.EnrollmentNonces)+1),
  Routes:s.data.Routes,RouteNonces:s.data.RouteNonces}
 for k,x:=range s.data.Items{next.Items[k]=x}
 for k,x:=range s.data.EnrollmentNonces{if x>now.UnixMilli(){next.EnrollmentNonces[k]=x}}
 if len(next.EnrollmentNonces)>=10000{return Subscription{},errors.New("enrollment nonce capacity exceeded")}
 next.Items[k]=v;next.EnrollmentNonces[a.Nonce]=a.ExpiresAt
 if a.Action=="revoke"{
  if !exists{return Subscription{},ErrMissing}
  next.Revocations=append(next.Revocations,Revocation{Sequence:uint64(len(next.Revocations)+1),
   Tenant:v.Tenant,UserID:v.UserID,SubscriptionID:v.SubscriptionID,
   Revision:v.Revision,Reason:"revoked"})
 }else if exists&&prior.Active&&prior.Consent&&!prior.Muted&&
  (prior.PolicyVersion!=v.PolicyVersion){
  // A policy switch retires previous delivery eligibility; the outbox
  // rechecks current policy before any send.
  next.Revocations=append(next.Revocations,Revocation{Sequence:uint64(len(next.Revocations)+1),
   Tenant:v.Tenant,UserID:v.UserID,SubscriptionID:v.SubscriptionID,
   Revision:v.Revision,Reason:"consent_policy_replaced"})
 }
 if err:=s.persist(next);err!=nil{return Subscription{},err}
 s.data=next
 return v,nil
}
func EnrollmentHandler(s *Store,brokerToken,brokerKey string)(http.Handler,error){
 if s==nil||len(brokerToken)<32||len(brokerKey)<32||
  brokerToken==brokerKey{return nil,errors.New("separate enrollment broker credentials required")}
 mux:=http.NewServeMux()
 mux.HandleFunc("POST /v1/420bet/enrollments/commit",func(w http.ResponseWriter,r *http.Request){
  if subtle.ConstantTimeCompare([]byte(r.Header.Get("Authorization")),[]byte("Bearer "+brokerToken))!=1{
   write(w,403,map[string]string{"error":"access denied"});return
  }
  var a EnrollmentAssertion
  if err:=decode(r,&a);err!=nil{write(w,400,map[string]string{"error":"invalid assertion"});return}
  result,err:=s.VerifiedEnrollment(a,[]byte(brokerKey),time.Now())
  if err!=nil{write(w,409,map[string]string{"error":"enrollment rejected"});return}
  // Never expose the raw signature or the user's wallet proof.
  write(w,200,result)
 })
 return mux,nil
}

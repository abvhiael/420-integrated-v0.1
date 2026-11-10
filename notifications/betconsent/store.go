// Package betconsent provides a private persistent BET-AUDIT-7 opt-in policy
// boundary for 420Notifications. It never grants betting or wallet authority.
package betconsent

import (
 "crypto/subtle"
 "encoding/json"
 "errors"
 "fmt"
 "io"
 "net/http"
 "os"
 "path/filepath"
 "regexp"
 "sort"
 "sync"
 "time"
)

var id = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$`)
var nonceDigest = regexp.MustCompile(`^[a-f0-9]{64}$`)
var ErrConflict = errors.New("subscription version conflict")
var ErrMissing = errors.New("subscription not found")

type Subscription struct {
 Tenant string `json:"tenant"`
 UserID string `json:"userId"`
 SubscriptionID string `json:"subscriptionId"`
 Recipient string `json:"recipient"`
 Channel string `json:"channel"`
 PolicyVersion string `json:"policyVersion"`
 Active bool `json:"active"`
 Muted bool `json:"muted"`
 Revoked bool `json:"revoked"`
 Consent bool `json:"consent"`
 Revision uint64 `json:"revision"`
 UpdatedAt int64 `json:"updatedAt"`
}
type Check struct {
 Tenant string `json:"tenant"`
 UserID string `json:"userId"`
 SubscriptionID string `json:"subscriptionId"`
 Recipient string `json:"recipient"`
 Channel string `json:"channel"`
 Kind string `json:"kind"`
 PolicyVersion string `json:"policyVersion"`
}
type Revocation struct {
 Sequence uint64 `json:"sequence"`
 Tenant string `json:"tenant"`
 UserID string `json:"userId"`
 SubscriptionID string `json:"subscriptionId"`
 Revision uint64 `json:"revision"`
 Reason string `json:"reason"`
}
type state struct {
 Schema int `json:"schema"`
 Items map[string]Subscription `json:"items"`
 Revocations []Revocation `json:"revocations,omitempty"`
 EnrollmentNonces map[string]int64 `json:"enrollmentNonces,omitempty"`
 Routes map[string]RouteBinding `json:"routes,omitempty"`
 RouteNonces map[string]int64 `json:"routeNonces,omitempty"`
}
type Store struct { mu sync.Mutex; path string; lock string; closed bool; requireRoutes bool; data state }
func key(tenant,user,sub string) string { return tenant+"|"+user+"|"+sub }
func valid(s Subscription) bool {
 return s.Tenant=="420bet"&&id.MatchString(s.UserID)&&id.MatchString(s.SubscriptionID)&&
 id.MatchString(s.Recipient)&&(s.Channel=="mail"||s.Channel=="notifications")&&id.MatchString(s.PolicyVersion)
}
func validCheck(c Check) bool {
 return valid(Subscription{Tenant:c.Tenant,UserID:c.UserID,SubscriptionID:c.SubscriptionID,Recipient:c.Recipient,Channel:c.Channel,PolicyVersion:c.PolicyVersion})&&id.MatchString(c.Kind)
}
func Open(path string)(*Store,error){
 if !filepath.IsAbs(path) { return nil,errors.New("absolute private subscription path required") }
 dir:=filepath.Dir(path)
 if err:=os.MkdirAll(dir,0700);err!=nil{return nil,err}
 info,err:=os.Stat(dir);if err!=nil{return nil,err}
 if info.Mode().Perm()&0022!=0{return nil,errors.New("unsafe consent directory permissions")}
 lock:=path+".lock"
 if err:=os.Mkdir(lock,0700);err!=nil{return nil,fmt.Errorf("exclusive subscription writer lock unavailable: %w",err)}
 success:=false
 defer func(){if !success {_=os.Remove(lock)}}()
 s:=&Store{path:path,lock:lock,data:state{Schema:1,Items:map[string]Subscription{}}}
 b,err:=os.ReadFile(path)
 if err==nil {
  fi,e:=os.Stat(path);if e!=nil{return nil,e}
  if !fi.Mode().IsRegular()||fi.Mode().Perm()&0077!=0||len(b)>5000000{return nil,errors.New("unsafe subscription file")}
  if e=json.Unmarshal(b,&s.data);e!=nil{return nil,e}
  if s.data.Schema!=1||s.data.Items==nil{return nil,errors.New("invalid subscription schema")}
  for k,v:=range s.data.Items {if !valid(v)||k!=key(v.Tenant,v.UserID,v.SubscriptionID)||v.Revision==0{return nil,errors.New("invalid stored subscription")}}
  for nonce,expiry:=range s.data.RouteNonces {if expiry<=0||!nonceDigest.MatchString(nonce){return nil,errors.New("invalid route nonce state")}}
  for k,r:=range s.data.Routes {if k!=routeKey(r.Channel,r.Recipient)||!validRouteBinding(r){return nil,errors.New("invalid route binding state")}}
  for nonce,expiry:=range s.data.EnrollmentNonces {if expiry<=0||!nonceDigest.MatchString(nonce){return nil,errors.New("invalid enrollment nonce state")}}
  for i,e:=range s.data.Revocations {
   if e.Sequence!=uint64(i+1)||e.Tenant!="420bet"||!id.MatchString(e.UserID)||!id.MatchString(e.SubscriptionID)||e.Revision==0||e.Reason=="" {return nil,errors.New("invalid revocation log")}
  }
 }else if !os.IsNotExist(err){return nil,err
 }else if err=s.persist(s.data);err!=nil{return nil,err}
 success=true
 return s,nil
}
func(s *Store)Close()error{s.mu.Lock();defer s.mu.Unlock();if s.closed{return nil};s.closed=true;return os.Remove(s.lock)}
func (s *Store) persist(data state) error {
 b,err:=json.Marshal(data);if err!=nil{return err}
 dir:=filepath.Dir(s.path)
 f,err:=os.CreateTemp(dir,".consent-*");if err!=nil{return err}
 tmp:=f.Name()
 defer os.Remove(tmp)
 if err=f.Chmod(0600);err!=nil{f.Close();return err}
 if _,err=f.Write(b);err!=nil{f.Close();return err}
 if err=f.Sync();err!=nil{f.Close();return err}
 if err=f.Close();err!=nil{return err}
 if err=os.Rename(tmp,s.path);err!=nil{return err}
 d,err:=os.Open(dir);if err!=nil{return err};defer d.Close()
 return d.Sync()
}
func (s *Store) Apply(v Subscription,expectedRevision uint64)(Subscription,error){
 if !valid(v){return Subscription{},errors.New("invalid subscription scope")}
 s.mu.Lock();defer s.mu.Unlock()
 if s.closed{return Subscription{},errors.New("subscription store closed")}
 k:=key(v.Tenant,v.UserID,v.SubscriptionID)
 prior,exists:=s.data.Items[k]
 if !exists&&expectedRevision!=0||exists&&prior.Revision!=expectedRevision{return Subscription{},ErrConflict}
 // Revocation is a permanent tombstone for this subscription ID.
 if exists&&prior.Revoked{return Subscription{},errors.New("revoked subscription cannot be reactivated")}
 if exists&&(prior.Recipient!=v.Recipient||prior.Channel!=v.Channel){return Subscription{},errors.New("subscription destination immutable")}
 v.Revision=expectedRevision+1;v.UpdatedAt=time.Now().UnixMilli()
 if v.Revoked {v.Active=false;v.Consent=false}
 next:=state{Schema:1,Items:make(map[string]Subscription,len(s.data.Items)+1),Revocations:append([]Revocation(nil),s.data.Revocations...),EnrollmentNonces:s.data.EnrollmentNonces,Routes:s.data.Routes,RouteNonces:s.data.RouteNonces}
 for k,x:=range s.data.Items {next.Items[k]=x};next.Items[k]=v
 if exists && prior.Active && prior.Consent && !prior.Muted &&
  (!v.Active || !v.Consent || v.Muted || v.Revoked) {
  next.Revocations=append(next.Revocations,Revocation{Sequence:uint64(len(next.Revocations)+1),
   Tenant:v.Tenant,UserID:v.UserID,SubscriptionID:v.SubscriptionID,Revision:v.Revision,Reason:"consent_withdrawn"})
 }
 if err:=s.persist(next);err!=nil{return Subscription{},err};s.data=next
 return v,nil
}
func (s *Store) Revoke(c Check,expectedRevision uint64)(Subscription,error){
 if !validCheck(c){return Subscription{},errors.New("invalid revocation scope")}
 s.mu.Lock();defer s.mu.Unlock()
 if s.closed{return Subscription{},errors.New("subscription store closed")}
 k:=key(c.Tenant,c.UserID,c.SubscriptionID)
 prior,ok:=s.data.Items[k]
 if !ok{return Subscription{},ErrMissing}
 if prior.Revision!=expectedRevision{return Subscription{},ErrConflict}
 if prior.Recipient!=c.Recipient||prior.Channel!=c.Channel||prior.PolicyVersion!=c.PolicyVersion{return Subscription{},errors.New("revocation scope mismatch")}
 prior.Revoked=true;prior.Active=false;prior.Consent=false;prior.Revision++;prior.UpdatedAt=time.Now().UnixMilli()
 next:=state{Schema:1,Items:make(map[string]Subscription,len(s.data.Items)),Revocations:append([]Revocation(nil),s.data.Revocations...)}
 for k,x:=range s.data.Items{next.Items[k]=x};next.Items[k]=prior
 next.Revocations=append(next.Revocations,Revocation{Sequence:uint64(len(next.Revocations)+1),
  Tenant:prior.Tenant,UserID:prior.UserID,SubscriptionID:prior.SubscriptionID,Revision:prior.Revision,Reason:"revoked"})
 if err:=s.persist(next);err!=nil{return Subscription{},err};s.data=next
 return prior,nil
}
func (s *Store) Check(c Check) Subscription {
 denied:=Subscription{Tenant:c.Tenant,UserID:c.UserID,SubscriptionID:c.SubscriptionID,Recipient:c.Recipient,Channel:c.Channel,PolicyVersion:c.PolicyVersion,Revoked:true}
 if !validCheck(c){return denied}
 s.mu.Lock();defer s.mu.Unlock()
 if s.closed{return denied}
 x,ok:=s.data.Items[key(c.Tenant,c.UserID,c.SubscriptionID)]
 if !ok||x.Recipient!=c.Recipient||x.Channel!=c.Channel||x.PolicyVersion!=c.PolicyVersion{return denied}
 if s.requireRoutes&&!s.routeValid(x.UserID,x.Channel,x.Recipient,time.Now().UnixMilli()){return denied}
 return x
}

// Audience returns active, explicitly consented owner-scoped subscriptions.
// Caller must be a trusted service with the private READ token; no public listing.
func (s *Store) Audience(tenant,userID string)([]Subscription,error){
 if tenant!="420bet"||!id.MatchString(userID){return nil,errors.New("invalid private audience")}
 s.mu.Lock();defer s.mu.Unlock()
 if s.closed{return nil,errors.New("subscription store closed")}
 result:=make([]Subscription,0)
 for _,v:=range s.data.Items{
  if v.Tenant==tenant&&v.UserID==userID&&v.Active&&v.Consent&&!v.Muted&&!v.Revoked&&
   (!s.requireRoutes||s.routeValid(v.UserID,v.Channel,v.Recipient,time.Now().UnixMilli())){
   result=append(result,v)
   if len(result)>16{return nil,errors.New("subscription limit exceeded")}
  }
 }
 sort.Slice(result,func(i,j int)bool{return result[i].SubscriptionID<result[j].SubscriptionID})
 return result,nil
}

// Revocations returns strictly ordered, retained events. A consumer must persist
// its own acknowledged cursor only after cancelling local deliveries.
func (s *Store) Revocations(after uint64,limit int)([]Revocation,error){
 if limit<1||limit>100{return nil,errors.New("invalid revocation batch limit")}
 s.mu.Lock();defer s.mu.Unlock()
 if s.closed{return nil,errors.New("subscription store closed")}
 if after>uint64(len(s.data.Revocations)){return nil,errors.New("revocation cursor beyond tip")}
 end:=after+uint64(limit)
 if end>uint64(len(s.data.Revocations)){end=uint64(len(s.data.Revocations))}
 return append([]Revocation(nil),s.data.Revocations[int(after):int(end)]...),nil
}

func decode(r *http.Request,out any)error{
 if r.ContentLength>8192{return errors.New("request too large")}
 d:=json.NewDecoder(io.LimitReader(r.Body,8193));d.DisallowUnknownFields()
 if err:=d.Decode(out);err!=nil{return err}
 var extra any
 if d.Decode(&extra)!=io.EOF{return errors.New("trailing request data")}
 return nil
}
func write(w http.ResponseWriter,code int,value any){w.Header().Set("Content-Type","application/json");w.Header().Set("Cache-Control","no-store");w.WriteHeader(code);_ =json.NewEncoder(w).Encode(value)}
func Handler(store *Store,readToken,writeToken string) (http.Handler,error){
 if store==nil||len(readToken)<32||len(readToken)>4096||len(writeToken)<32||len(writeToken)>4096||readToken==writeToken{return nil,errors.New("private subscription store and service credential required")}
 mux:=http.NewServeMux()
 authenticated:=func(w http.ResponseWriter,r *http.Request,token string)bool{
  given:=r.Header.Get("Authorization")
  if subtle.ConstantTimeCompare([]byte(given),[]byte("Bearer "+token))!=1 {write(w,403,map[string]string{"error":"access denied"});return false}
  return true
 }
 mux.HandleFunc("POST /v1/420bet/subscriptions/revocations",func(w http.ResponseWriter,r *http.Request){
  if !authenticated(w,r,readToken){return}
  var request struct { After uint64 `json:"after"`; Limit int `json:"limit"` }
  if err:=decode(r,&request);err!=nil{write(w,400,map[string]string{"error":"invalid cursor"});return}
  events,err:=store.Revocations(request.After,request.Limit)
  if err!=nil{write(w,409,map[string]string{"error":"invalid cursor"});return}
  if events==nil{events=[]Revocation{}}
  write(w,200,map[string]any{"events":events})
 })
 mux.HandleFunc("POST /v1/420bet/subscriptions/audience",func(w http.ResponseWriter,r *http.Request){
  if !authenticated(w,r,readToken){return}
  var request struct{ Tenant string `json:"tenant"`;UserID string `json:"userId"` }
  if err:=decode(r,&request);err!=nil{write(w,400,map[string]string{"error":"invalid scope"});return}
  records,err:=store.Audience(request.Tenant,request.UserID)
  if err!=nil{write(w,409,map[string]string{"error":"audience unavailable"});return}
  write(w,200,map[string]any{"subscriptions":records})
 })
 mux.HandleFunc("POST /v1/420bet/subscriptions/check",func(w http.ResponseWriter,r *http.Request){
  if !authenticated(w,r,readToken){return}
  var c Check;if err:=decode(r,&c);err!=nil||!validCheck(c){write(w,400,map[string]string{"error":"invalid scope"});return}
  write(w,200,store.Check(c))
 })
 type mutation struct { Subscription Subscription `json:"subscription"`; ExpectedRevision uint64 `json:"expectedRevision"` }
 mux.HandleFunc("POST /v1/420bet/subscriptions/apply",func(w http.ResponseWriter,r *http.Request){
  if !authenticated(w,r,writeToken){return}
  var m mutation;if err:=decode(r,&m);err!=nil{write(w,400,map[string]string{"error":"invalid request"});return}
  // The operator mutation credential is not user consent authority.
  // Legacy management can only reduce a preexisting opt-in's permissions.
  prior:=store.Check(Check{Tenant:m.Subscription.Tenant,UserID:m.Subscription.UserID,
   SubscriptionID:m.Subscription.SubscriptionID,Recipient:m.Subscription.Recipient,
   Channel:m.Subscription.Channel,PolicyVersion:m.Subscription.PolicyVersion,Kind:"account-update"})
  if !prior.Consent||!prior.Active||prior.Revoked||!m.Subscription.Consent||
   !m.Subscription.Active||m.Subscription.PolicyVersion!=prior.PolicyVersion||
   (prior.Muted&&!m.Subscription.Muted){
   write(w,403,map[string]string{"error":"user authorization required"});return
  }
  v,err:=store.Apply(m.Subscription,m.ExpectedRevision)
  if err!=nil{write(w,409,map[string]string{"error":fmt.Sprint(err)});return};write(w,200,v)
 })
 type revoke struct { Check Check `json:"check"`; ExpectedRevision uint64 `json:"expectedRevision"` }
 mux.HandleFunc("POST /v1/420bet/subscriptions/revoke",func(w http.ResponseWriter,r *http.Request){
  if !authenticated(w,r,writeToken){return}
  var m revoke;if err:=decode(r,&m);err!=nil{write(w,400,map[string]string{"error":"invalid request"});return}
  v,err:=store.Revoke(m.Check,m.ExpectedRevision)
  if err!=nil{write(w,409,map[string]string{"error":fmt.Sprint(err)});return};write(w,200,v)
 })
 return mux,nil
}

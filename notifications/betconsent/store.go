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
 "sync"
 "time"
)

var id = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$`)
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
type state struct { Schema int `json:"schema"`; Items map[string]Subscription `json:"items"` }
type Store struct { mu sync.Mutex; path string; data state }
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
 s:=&Store{path:path,data:state{Schema:1,Items:map[string]Subscription{}}}
 b,err:=os.ReadFile(path)
 if err==nil {
  fi,e:=os.Stat(path);if e!=nil{return nil,e}
  if !fi.Mode().IsRegular()||fi.Mode().Perm()&0077!=0||len(b)>5000000{return nil,errors.New("unsafe subscription file")}
  if e=json.Unmarshal(b,&s.data);e!=nil{return nil,e}
  if s.data.Schema!=1||s.data.Items==nil{return nil,errors.New("invalid subscription schema")}
  for k,v:=range s.data.Items {if !valid(v)||k!=key(v.Tenant,v.UserID,v.SubscriptionID)||v.Revision==0{return nil,errors.New("invalid stored subscription")}}
 }else if !os.IsNotExist(err){return nil,err
 }else if err=s.persist(s.data);err!=nil{return nil,err}
 return s,nil
}
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
 k:=key(v.Tenant,v.UserID,v.SubscriptionID)
 prior,exists:=s.data.Items[k]
 if !exists&&expectedRevision!=0||exists&&prior.Revision!=expectedRevision{return Subscription{},ErrConflict}
 // Revocation is a permanent tombstone for this subscription ID.
 if exists&&prior.Revoked{return Subscription{},errors.New("revoked subscription cannot be reactivated")}
 if exists&&(prior.Recipient!=v.Recipient||prior.Channel!=v.Channel){return Subscription{},errors.New("subscription destination immutable")}
 v.Revision=expectedRevision+1;v.UpdatedAt=time.Now().UnixMilli()
 if v.Revoked {v.Active=false;v.Consent=false}
 next:=state{Schema:1,Items:make(map[string]Subscription,len(s.data.Items)+1)}
 for k,x:=range s.data.Items {next.Items[k]=x};next.Items[k]=v
 if err:=s.persist(next);err!=nil{return Subscription{},err};s.data=next
 return v,nil
}
func (s *Store) Revoke(c Check,expectedRevision uint64)(Subscription,error){
 if !validCheck(c){return Subscription{},errors.New("invalid revocation scope")}
 s.mu.Lock();defer s.mu.Unlock()
 k:=key(c.Tenant,c.UserID,c.SubscriptionID)
 prior,ok:=s.data.Items[k]
 if !ok{return Subscription{},ErrMissing}
 if prior.Revision!=expectedRevision{return Subscription{},ErrConflict}
 if prior.Recipient!=c.Recipient||prior.Channel!=c.Channel||prior.PolicyVersion!=c.PolicyVersion{return Subscription{},errors.New("revocation scope mismatch")}
 prior.Revoked=true;prior.Active=false;prior.Consent=false;prior.Revision++;prior.UpdatedAt=time.Now().UnixMilli()
 next:=state{Schema:1,Items:make(map[string]Subscription,len(s.data.Items))}
 for k,x:=range s.data.Items{next.Items[k]=x};next.Items[k]=prior
 if err:=s.persist(next);err!=nil{return Subscription{},err};s.data=next
 return prior,nil
}
func (s *Store) Check(c Check) Subscription {
 denied:=Subscription{Tenant:c.Tenant,UserID:c.UserID,SubscriptionID:c.SubscriptionID,Recipient:c.Recipient,Channel:c.Channel,PolicyVersion:c.PolicyVersion,Revoked:true}
 if !validCheck(c){return denied}
 s.mu.Lock();defer s.mu.Unlock()
 x,ok:=s.data.Items[key(c.Tenant,c.UserID,c.SubscriptionID)]
 if !ok||x.Recipient!=c.Recipient||x.Channel!=c.Channel||x.PolicyVersion!=c.PolicyVersion{return denied}
 return x
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
func Handler(store *Store,token string) (http.Handler,error){
 if store==nil||len(token)<32||len(token)>4096{return nil,errors.New("private subscription store and service credential required")}
 mux:=http.NewServeMux()
 authenticated:=func(w http.ResponseWriter,r *http.Request)bool{
  given:=r.Header.Get("Authorization")
  if subtle.ConstantTimeCompare([]byte(given),[]byte("Bearer "+token))!=1 {write(w,403,map[string]string{"error":"access denied"});return false}
  return true
 }
 mux.HandleFunc("POST /v1/420bet/subscriptions/check",func(w http.ResponseWriter,r *http.Request){
  if !authenticated(w,r){return}
  var c Check;if err:=decode(r,&c);err!=nil||!validCheck(c){write(w,400,map[string]string{"error":"invalid scope"});return}
  write(w,200,store.Check(c))
 })
 type mutation struct { Subscription Subscription `json:"subscription"`; ExpectedRevision uint64 `json:"expectedRevision"` }
 mux.HandleFunc("POST /v1/420bet/subscriptions/apply",func(w http.ResponseWriter,r *http.Request){
  if !authenticated(w,r){return}
  var m mutation;if err:=decode(r,&m);err!=nil{write(w,400,map[string]string{"error":"invalid request"});return}
  v,err:=store.Apply(m.Subscription,m.ExpectedRevision)
  if err!=nil{write(w,409,map[string]string{"error":fmt.Sprint(err)});return};write(w,200,v)
 })
 type revoke struct { Check Check `json:"check"`; ExpectedRevision uint64 `json:"expectedRevision"` }
 mux.HandleFunc("POST /v1/420bet/subscriptions/revoke",func(w http.ResponseWriter,r *http.Request){
  if !authenticated(w,r){return}
  var m revoke;if err:=decode(r,&m);err!=nil{write(w,400,map[string]string{"error":"invalid request"});return}
  v,err:=store.Revoke(m.Check,m.ExpectedRevision)
  if err!=nil{write(w,409,map[string]string{"error":fmt.Sprint(err)});return};write(w,200,v)
 })
 return mux,nil
}

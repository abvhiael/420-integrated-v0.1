// Package betdelivery exposes a durable authenticated pending-delivery boundary
// for 420Bet. It NEVER asserts downstream delivery without a real provider receipt.
package betdelivery

import (
 "crypto/sha256"
 "crypto/subtle"
 "encoding/hex"
 "encoding/json"
 "errors"
 "io"
 "net/http"
 "os"
 "path/filepath"
 "regexp"
 "sync"

 "github.com/420integrated/420-integrated/notifications/betconsent"
)
var ident=regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$`)
var digest=regexp.MustCompile(`^[a-f0-9]{64}$`)
type Event struct {
 Schema string `json:"schema"`
 Kind string `json:"kind"`
 Game string `json:"game"`
 ChainID string `json:"chainId"`
 BlockNumber string `json:"blockNumber"`
 EventID string `json:"eventId"`
 Finality string `json:"finality"`
}
type Delivery struct {
 Tenant string `json:"tenant"`
 UserID string `json:"userId"`
 SubscriptionID string `json:"subscriptionId"`
 Recipient string `json:"recipient"`
 PolicyVersion string `json:"policyVersion"`
 IdempotencyKey string `json:"idempotencyKey"`
 Event Event `json:"event"`
}
type receipt struct {
 DeliveryID string `json:"deliveryId"`
 IdempotencyKey string `json:"idempotencyKey"`
 Status string `json:"status"`
}
type entry struct {
 Request Delivery `json:"request"`
 Receipt receipt `json:"receipt"`
}
type snapshot struct {
 Schema int `json:"schema"`
 Items map[string]entry `json:"items"`
}
type Store struct {mu sync.Mutex;path,lock string;closed bool;state snapshot}
func Open(path string)(*Store,error){
 if !filepath.IsAbs(path){return nil,errors.New("absolute private delivery path required")}
 dir:=filepath.Dir(path)
 if e:=os.MkdirAll(dir,0700);e!=nil{return nil,e}
 info,e:=os.Stat(dir);if e!=nil{return nil,e}
 if info.Mode().Perm()&0022!=0{return nil,errors.New("unsafe delivery directory")}
 lock:=path+".lock"
 if e=os.Mkdir(lock,0700);e!=nil{return nil,e}
 good:=false
 defer func(){if !good{_ =os.Remove(lock)}}()
 s:=&Store{path:path,lock:lock,state:snapshot{Schema:1,Items:map[string]entry{}}}
 b,e:=os.ReadFile(path)
 if e==nil{
  fi,err:=os.Stat(path)
  if err!=nil{return nil,err}
  if !fi.Mode().IsRegular()||fi.Mode().Perm()&0077!=0||len(b)>5000000{return nil,errors.New("unsafe delivery state file")}
  if err=json.Unmarshal(b,&s.state);err!=nil{return nil,err}
  if s.state.Schema!=1||s.state.Items==nil{return nil,errors.New("invalid delivery schema")}
  for id,x:=range s.state.Items{
   if id!=x.Receipt.DeliveryID||!valid(x.Request)||x.Receipt.IdempotencyKey!=x.Request.IdempotencyKey||
    (x.Receipt.Status!="pending"&&x.Receipt.Status!="cancelled"){return nil,errors.New("invalid stored delivery")}
  }
 }else if !os.IsNotExist(e){return nil,e
 }else if e=s.persist(s.state);e!=nil{return nil,e}
 good=true
 return s,nil
}
func (s *Store)Close()error{s.mu.Lock();defer s.mu.Unlock()
 if s.closed{return nil};s.closed=true;return os.Remove(s.lock)}
func valid(d Delivery)bool{
 e:=d.Event
 return d.Tenant=="420bet"&&ident.MatchString(d.UserID)&&ident.MatchString(d.SubscriptionID)&&
 ident.MatchString(d.Recipient)&&ident.MatchString(d.PolicyVersion)&&digest.MatchString(d.IdempotencyKey)&&
 e.Schema=="420bet-notification-v1"&&ident.MatchString(e.Kind)&&ident.MatchString(e.Game)&&
 ident.MatchString(e.ChainID)&&ident.MatchString(e.BlockNumber)&&digest.MatchString(e.EventID)&&
 (e.Finality=="finalized"||e.Finality=="retracted")
}
func (s *Store)persist(next snapshot)error{
 b,e:=json.Marshal(next);if e!=nil{return e}
 dir:=filepath.Dir(s.path)
 f,e:=os.CreateTemp(dir,".delivery-*");if e!=nil{return e}
 tmp:=f.Name();defer os.Remove(tmp)
 if e=f.Chmod(0600);e!=nil{f.Close();return e}
 if _,e=f.Write(b);e!=nil{f.Close();return e}
 if e=f.Sync();e!=nil{f.Close();return e}
 if e=f.Close();e!=nil{return e}
 if e=os.Rename(tmp,s.path);e!=nil{return e}
 d,e:=os.Open(dir);if e!=nil{return e};defer d.Close()
 return d.Sync()
}
func (s *Store)Send(d Delivery,consent *betconsent.Store)(receipt,error){
 if !valid(d){return receipt{},errors.New("invalid delivery scope")}
 // A provider cannot create an opt-in or use one from another identity.
 c:=consent.Check(betconsent.Check{Tenant:d.Tenant,UserID:d.UserID,SubscriptionID:d.SubscriptionID,
  Recipient:d.Recipient,Channel:"notifications",PolicyVersion:d.PolicyVersion,Kind:d.Event.Kind})
 if !c.Active||c.Muted||c.Revoked||!c.Consent{return receipt{},errors.New("consent denied")}
 sum:=sha256.Sum256([]byte(d.Tenant+"|"+d.UserID+"|"+d.IdempotencyKey))
 id:="delivery-"+hex.EncodeToString(sum[:16])
 s.mu.Lock();defer s.mu.Unlock()
 if s.closed{return receipt{},errors.New("delivery store closed")}
 if prior,ok:=s.state.Items[id];ok{
  a,_:=json.Marshal(prior.Request);b,_:=json.Marshal(d)
  if string(a)!=string(b){return receipt{},errors.New("idempotency scope conflict")}
  return prior.Receipt,nil
 }
 if len(s.state.Items)>=10000{return receipt{},errors.New("delivery ledger full")}
 out:=receipt{DeliveryID:id,IdempotencyKey:d.IdempotencyKey,Status:"pending"}
 next:=snapshot{Schema:1,Items:make(map[string]entry,len(s.state.Items)+1)}
 for k,v:=range s.state.Items{next.Items[k]=v}
 next.Items[id]=entry{Request:d,Receipt:out}
 if e:=s.persist(next);e!=nil{return receipt{},e};s.state=next
 return out,nil
}
type lookup struct {Tenant string `json:"tenant"`;UserID string `json:"userId"`;
 DeliveryID string `json:"deliveryId"`;IdempotencyKey string `json:"idempotencyKey"`}
func(s *Store)Receipt(q lookup,cancel bool)(receipt,error){
 if q.Tenant!="420bet"||!ident.MatchString(q.UserID)||!ident.MatchString(q.DeliveryID)||
 !digest.MatchString(q.IdempotencyKey){return receipt{},errors.New("invalid receipt scope")}
 s.mu.Lock();defer s.mu.Unlock()
 if s.closed{return receipt{},errors.New("delivery store closed")}
 v,ok:=s.state.Items[q.DeliveryID]
 if !ok||v.Request.Tenant!=q.Tenant||v.Request.UserID!=q.UserID||
 v.Request.IdempotencyKey!=q.IdempotencyKey{return receipt{},errors.New("not found")}
 if cancel&&v.Receipt.Status=="pending"{
  next:=snapshot{Schema:1,Items:make(map[string]entry,len(s.state.Items))}
  for k,x:=range s.state.Items{next.Items[k]=x}
  v.Receipt.Status="cancelled";next.Items[q.DeliveryID]=v
  if e:=s.persist(next);e!=nil{return receipt{},e};s.state=next
 }
 return v.Receipt,nil
}
func body(r *http.Request,out any)error{
 if r.ContentLength>8192{return errors.New("oversized")}
 decoder:=json.NewDecoder(io.LimitReader(r.Body,8193));decoder.DisallowUnknownFields()
 if e:=decoder.Decode(out);e!=nil{return e}
 var more any;if decoder.Decode(&more)!=io.EOF{return errors.New("trailing data")}
 return nil
}
func Handler(store *Store,consent *betconsent.Store,token string)(http.Handler,error){
 if store==nil||consent==nil||len(token)<32||len(token)>4096{return nil,errors.New("approved delivery store, consent and token required")}
 mux:=http.NewServeMux()
 auth:=func(w http.ResponseWriter,r *http.Request)bool{
  if subtle.ConstantTimeCompare([]byte(r.Header.Get("Authorization")),[]byte("Bearer "+token))!=1{
   send(w,403,map[string]string{"error":"access denied"});return false
  };return true
 }
 mux.HandleFunc("POST /v1/420bet/deliveries/send",func(w http.ResponseWriter,r *http.Request){
  if !auth(w,r){return}
  var d Delivery;if e:=body(r,&d);e!=nil{send(w,400,map[string]string{"error":"invalid delivery"});return}
  receipt,e:=store.Send(d,consent)
  if e!=nil{send(w,409,map[string]string{"error":"delivery denied"});return}
  send(w,200,receipt)
 })
 for _,route:=range []string{"receipt","cancel"}{
  cancel:=route=="cancel"
  mux.HandleFunc("POST /v1/420bet/deliveries/"+route,func(w http.ResponseWriter,r *http.Request){
   if !auth(w,r){return}
   var q lookup;if e:=body(r,&q);e!=nil{send(w,400,map[string]string{"error":"invalid receipt"});return}
   current,e:=store.Receipt(q,cancel)
   if e!=nil{send(w,404,map[string]string{"error":"receipt unavailable"});return}
   send(w,200,map[string]any{"deliveryId":current.DeliveryID,
    "idempotencyKey":current.IdempotencyKey,"status":current.Status,
    "cancelled":current.Status=="cancelled"})
  })
 }
 return mux,nil
}
func send(w http.ResponseWriter,status int,payload any){
 w.Header().Set("Content-Type","application/json");w.Header().Set("Cache-Control","no-store")
 w.WriteHeader(status);_ =json.NewEncoder(w).Encode(payload)
}

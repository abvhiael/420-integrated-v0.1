package runtime

import (
 "context"
 "crypto/rand"
 "crypto/subtle"
 "encoding/hex"
 "encoding/json"
 "errors"
 "io"
 "net/http"
 "os"
 "path/filepath"
 "regexp"
 "strings"
 "sync"
)

// NativeDeliveryAPI is a private service-to-service API. It must never be
// advertised as a public subscriber or chain-authoritative endpoint.
type DeliveryPrincipal struct {
 ServiceID string
 Tenant string
}
type DeliveryAuthenticate func(context.Context, string) (DeliveryPrincipal, error)
type DeliveryDecision struct { Owner bool; Consent bool }
type DeliveryConsent func(context.Context, DeliveryPrincipal, DeliverySubmit) (DeliveryDecision, error)
// DeliveryProvenance must independently check the canonical Indexer receipt,
// Registry game version and finalized block hash, not trust a client flag.
type DeliveryProvenance func(context.Context, DeliverySubmit) (bool, error)

type DeliverySubmit struct {
 Tenant string `json:"tenant"`
 UserID string `json:"userId"`
 SubscriptionID string `json:"subscriptionId"`
 Recipient string `json:"recipient"`
 IdempotencyKey string `json:"idempotencyKey"`
 PolicyVersion string `json:"policyVersion"`
 Event DeliveryEvent `json:"event"`
}
type DeliveryEvent struct {
 Schema string `json:"schema"`
 Kind string `json:"kind"`
 Game string `json:"game"`
 ChainID string `json:"chainId"`
 BlockNumber string `json:"blockNumber"`
 EventID string `json:"eventId"`
 Finality string `json:"finality"`
}
type DeliveryReceipt struct {
 ID string `json:"deliveryId"`
 IdempotencyKey string `json:"idempotencyKey"`
 Status string `json:"status"`
 // The receipt never contains a recipient, subject, event, wallet, or balance.
 Version int `json:"version"`
}
type privateDeliveryRecord struct {
 Receipt DeliveryReceipt `json:"receipt"`
 Request DeliverySubmit `json:"request"`
}
type deliveryDisk struct {
 Schema int `json:"schema"`
 Records map[string]privateDeliveryRecord `json:"records"`
}
type DeliveryStore struct {
 mu sync.Mutex
 file string
 lockDir string
 data deliveryDisk
 closed bool
}
var deliveryToken = regexp.MustCompile(`^[a-zA-Z0-9._:-]{1,128}$`)
var deliveryHex = regexp.MustCompile(`^[0-9a-f]{64}$`)
var deliveryUint = regexp.MustCompile(`^(0|[1-9][0-9]*)$`)
var deliveryChain = regexp.MustCompile(`^[1-9][0-9]*$`)
var deliveryKind = map[string]bool{
 "wager-accepted":true,"wager-settled":true,"wager-voided":true,
 "poker-hand-settled":true,"poker-hand-cancelled":true,
 "fantasy-entry-accepted":true,"fantasy-pool-settled":true,
 "fantasy-pool-cancelled":true,"sports-ticket-funded":true,
 "sports-ticket-settled":true,"sports-ticket-finalized":true,
}
func validateDeliverySubmit(req DeliverySubmit) error {
 for _,s:=range []string{req.Tenant,req.UserID,req.SubscriptionID,req.Recipient,req.IdempotencyKey,req.PolicyVersion} {
  if !deliveryToken.MatchString(s){return errors.New("invalid scoped delivery field")}
 }
 if len(req.IdempotencyKey)!=64 || !deliveryHex.MatchString(req.IdempotencyKey) {
  return errors.New("invalid deterministic idempotency key")
 }
 e:=req.Event
 if e.Schema!="420bet-notification-v1" || !deliveryKind[e.Kind] ||
  !deliveryToken.MatchString(e.Game) || !deliveryChain.MatchString(e.ChainID) ||
  !deliveryUint.MatchString(e.BlockNumber) || !deliveryHex.MatchString(e.EventID) ||
  e.Finality!="finalized" {return errors.New("invalid finalized event envelope")}
 return nil
}
func fileWriteAtomic(name string,data deliveryDisk) error {
 b,err:=json.Marshal(data);if err!=nil{return err}
 tmp:=name+"."+randomDeliveryID()+".tmp"
 f,err:=os.OpenFile(tmp,os.O_WRONLY|os.O_CREATE|os.O_EXCL,0600)
 if err!=nil{return err}
 defer os.Remove(tmp)
 if _,err=f.Write(b);err!=nil{f.Close();return err}
 if err=f.Sync();err!=nil{f.Close();return err}
 if err=f.Close();err!=nil{return err}
 if err=os.Rename(tmp,name);err!=nil{return err}
 if err=os.Chmod(name,0600);err!=nil{return err}
 dir,err:=os.Open(filepath.Dir(name));if err!=nil{return err}
 defer dir.Close()
 return dir.Sync()
}
func randomDeliveryID() string {
 var b [16]byte
 if _,err:=rand.Read(b[:]);err!=nil{panic("OS CSPRNG unavailable")}
 return hex.EncodeToString(b[:])
}
func OpenDeliveryStore(path string)(*DeliveryStore,error){
 if !filepath.IsAbs(path){return nil,errors.New("absolute delivery store path required")}
 dir:=filepath.Dir(path)
 if err:=os.MkdirAll(dir,0700);err!=nil{return nil,err}
 fi,err:=os.Stat(dir);if err!=nil{return nil,err}
 if !fi.IsDir()||fi.Mode().Perm()&0022!=0 {return nil,errors.New("unsafe delivery storage directory")}
 lock:=path+".writer-lock"
 if err=os.Mkdir(lock,0700);err!=nil{return nil,err}
 store:=&DeliveryStore{file:path,lockDir:lock,data:deliveryDisk{Schema:1,Records:map[string]privateDeliveryRecord{}}}
 ok:=false;defer func(){if !ok{os.Remove(lock)}}()
 b,err:=os.ReadFile(path)
 if err==nil{
  fi,statErr:=os.Lstat(path)
  if statErr!=nil||!fi.Mode().IsRegular()||fi.Mode().Perm()&0077!=0{
   return nil,errors.New("unsafe delivery store file")
  }
  if len(b)>8<<20{return nil,errors.New("delivery store capacity exceeded")}
  if err=json.Unmarshal(b,&store.data);err!=nil{return nil,err}
  if store.data.Schema!=1||store.data.Records==nil{return nil,errors.New("unsupported delivery store format")}
  for key,rec:=range store.data.Records{
   if key!=rec.Receipt.IdempotencyKey||rec.Request.IdempotencyKey!=key||
    validateDeliverySubmit(rec.Request)!=nil||
    !deliveryToken.MatchString(rec.Receipt.ID)||
    (rec.Receipt.Status!="pending"&&rec.Receipt.Status!="delivered"&&rec.Receipt.Status!="cancelled"&&rec.Receipt.Status!="failed"){
    return nil,errors.New("corrupted delivery record")
   }
  }
 }else if !os.IsNotExist(err){return nil,err
 }else if err=fileWriteAtomic(path,store.data);err!=nil{return nil,err}
 ok=true;return store,nil
}
func (s *DeliveryStore) Close()error{
 s.mu.Lock();defer s.mu.Unlock()
 if s.closed{return nil}
 s.closed=true
 return os.Remove(s.lockDir)
}
func (s *DeliveryStore) save(next deliveryDisk) error {
 if err:=fileWriteAtomic(s.file,next);err!=nil{return err}
 s.data=next;return nil
}
func (s *DeliveryStore) Enqueue(req DeliverySubmit)(DeliveryReceipt,int,error){
 if err:=validateDeliverySubmit(req);err!=nil{return DeliveryReceipt{},0,err}
 s.mu.Lock();defer s.mu.Unlock()
 if s.closed{return DeliveryReceipt{},0,errors.New("store closed")}
 if prior,ok:=s.data.Records[req.IdempotencyKey];ok {
  if prior.Request!=req {return DeliveryReceipt{},0,errors.New("idempotency conflict")}
  return prior.Receipt,http.StatusOK,nil
 }
 if len(s.data.Records)>=10000{return DeliveryReceipt{},0,errors.New("delivery store at capacity")}
 r:=DeliveryReceipt{ID:randomDeliveryID(),IdempotencyKey:req.IdempotencyKey,Status:"pending",Version:1}
 next:=deliveryDisk{Schema:1,Records:make(map[string]privateDeliveryRecord,len(s.data.Records)+1)}
 for k,v:=range s.data.Records{next.Records[k]=v}
 next.Records[req.IdempotencyKey]=privateDeliveryRecord{Receipt:r,Request:req}
 if err:=s.save(next);err!=nil{return DeliveryReceipt{},0,err}
 return r,http.StatusCreated,nil
}
func (s *DeliveryStore) Find(id string)(privateDeliveryRecord,bool){
 s.mu.Lock();defer s.mu.Unlock()
 if s.closed{return privateDeliveryRecord{},false}
 for _,v:=range s.data.Records{if v.Receipt.ID==id{return v,true}}
 return privateDeliveryRecord{},false
}
func (s *DeliveryStore) SetStatus(id,status string)(DeliveryReceipt,error){
 if status!="cancelled"&&status!="delivered"&&status!="failed"{
  return DeliveryReceipt{},errors.New("invalid delivery transition")
 }
 s.mu.Lock();defer s.mu.Unlock()
 if s.closed{return DeliveryReceipt{},errors.New("store closed")}
 for key,rec:=range s.data.Records{
  if rec.Receipt.ID!=id{continue}
  if rec.Receipt.Status==status{return rec.Receipt,nil}
  if rec.Receipt.Status!="pending"{return DeliveryReceipt{},errors.New("terminal delivery cannot transition")}
  next:=deliveryDisk{Schema:1,Records:make(map[string]privateDeliveryRecord,len(s.data.Records))}
  for k,v:=range s.data.Records{next.Records[k]=v}
  rec.Receipt.Status=status;rec.Receipt.Version++;next.Records[key]=rec
  if err:=s.save(next);err!=nil{return DeliveryReceipt{},err}
  return rec.Receipt,nil
 }
 return DeliveryReceipt{},errors.New("delivery not found")
}

// A qualified provider worker may report actual delivery or failure, but
// a public API request cannot set a receipt to DELIVERED.
func (s *DeliveryStore) MarkDelivered(id string)(DeliveryReceipt,error){return s.SetStatus(id,"delivered")}
func (s *DeliveryStore) MarkFailed(id string)(DeliveryReceipt,error){return s.SetStatus(id,"failed")}

type DeliveryAPI struct{
 store *DeliveryStore
 authenticate DeliveryAuthenticate
 consent DeliveryConsent
 provenance DeliveryProvenance
}
func NewDeliveryAPI(store *DeliveryStore,authenticate DeliveryAuthenticate,consent DeliveryConsent,provenance DeliveryProvenance)(*DeliveryAPI,error){
 if store==nil||authenticate==nil||consent==nil||provenance==nil{return nil,errors.New("authenticated delivery store, private consent and canonical provenance authorities required")}
 return &DeliveryAPI{store:store,authenticate:authenticate,consent:consent,provenance:provenance},nil
}
// Constant-time bearer authentication helper for a single trusted service
// identity. Production callers still need a real scoped consent authority.
func BearerServiceAuthenticator(secret string,principal DeliveryPrincipal)(DeliveryAuthenticate,error){
 if len(secret)<32||len(secret)>4096||!deliveryToken.MatchString(principal.ServiceID)||
  !deliveryToken.MatchString(principal.Tenant){return nil,errors.New("invalid service authorization configuration")}
 return func(_ context.Context,credential string)(DeliveryPrincipal,error){
  expected:="Bearer "+secret
  if len(credential)!=len(expected)||subtle.ConstantTimeCompare([]byte(credential),[]byte(expected))!=1{
   return DeliveryPrincipal{},errors.New("service authentication rejected")
  }
  return principal,nil
 },nil
}
func apiReply(w http.ResponseWriter,status int,value any){
 w.Header().Set("Content-Type","application/json; charset=utf-8")
 w.Header().Set("Cache-Control","no-store")
 w.Header().Set("X-Content-Type-Options","nosniff")
 w.WriteHeader(status);_ =json.NewEncoder(w).Encode(value)
}
func (a *DeliveryAPI) ServeHTTP(w http.ResponseWriter,r *http.Request){
 p,err:=a.authenticate(r.Context(),r.Header.Get("Authorization"))
 if err!=nil||!deliveryToken.MatchString(p.ServiceID)||!deliveryToken.MatchString(p.Tenant){
  apiReply(w,http.StatusUnauthorized,map[string]string{"error":"unauthorized"});return
 }
 if r.URL.RawQuery!=""||r.Header.Get("Cookie")!=""{
  apiReply(w,http.StatusBadRequest,map[string]string{"error":"unsupported_request"});return
 }
 if r.URL.Path=="/v1/deliveries"{
  if r.Method!="POST"{apiReply(w,405,map[string]string{"error":"method_not_allowed"});return}
  if !strings.HasPrefix(r.Header.Get("Content-Type"),"application/json"){
   apiReply(w,415,map[string]string{"error":"content_type_required"});return
  }
  dec:=json.NewDecoder(http.MaxBytesReader(w,r.Body,4096));dec.DisallowUnknownFields()
  var req DeliverySubmit
  if err:=dec.Decode(&req);err!=nil{apiReply(w,400,map[string]string{"error":"invalid_json"});return}
  var extra any
  if err=dec.Decode(&extra);err!=io.EOF{apiReply(w,400,map[string]string{"error":"trailing_json"});return}
  if req.Tenant!=p.Tenant||validateDeliverySubmit(req)!=nil{
   apiReply(w,403,map[string]string{"error":"scope_denied"});return
  }
  decision,e:=a.consent(r.Context(),p,req)
  if e!=nil||!decision.Owner||!decision.Consent{apiReply(w,403,map[string]string{"error":"consent_denied"});return}
  canonical,verifyErr:=a.provenance(r.Context(),req)
  if verifyErr!=nil||!canonical{apiReply(w,403,map[string]string{"error":"provenance_denied"});return}
  receipt,code,e:=a.store.Enqueue(req)
  if e!=nil{
   if e.Error()=="idempotency conflict"{apiReply(w,409,map[string]string{"error":"idempotency_conflict"})
   }else{apiReply(w,503,map[string]string{"error":"delivery_unavailable"})}
   return
  }
  apiReply(w,code,receipt);return
 }
 prefix:="/v1/deliveries/"
 if !strings.HasPrefix(r.URL.Path,prefix){
  apiReply(w,404,map[string]string{"error":"not_found"});return
 }
 path:=strings.TrimPrefix(r.URL.Path,prefix)
 cancelling:=strings.HasSuffix(path,"/cancel")
 if cancelling{path=strings.TrimSuffix(path,"/cancel")}
 if !deliveryToken.MatchString(path)||strings.Contains(path,"/"){
  apiReply(w,404,map[string]string{"error":"not_found"});return
 }
 if (cancelling&&r.Method!="POST")||(!cancelling&&r.Method!="GET"){
  apiReply(w,405,map[string]string{"error":"method_not_allowed"});return
 }
 rec,ok:=a.store.Find(path)
 if !ok||rec.Request.Tenant!=p.Tenant{
  apiReply(w,404,map[string]string{"error":"not_found"});return
 }
 decision,e:=a.consent(r.Context(),p,rec.Request)
 if e!=nil||!decision.Owner {
  apiReply(w,403,map[string]string{"error":"scope_denied"});return
 }
 // Consent may be revoked, but the verified owner must still be able
 // to see and cancel the previous delivery receipt.
 if cancelling{
  receipt,e:=a.store.SetStatus(path,"cancelled")
  if e!=nil{apiReply(w,409,map[string]string{"error":"delivery_terminal"});return}
  apiReply(w,200,receipt);return
 }
 apiReply(w,200,rec.Receipt)
}

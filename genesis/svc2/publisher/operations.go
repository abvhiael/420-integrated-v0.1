package publisher

import (
 "context"
 "crypto/hmac"
 "crypto/sha256"
 "encoding/hex"
 "encoding/json"
 "errors"
 "fmt"
 "os"
 "path/filepath"
 "strings"
 "sync"
)

// Operation records the intended exact canonical post-image BEFORE mutation.
// 'applied' is only emitted after the canonical post-image was read back and
// compared. A decision alone is never a completed operation.
type Operation struct {
 ID string
 CandidateID string
 Kind Kind
 Action Action
 CandidateSHA256 string
 ExpectedVersion uint32
 PostImageSHA256 string
 State string // pending, applied; never publish from pending
}

type operationFile struct { Schema string; Operations []Operation; MAC string }
const operationSchema="420-svc2-private-canonical-operations-v1"
var ErrPendingOperation=errors.New("canonical operation needs explicit reconciliation")

// OperationLog is private, single-process, single-writer intent storage. This
// is NOT a distributed transaction or a source of public publication evidence.
type OperationLog struct {mu sync.Mutex;path string;key []byte;operations []Operation}
func operationMAC(key []byte,ops []Operation)(string,error){
 bytes,err:=json.Marshal(struct{Schema string;Operations []Operation}{operationSchema,ops});if err!=nil{return "",err}
 mac:=hmac.New(sha256.New,key);_,_=mac.Write(bytes);return hex.EncodeToString(mac.Sum(nil)),nil
}
func OpenOperationLog(path string,key []byte)(*OperationLog,error){
 if strings.TrimSpace(path)==""||len(key)<32{return nil,ErrInvalid}
 info,err:=os.Lstat(path)
 if err!=nil&&!errors.Is(err,os.ErrNotExist){return nil,err}
 o:=&OperationLog{path:path,key:append([]byte(nil),key...)}
 if errors.Is(err,os.ErrNotExist){return o,nil}
 if !info.Mode().IsRegular()||info.Mode().Perm()&0077!=0{return nil,errors.New("unsafe operation journal")}
 data,err:=os.ReadFile(path);if err!=nil{return nil,err}
 var f operationFile;if err:=json.Unmarshal(data,&f);err!=nil{return nil,err}
 if f.Schema!=operationSchema{return nil,ErrInvalid}
 expected,err:=operationMAC(key,f.Operations);if err!=nil{return nil,err}
 if !hmac.Equal([]byte(expected),[]byte(f.MAC)){return nil,errors.New("operation journal integrity failure")}
 seen:=map[string]bool{}
 for _,op:=range f.Operations{
  if err:=op.Validate();err!=nil{return nil,err}
  if seen[op.ID]{return nil,errors.New("duplicate canonical operation")};seen[op.ID]=true
 }
 o.operations=f.Operations;return o,nil
}
func (op Operation)Validate()error{
 if op.ID==""||op.CandidateID==""||(op.Kind!=Place&&op.Kind!=Event)||(op.Action!=Approve&&op.Action!=Withdraw)||!validDigest(op.CandidateSHA256)||!validDigest(op.PostImageSHA256)||(op.State!="pending"&&op.State!="applied")||op.ExpectedVersion==0{return ErrInvalid}
 return nil
}
func(o *OperationLog)persist(next []Operation)error{
 mac,err:=operationMAC(o.key,next);if err!=nil{return err}
 payload,err:=json.Marshal(operationFile{Schema:operationSchema,Operations:next,MAC:mac});if err!=nil{return err}
 dir:=filepath.Dir(o.path);if err=os.MkdirAll(dir,0700);err!=nil{return err}
 f,err:=os.CreateTemp(dir,".canonical-operation-*.tmp");if err!=nil{return err}
 name:=f.Name();defer os.Remove(name)
 if err=f.Chmod(0600);err!=nil{f.Close();return err}
 if _,err=f.Write(payload);err!=nil{f.Close();return err}
 if err=f.Sync();err!=nil{f.Close();return err}
 if err=f.Close();err!=nil{return err}
 if err=os.Rename(name,o.path);err!=nil{return err}
 parent,err:=os.Open(dir);if err!=nil{return err};defer parent.Close()
 if err=parent.Sync();err!=nil{return err}
 o.operations=next;return nil
}
func(o *OperationLog)Begin(op Operation)error{
 if o==nil{return ErrInvalid}
 op.State="pending";if err:=op.Validate();err!=nil{return err}
 o.mu.Lock();defer o.mu.Unlock()
 for _,old:=range o.operations{if old.ID==op.ID{return ErrConflict};if old.CandidateID==op.CandidateID&&old.State=="pending"{return ErrPendingOperation}}
 next:=append(append([]Operation(nil),o.operations...),op)
 return o.persist(next)
}
func(o *OperationLog)Find(id string)(Operation,bool){if o==nil{return Operation{},false};o.mu.Lock();defer o.mu.Unlock();for _,op:=range o.operations{if op.ID==id{return op,true}};return Operation{},false}

// CanonicalProbe must read the ACTUAL canonical repository, never a caller's
// prepared payload, the approval ledger or a public discovery cache.
type CanonicalProbe func(context.Context)(version uint32,postImageSHA256 string,err error)

// Reconcile is the only transition to applied. A pending operation whose
// canonical version remains at the precondition is left pending for an explicit
// authorized retry. Conflicting versions/digests are never auto-overwritten.
func(o *OperationLog)Reconcile(ctx context.Context,id string,probe CanonicalProbe)(Operation,error){
 if o==nil||probe==nil{return Operation{},ErrInvalid}
 o.mu.Lock();defer o.mu.Unlock()
 index:=-1
 for i,op:=range o.operations{if op.ID==id{index=i;break}}
 if index<0{return Operation{},ErrNotFound}
 op:=o.operations[index]
 version,digest,err:=probe(ctx);if err!=nil{return Operation{},err}
 if version==op.ExpectedVersion{return op,ErrPendingOperation}
 if version!=op.ExpectedVersion+1||digest!=op.PostImageSHA256{return Operation{},fmt.Errorf("%w: canonical version or post-image mismatch",ErrConflict)}
 if op.State=="applied"{return op,nil}
 op.State="applied";next:=append([]Operation(nil),o.operations...);next[index]=op
 if err=o.persist(next);err!=nil{return Operation{},err}
 return op,nil
}

func(o *OperationLog)AllApplied()error{
 if o==nil{return ErrInvalid};o.mu.Lock();defer o.mu.Unlock()
 if len(o.operations)==0{return ErrPendingOperation}
 for _,op:=range o.operations{if op.State!="applied"{return ErrPendingOperation}}
 return nil
}

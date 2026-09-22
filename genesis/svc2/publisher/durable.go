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
 "time"
)

// AuditEntry stores the entire post-operation candidate state. A keyed chain
// detects modification/reordering of stored entries by readers without the key.
// Truncation by an attacker with filesystem access requires an EXTERNAL trusted
// checkpoint (sequence + head MAC). Local files alone cannot detect truncation.
type AuditEntry struct {
 Sequence uint64
 PreviousMAC string
 Operation string
 Record Record
 At time.Time
 MAC string
}

type journalFile struct { Schema string; Entries []AuditEntry }
const journalSchema = "420-svc2-private-decision-journal-v1"

// DurableLedger is single-writer private staging storage. It never edits a
// canonical repository and is not publication approval or a public API.
type DurableLedger struct {
 mu sync.Mutex
 path string
 key []byte
 ledger *Ledger
 entries []AuditEntry
}

func entryMAC(key []byte, e AuditEntry) (string,error) {
 e.MAC=""
 data,err:=json.Marshal(e);if err!=nil{return "",err}
 mac:=hmac.New(sha256.New,key);_,_=mac.Write(data)
 return hex.EncodeToString(mac.Sum(nil)),nil
}

func OpenDurableLedger(path string,key []byte,a Authorizer,s SourceVerifier,clock func()time.Time)(*DurableLedger,error){
 if strings.TrimSpace(path)==""||len(key)<32{return nil,errors.New("journal path and independent >=32-byte audit key required")}
 if a==nil||s==nil||clock==nil{return nil,errors.New("trusted authorizer, source verifier and clock required")}
 if err:=os.MkdirAll(filepath.Dir(path),0700);err!=nil{return nil,err}
 l,err:=NewLedger(a,s,clock);if err!=nil{return nil,err}
 d:=&DurableLedger{path:path,key:append([]byte(nil),key...),ledger:l}
 data,err:=os.ReadFile(path)
 if errors.Is(err,os.ErrNotExist){return d,nil}
 if err!=nil{return nil,err}
 info,err:=os.Lstat(path);if err!=nil{return nil,err}
 if !info.Mode().IsRegular()||info.Mode().Perm()&0022!=0{return nil,errors.New("unsafe journal permissions or file type")}
 var file journalFile
 if err:=json.Unmarshal(data,&file);err!=nil{return nil,fmt.Errorf("journal decoding failed: %w",err)}
 if file.Schema!=journalSchema{return nil,errors.New("unknown journal schema")}
 prev:=""
 for i,e:=range file.Entries {
  if e.Sequence!=uint64(i+1)||e.PreviousMAC!=prev||e.At.IsZero()||e.Operation!="import"&&e.Operation!="approve"&&e.Operation!="withdraw"&&e.Operation!="reject"{return nil,errors.New("invalid journal sequence")}
  expected,err:=entryMAC(d.key,e);if err!=nil{return nil,err}
  if !hmac.Equal([]byte(expected),[]byte(e.MAC)){return nil,errors.New("journal MAC mismatch")}
  if err:=e.Record.Candidate.Validate();err!=nil{return nil,err}
  if e.Operation=="import"&&e.Record.State!=Pending || e.Operation=="approve"&&e.Record.State!=Approved || e.Operation=="withdraw"&&e.Record.State!=Withdrawn || e.Operation=="reject"&&e.Record.State!=Rejected{return nil,errors.New("journal state mismatch")}
  l.records[e.Record.Candidate.ID]=e.Record
  if e.Operation!="import"{l.history=append(l.history,e.Record.LastDecision)}
  prev=e.MAC
 }
 d.entries=file.Entries
 return d,nil
}

func (d *DurableLedger) save(operation string,r Record)error{
 previous:="";if len(d.entries)>0{previous=d.entries[len(d.entries)-1].MAC}
 e:=AuditEntry{Sequence:uint64(len(d.entries)+1),PreviousMAC:previous,Operation:operation,Record:r,At:d.ledger.now().UTC()}
 if e.At.IsZero(){return ErrInvalid}
 var err error;e.MAC,err=entryMAC(d.key,e);if err!=nil{return err}
 next:=append(append([]AuditEntry(nil),d.entries...),e)
 payload,err:=json.Marshal(journalFile{Schema:journalSchema,Entries:next});if err!=nil{return err}
 dir:=filepath.Dir(d.path)
 f,err:=os.CreateTemp(dir,".publisher-journal-*.tmp");if err!=nil{return err}
 name:=f.Name();defer os.Remove(name)
 if err=f.Chmod(0600);err!=nil{f.Close();return err}
 if _,err=f.Write(payload);err!=nil{f.Close();return err}
 if err=f.Sync();err!=nil{f.Close();return err}
 if err=f.Close();err!=nil{return err}
 if err=os.Rename(name,d.path);err!=nil{return err}
 // Fail closed if directory durability cannot be confirmed.
 parent,err:=os.Open(dir);if err!=nil{return err};defer parent.Close()
 if err=parent.Sync();err!=nil{return err}
 d.entries=next
 return nil
}

// Every mutation is performed on a private copy and becomes visible only after
// successful durable write. Use one process/volume writer; no distributed lock.
func(d *DurableLedger) mutate(ctx context.Context,operation string,c Candidate,decision Decision)(Record,error){
 if d==nil||d.ledger==nil{return Record{},ErrUnauthorized}
 d.mu.Lock();defer d.mu.Unlock()
 original:=d.ledger
 original.mu.Lock()
 clone:=&Ledger{authorizer:original.authorizer,sources:original.sources,now:original.now,records:make(map[string]Record,len(original.records)),history:append([]Decision(nil),original.history...)}
 for k,v:=range original.records{clone.records[k]=v}
 original.mu.Unlock()
 var r Record;var err error
 if operation=="import"{err=clone.ImportCandidate(ctx,c);r,_=clone.Get(c.ID)}else{r,err=clone.Decide(ctx,decision)}
 if err!=nil{return Record{},err}
 // No-op imports must not append duplicate journal entries.
 old,exists:=original.Get(r.Candidate.ID)
 if operation=="import"&&exists&&old==r{return r,nil}
 if err=d.save(operation,r);err!=nil{return Record{},err}
 d.ledger=clone
 return r,nil
}
func(d *DurableLedger)ImportCandidate(ctx context.Context,c Candidate)error{_,err:=d.mutate(ctx,"import",c,Decision{});return err}
func(d *DurableLedger)Decide(ctx context.Context,decision Decision)(Record,error){return d.mutate(ctx,string(decision.Action),Candidate{},decision)}
func(d *DurableLedger)Get(id string)(Record,bool){if d==nil{return Record{},false};d.mu.Lock();defer d.mu.Unlock();return d.ledger.Get(id)}
func(d *DurableLedger)History()[]Decision{if d==nil{return nil};d.mu.Lock();defer d.mu.Unlock();return d.ledger.History()}
func(d *DurableLedger)AuditHead()(uint64,string){if d==nil{return 0,""};d.mu.Lock();defer d.mu.Unlock();if len(d.entries)==0{return 0,""};e:=d.entries[len(d.entries)-1];return e.Sequence,e.MAC}

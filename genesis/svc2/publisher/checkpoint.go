package publisher

import (
 "context"
 "crypto/hmac"
 "errors"
 "fmt"
 "sync"
 "time"
)

// AuditCheckpoint is an independent, monotonic, access-controlled store. It MUST
// reside outside the journal's failure and administrative domain. It is not a
// second file in the same volume. An implementation must reject stale writes
// atomically; read and CAS must be linearizable. Never accept a checkpoint from
// a candidate, request, journal or public HTTP endpoint.
type AuditCheckpoint interface {
 Read(context.Context) (AuditPosition, error)
 CompareAndSwap(context.Context, AuditPosition, AuditPosition) error
}

type AuditPosition struct { Sequence uint64; MAC string }

var ErrAuditDiverged = errors.New("journal and independent checkpoint diverged")

// GuardedLedger is the only staging ledger permitted by the eventual operator
// workflow. The existing DurableLedger is retained for isolated tests and
// migration, and MUST NOT be passed to public-feed or publisher promotion code.
// A crash between journal fsync and checkpoint CAS intentionally causes the
// next open to fail closed until an independently reviewed recovery reconciles
// the two durable systems. Automatic checkpoint advancement would accept a
// deleted or forged journal suffix and is forbidden.
type GuardedLedger struct {
 mu sync.Mutex
 journal *DurableLedger
 checkpoint AuditCheckpoint
 last AuditPosition
 poisoned bool
}

func samePosition(a,b AuditPosition) bool {
 return a.Sequence==b.Sequence && hmac.Equal([]byte(a.MAC), []byte(b.MAC))
}

func OpenGuardedLedger(ctx context.Context,path string,key []byte,a Authorizer,s SourceVerifier,clock func()time.Time,store AuditCheckpoint)(*GuardedLedger,error){
 if store==nil {return nil,errors.New("independent audit checkpoint is required")}
 // Read checkpoint BEFORE opening a missing journal: an existing checkpoint
 // must never be reset by a newly initialized empty journal.
 expected,err:=store.Read(ctx);if err!=nil{return nil,fmt.Errorf("read independent checkpoint: %w",err)}
 d,err:=OpenDurableLedger(path,key,a,s,clock);if err!=nil{return nil,err}
 seq,mac:=d.AuditHead();actual:=AuditPosition{Sequence:seq,MAC:mac}
 if !samePosition(actual,expected){return nil,ErrAuditDiverged}
 return &GuardedLedger{journal:d,checkpoint:store,last:expected},nil
}

func (g *GuardedLedger) check(ctx context.Context) error {
 if g==nil||g.poisoned||g.journal==nil||g.checkpoint==nil{return ErrAuditDiverged}
 remote,err:=g.checkpoint.Read(ctx);if err!=nil{return err}
 seq,mac:=g.journal.AuditHead()
 if !samePosition(remote,g.last)||!samePosition(remote,AuditPosition{Sequence:seq,MAC:mac}){g.poisoned=true;return ErrAuditDiverged}
 return nil
}

func (g *GuardedLedger) advance(ctx context.Context) error {
 seq,mac:=g.journal.AuditHead();next:=AuditPosition{Sequence:seq,MAC:mac}
 if samePosition(next,g.last){return nil}
 if err:=g.checkpoint.CompareAndSwap(ctx,g.last,next);err!=nil{g.poisoned=true;return fmt.Errorf("checkpoint advance failed; manual recovery required: %w",err)}
 g.last=next
 return nil
}

func (g *GuardedLedger) ImportCandidate(ctx context.Context,c Candidate) error {
 if g==nil{return ErrAuditDiverged};g.mu.Lock();defer g.mu.Unlock()
 if err:=g.check(ctx);err!=nil{return err}
 if err:=g.journal.ImportCandidate(ctx,c);err!=nil{return err}
 return g.advance(ctx)
}
func (g *GuardedLedger) Decide(ctx context.Context,d Decision)(Record,error){
 if g==nil{return Record{},ErrAuditDiverged};g.mu.Lock();defer g.mu.Unlock()
 if err:=g.check(ctx);err!=nil{return Record{},err}
 r,err:=g.journal.Decide(ctx,d);if err!=nil{return Record{},err}
 if err:=g.advance(ctx);err!=nil{return Record{},err}
 return r,nil
}
func (g *GuardedLedger) Get(ctx context.Context,id string)(Record,bool,error){
 if g==nil{return Record{},false,ErrAuditDiverged};g.mu.Lock();defer g.mu.Unlock()
 if err:=g.check(ctx);err!=nil{return Record{},false,err}
 r,ok:=g.journal.Get(id);return r,ok,nil
}
func (g *GuardedLedger) AuditHead(ctx context.Context)(AuditPosition,error){
 if g==nil{return AuditPosition{},ErrAuditDiverged};g.mu.Lock();defer g.mu.Unlock()
 if err:=g.check(ctx);err!=nil{return AuditPosition{},err}
 return g.last,nil
}

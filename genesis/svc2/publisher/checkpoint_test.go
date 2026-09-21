package publisher

import (
 "context"
 "errors"
 "os"
 "path/filepath"
 "strings"
 "sync"
 "testing"
)

// Test-only independent store; production MUST provide a separately administered
// durable linearizable store. This fake deliberately cannot qualify deployment.
type checkpointFake struct {mu sync.Mutex;position AuditPosition;fail bool}
func (s *checkpointFake) Read(context.Context)(AuditPosition,error){s.mu.Lock();defer s.mu.Unlock();if s.fail{return AuditPosition{},errors.New("checkpoint offline")};return s.position,nil}
func (s *checkpointFake) CompareAndSwap(_ context.Context,previous,next AuditPosition)error{s.mu.Lock();defer s.mu.Unlock();if s.fail{return errors.New("checkpoint offline")};if !samePosition(previous,s.position)||next.Sequence!=previous.Sequence+1||next.MAC==""{return ErrAuditDiverged};s.position=next;return nil}

func TestGuardedLedgerDetectsDeletedSuffixAndCheckpointOutage(t *testing.T){
 ctx:=context.Background();p:=trustedPolicy();store:=&checkpointFake{};path:=filepath.Join(t.TempDir(),"audit.json");key:=[]byte(strings.Repeat("s",32))
 g,err:=OpenGuardedLedger(ctx,path,key,p,p,p.Clock,store);if err!=nil{t.Fatal(err)}
 c:=candidate();if err=g.ImportCandidate(ctx,c);err!=nil{t.Fatal(err)}
 first,err:=os.ReadFile(path);if err!=nil{t.Fatal(err)}
 if _,err=g.Decide(ctx,decision(c,Approve,0));err!=nil{t.Fatal(err)}
 if _,err=OpenGuardedLedger(ctx,path,key,p,p,p.Clock,store);err!=nil{t.Fatalf("valid reopen: %v",err)}
 // Valid, correctly MACed journal suffix deletion must be rejected.
 if err=os.WriteFile(path,first,0600);err!=nil{t.Fatal(err)}
 if _,err=OpenGuardedLedger(ctx,path,key,p,p,p.Clock,store);!errors.Is(err,ErrAuditDiverged){t.Fatalf("truncation accepted: %v",err)}
 if _,_,err=g.Get(ctx,c.ID);!errors.Is(err,ErrAuditDiverged){t.Fatalf("mismatch accepted: %v",err)}
}
func TestGuardedLedgerRequiresIndependentCheckpointAndPoisonsOnCASFailure(t *testing.T){
 ctx:=context.Background();p:=trustedPolicy();path:=filepath.Join(t.TempDir(),"audit.json");key:=[]byte(strings.Repeat("s",32))
 if _,err:=OpenGuardedLedger(ctx,path,key,p,p,p.Clock,nil);err==nil{t.Fatal("missing checkpoint accepted")}
 s:=&checkpointFake{};g,err:=OpenGuardedLedger(ctx,path,key,p,p,p.Clock,s);if err!=nil{t.Fatal(err)}
 s.fail=true
 if err=g.ImportCandidate(ctx,candidate());err==nil{t.Fatal("unavailable checkpoint accepted")}
 s.fail=false
 // Commit-to-journal then failed external CAS is never silently repaired.
 s2:=&checkpointFake{};g,err=OpenGuardedLedger(ctx,path,key,p,p,p.Clock,s2);if err!=nil{t.Fatal(err)}
 // A mismatch introduced by a competing checkpoint writer is fatal.
 s2.position=AuditPosition{Sequence:1,MAC:"different"}
 if err=g.ImportCandidate(ctx,candidate());!errors.Is(err,ErrAuditDiverged){t.Fatalf("competing writer accepted: %v",err)}
}

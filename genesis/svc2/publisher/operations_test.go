package publisher

import (
 "context"
 "errors"
 "os"
 "path/filepath"
 "strings"
 "testing"
)

func TestOperationJournalCrashRecoveryRequiresCanonicalReadback(t *testing.T){
 ctx:=context.Background();path:=filepath.Join(t.TempDir(),"operations.json");key:=[]byte(strings.Repeat("z",32))
 o,err:=OpenOperationLog(path,key);if err!=nil{t.Fatal(err)}
 c:=candidate();op:=Operation{ID:"op-1",CandidateID:c.ID,Kind:Place,Action:Approve,CandidateSHA256:c.NormalizedSHA256,ExpectedVersion:1,PostImageSHA256:digest("published")}
 if err=o.Begin(op);err!=nil{t.Fatal(err)}
 if err=o.AllApplied();!errors.Is(err,ErrPendingOperation){t.Fatalf("pending treated as published: %v",err)}
 afterRestart,err:=OpenOperationLog(path,key);if err!=nil{t.Fatal(err)}
 probe:=func(version uint32,hash string)CanonicalProbe{return func(context.Context)(uint32,string,error){return version,hash,nil}}
 if _,err=afterRestart.Reconcile(ctx,op.ID,probe(1,""));!errors.Is(err,ErrPendingOperation){t.Fatalf("unapplied intent completed: %v",err)}
 if _,err=afterRestart.Reconcile(ctx,op.ID,probe(2,digest("wrong")));!errors.Is(err,ErrConflict){t.Fatalf("wrong postimage completed: %v",err)}
 if _,err=afterRestart.Reconcile(ctx,op.ID,probe(3,op.PostImageSHA256));!errors.Is(err,ErrConflict){t.Fatalf("wrong version completed: %v",err)}
 got,err:=afterRestart.Reconcile(ctx,op.ID,probe(2,op.PostImageSHA256));if err!=nil||got.State!="applied"{t.Fatalf("readback failed: %v",err)}
 if err=afterRestart.AllApplied();err!=nil{t.Fatal(err)}
 reopened,err:=OpenOperationLog(path,key);if err!=nil{t.Fatal(err)}
 got,ok:=reopened.Find(op.ID);if !ok||got.State!="applied"{t.Fatal("applied record lost on restart")}
 if err=reopened.Begin(op);!errors.Is(err,ErrConflict){t.Fatalf("replay accepted: %v",err)}
 bytes,err:=os.ReadFile(path);if err!=nil{t.Fatal(err)}
 if err=os.WriteFile(path,[]byte(strings.Replace(string(bytes),"applied","pending",1)),0600);err!=nil{t.Fatal(err)}
 if _,err=OpenOperationLog(path,key);err==nil{t.Fatal("tampered operation log accepted")}
}
func TestOperationLogCannotRunUnconfigured(t *testing.T){
 if _,err:=OpenOperationLog("",[]byte(strings.Repeat("x",32)));err==nil{t.Fatal("missing path accepted")}
 if _,err:=OpenOperationLog(filepath.Join(t.TempDir(),"audit"),[]byte("weak"));err==nil{t.Fatal("weak MAC key accepted")}
}

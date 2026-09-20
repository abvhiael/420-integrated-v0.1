package bundle

import (
 "context"
 "errors"
 "testing"
 "time"

 "github.com/420integrated/420-integrated/bundler/simulation"
 "github.com/420integrated/420-integrated/bundler/userop"
 "github.com/420integrated/420-integrated/bundler/mempool"
)

type cancelDuringValidation struct {cancel context.CancelFunc}
func (v cancelDuringValidation) ValidateAndSimulate(ctx context.Context,op userop.PackedUserOperation,now time.Time)(simulation.Evidence,error){
 v.cancel()
 // Simulate an untrusted execution dependency that ignores cancellation and
 // nevertheless reports success. The builder must refuse the subsequent send.
 return fakeValidator{invalid:map[string]bool{}}.ValidateAndSimulate(context.Background(),op,now)
}

type cancelDuringIntent struct {fakeRecorder; cancel context.CancelFunc}
func (r *cancelDuringIntent) BeginSubmission(hash,point string,at time.Time)error{
 if err:=r.fakeRecorder.BeginSubmission(hash,point,at);err!=nil{return err}
 r.cancel()
 return nil
}

func cancelledCandidate(t *testing.T,now time.Time)(*fakePool,*fakeSubmitter){
 t.Helper()
 operation:=op("0x2222222222222222222222222222222222222222","0x1")
 pool:=&fakePool{items:[]mempool.Entry{entry(t,operation,now)}}
 return pool,&fakeSubmitter{fails:map[string]bool{}}
}

func TestCancelledBeforeSelectionNeverSends(t *testing.T){
 now:=time.Date(2026,9,19,12,0,0,0,time.UTC)
 pool,sub:=cancelledCandidate(t,now)
 builder,err:=New(Config{EntryPoint:"0x1111111111111111111111111111111111111111",MaxOperations:1},pool,fakeValidator{},sub)
 if err!=nil{t.Fatal(err)}
 ctx,cancel:=context.WithCancel(context.Background());cancel()
 _,err=builder.SubmitNext(ctx,now)
 if !errors.Is(err,context.Canceled){t.Fatalf("expected context cancellation, got %v",err)}
 if len(sub.order)!=0||len(pool.removed)!=0{t.Fatal("canceled operation was sent or removed")}
}

func TestUntrustedValidatorIgnoringCancellationCannotSend(t *testing.T){
 now:=time.Date(2026,9,19,12,0,0,0,time.UTC)
 pool,sub:=cancelledCandidate(t,now)
 ctx,cancel:=context.WithCancel(context.Background());defer cancel()
 builder,err:=New(Config{EntryPoint:"0x1111111111111111111111111111111111111111",MaxOperations:1},pool,cancelDuringValidation{cancel:cancel},sub)
 if err!=nil{t.Fatal(err)}
 _,err=builder.SubmitNext(ctx,now)
 if !errors.Is(err,context.Canceled){t.Fatalf("expected context cancellation, got %v",err)}
 if len(sub.order)!=0||len(pool.removed)!=0{t.Fatal("late validator response caused send or removal")}
}

func TestCancellationAfterIntentAbortsWithoutBroadcast(t *testing.T){
 now:=time.Date(2026,9,19,12,0,0,0,time.UTC)
 pool,sub:=cancelledCandidate(t,now)
 ctx,cancel:=context.WithCancel(context.Background());defer cancel()
 rec:=&cancelDuringIntent{cancel:cancel}
 builder,err:=New(Config{EntryPoint:"0x1111111111111111111111111111111111111111",MaxOperations:1},pool,fakeValidator{invalid:map[string]bool{}},sub)
 if err!=nil{t.Fatal(err)}
 builder.SetSubmissionRecorder(rec)
 _,err=builder.SubmitNext(ctx,now)
 if !errors.Is(err,context.Canceled){t.Fatalf("expected context cancellation, got %v",err)}
 if len(sub.order)!=0||len(pool.removed)!=0{t.Fatal("operation sent after cancellation")}
 if rec.HasSubmissionOrPending(pool.items[0].Hash){t.Fatal("pre-send intent not aborted")}
}

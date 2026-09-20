package bundle

import (
 "context"
 "errors"
 "time"

 "github.com/420integrated/420-integrated/bundler/mempool"
 "github.com/420integrated/420-integrated/bundler/ordering"
 "github.com/420integrated/420-integrated/bundler/simulation"
 "github.com/420integrated/420-integrated/bundler/userop"
)

type Pool interface {
 Snapshot(time.Time) []mempool.Entry
 Remove(string) bool
}

type Validator interface {
 ValidateAndSimulate(context.Context,userop.PackedUserOperation,time.Time)(simulation.Evidence,error)
}

type Submitter interface {
 Submit(context.Context,string,userop.PackedUserOperation)(string,error)
}

type SubmissionRecorder interface {
 BeginSubmission(string,string,time.Time) error
 AbortSubmission(string)
 HasSubmissionOrPending(string) bool
 RecordSubmission(string,string,string,time.Time) error
}

type Config struct {
 EntryPoint string
 MaxOperations int
 // OrderingPolicy accepts only fifo-v1 at Genesis. Blank defaults to fifo-v1.
 OrderingPolicy string
}

type Submitted struct {
 UserOpHash string
 TransactionHash string
 SubmittedAt time.Time
}

type Result struct {
 Selected int
 Submitted []Submitted
 Rejected []string
 Failed []string
}

type Builder struct {
 cfg Config
 pool Pool
 validator Validator
 submitter Submitter
 recorder SubmissionRecorder
}

func New(cfg Config,pool Pool,validator Validator,submitter Submitter)(*Builder,error){
 if !address(cfg.EntryPoint) { return nil,errors.New("valid entry point is required") }
 if cfg.MaxOperations<=0 { return nil,errors.New("max bundle operations must be positive") }
 if err:=ordering.Validate(cfg.OrderingPolicy);err!=nil{return nil,err}
 if cfg.OrderingPolicy=="" { cfg.OrderingPolicy=ordering.GenesisFIFO }
 if pool==nil || validator==nil || submitter==nil { return nil,errors.New("pool, validator and submitter are required") }
 return &Builder{cfg:cfg,pool:pool,validator:validator,submitter:submitter},nil
}

func (b *Builder) SetSubmissionRecorder(recorder SubmissionRecorder) { b.recorder=recorder }

func (b *Builder) SubmitNext(ctx context.Context,now time.Time)(Result,error){
 if now.IsZero() { return Result{},errors.New("submission time is required") }
 if err:=ctx.Err();err!=nil{return Result{},err}
 // Enforce the published policy even if a future Pool implementation returns
 // a fee-sorted or peer-dependent snapshot. Sorting precedes truncation.
 snapshot,err:=ordering.Select(b.pool.Snapshot(now),b.cfg.MaxOperations,b.cfg.OrderingPolicy)
 if err!=nil{return Result{},err}
 result:=Result{Selected:len(snapshot)}
 for _,entry:=range snapshot {
  // A dependency can ignore cancellation. Never start a fresh operation once
  // the caller's deadline has passed; leave unattempted entries in the pool.
  if err:=ctx.Err();err!=nil{return result,err}
  if b.recorder!=nil && b.recorder.HasSubmissionOrPending(entry.Hash) {
   b.pool.Remove(entry.Hash)
   result.Failed=append(result.Failed,entry.Hash)
   continue
  }
  evidence,err:=b.validator.ValidateAndSimulate(ctx,entry.Operation,now)
  if ctxErr:=ctx.Err();ctxErr!=nil{return result,ctxErr}
  if err!=nil || evidence.UserOpHash!=entry.Hash {
   b.pool.Remove(entry.Hash)
   result.Rejected=append(result.Rejected,entry.Hash)
   continue
  }
  if b.recorder!=nil {
   if err:=b.recorder.BeginSubmission(entry.Hash,b.cfg.EntryPoint,now.UTC()); err!=nil {
    result.Failed=append(result.Failed,entry.Hash)
    continue
   }
  }
  if ctxErr:=ctx.Err();ctxErr!=nil {
   // No send has been attempted. Revert this intent; the operation remains
   // eligible for a later fresh validation cycle.
   if b.recorder!=nil { b.recorder.AbortSubmission(entry.Hash) }
   return result,ctxErr
  }
  txHash,err:=b.submitter.Submit(ctx,b.cfg.EntryPoint,entry.Operation)
  if err!=nil {
   if errors.Is(err,ErrAmbiguousSubmission) || ctx.Err()!=nil {
    // An accepted transaction may be unacknowledged; preserve durable intent.
    b.pool.Remove(entry.Hash)
   } else if b.recorder!=nil {
    // Only an explicit rejection permits a later revalidated retry.
    b.recorder.AbortSubmission(entry.Hash)
   }
   result.Failed=append(result.Failed,entry.Hash)
   if ctxErr:=ctx.Err();ctxErr!=nil{return result,ctxErr}
   continue
  }
  if b.recorder!=nil {
   if err:=b.recorder.RecordSubmission(entry.Hash,txHash,b.cfg.EntryPoint,now.UTC()); err!=nil {
    b.pool.Remove(entry.Hash)
    result.Failed=append(result.Failed,entry.Hash)
    continue
   }
  }
  b.pool.Remove(entry.Hash)
  result.Submitted=append(result.Submitted,Submitted{UserOpHash:entry.Hash,TransactionHash:txHash,SubmittedAt:now.UTC()})
 }
 return result,nil
}

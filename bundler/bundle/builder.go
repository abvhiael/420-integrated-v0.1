package bundle

import (
	"context"
	"errors"
	"time"

	"github.com/420integrated/420-integrated/bundler/mempool"
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

type Config struct {
	EntryPoint string
	MaxOperations int
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
}

func New(cfg Config,pool Pool,validator Validator,submitter Submitter)(*Builder,error){
	if !address(cfg.EntryPoint) { return nil,errors.New("valid entry point is required") }
	if cfg.MaxOperations<=0 { return nil,errors.New("max bundle operations must be positive") }
	if pool==nil || validator==nil || submitter==nil { return nil,errors.New("pool, validator and submitter are required") }
	return &Builder{cfg:cfg,pool:pool,validator:validator,submitter:submitter},nil
}

func (b *Builder) SubmitNext(ctx context.Context,now time.Time)(Result,error){
	if now.IsZero() { return Result{},errors.New("submission time is required") }
	snapshot:=b.pool.Snapshot(now)
	if len(snapshot)>b.cfg.MaxOperations { snapshot=snapshot[:b.cfg.MaxOperations] }
	result:=Result{Selected:len(snapshot)}
	for _,entry:=range snapshot {
		evidence,err:=b.validator.ValidateAndSimulate(ctx,entry.Operation,now)
		if err!=nil || evidence.UserOpHash!=entry.Hash {
			b.pool.Remove(entry.Hash)
			result.Rejected=append(result.Rejected,entry.Hash)
			continue
		}
		txHash,err:=b.submitter.Submit(ctx,b.cfg.EntryPoint,entry.Operation)
		if err!=nil {
			result.Failed=append(result.Failed,entry.Hash)
			continue
		}
		b.pool.Remove(entry.Hash)
		result.Submitted=append(result.Submitted,Submitted{
			UserOpHash:entry.Hash,TransactionHash:txHash,SubmittedAt:now.UTC(),
		})
	}
	return result,nil
}

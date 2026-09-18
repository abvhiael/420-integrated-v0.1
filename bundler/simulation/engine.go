package simulation

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/420integrated/420-integrated/bundler/paymaster"
	"github.com/420integrated/420-integrated/bundler/userop"
)

type Snapshot struct {
	BlockNumber uint64
	BlockHash string
	ObservedAt time.Time
}

type Result struct {
	ReturnData string
	ExecutionSucceeded bool
	Snapshot Snapshot
}

type Simulator interface {
	SimulateHandleOp(context.Context,string,userop.PackedUserOperation)(Result,error)
}

type Evidence struct {
	UserOpHash string
	EntryPoint string
	ChainID uint64
	BlockNumber uint64
	BlockHash string
	ObservedAt time.Time
	ExecutionSucceeded bool
}

type Engine struct {
	chainID uint64
	entryPoint string
	maxEvidenceAge time.Duration
	simulator Simulator
}

func NewEngine(chainID uint64,entryPoint string,maxEvidenceAge time.Duration,sim Simulator)(*Engine,error){
	if chainID==0 { return nil,errors.New("chain id must be non-zero") }
	if !address(entryPoint) { return nil,errors.New("valid entry point is required") }
	if maxEvidenceAge<=0 { return nil,errors.New("max evidence age must be positive") }
	if sim==nil { return nil,errors.New("simulator is required") }
	return &Engine{chainID:chainID,entryPoint:strings.ToLower(entryPoint),maxEvidenceAge:maxEvidenceAge,simulator:sim},nil
}

func (e *Engine) ValidateAndSimulate(ctx context.Context,op userop.PackedUserOperation,now time.Time)(Evidence,error){
	if now.IsZero() { return Evidence{},errors.New("validation time is required") }
	if _,err:=op.Canonicalize(); err!=nil { return Evidence{},fmt.Errorf("canonical UserOperation rejected: %w",err) }
	if _,err:=paymaster.Validate(op,e.chainID,e.entryPoint,now); err!=nil {
		return Evidence{},fmt.Errorf("paymaster boundary rejected: %w",err)
	}
	hash,err:=userop.Hash(e.chainID,e.entryPoint,op)
	if err!=nil { return Evidence{},fmt.Errorf("canonical hash unavailable: %w",err) }

	result,err:=e.simulator.SimulateHandleOp(ctx,e.entryPoint,op)
	if err!=nil { return Evidence{},fmt.Errorf("EntryPoint simulation failed: %w",err) }
	if !result.ExecutionSucceeded { return Evidence{},errors.New("EntryPoint simulation predicts execution failure") }
	if result.Snapshot.BlockNumber==0 { return Evidence{},errors.New("simulation snapshot block number is missing") }
	if !hash32(result.Snapshot.BlockHash) { return Evidence{},errors.New("simulation snapshot block hash is invalid") }
	if result.Snapshot.ObservedAt.IsZero() || result.Snapshot.ObservedAt.After(now.Add(time.Second)) || now.Sub(result.Snapshot.ObservedAt)>e.maxEvidenceAge {
		return Evidence{},errors.New("simulation evidence is stale or invalid")
	}
	return Evidence{
		UserOpHash:strings.ToLower(hash),EntryPoint:e.entryPoint,ChainID:e.chainID,
		BlockNumber:result.Snapshot.BlockNumber,BlockHash:strings.ToLower(result.Snapshot.BlockHash),
		ObservedAt:result.Snapshot.ObservedAt.UTC(),ExecutionSucceeded:true,
	},nil
}

func address(v string) bool {
	if len(v)!=42 || !strings.HasPrefix(v,"0x") { return false }
	for _,c:=range v[2:] { if !strings.ContainsRune("0123456789abcdefABCDEF",c) { return false } }
	return v!="0x0000000000000000000000000000000000000000"
}

func hash32(v string) bool {
	if len(v)!=66 || !strings.HasPrefix(v,"0x") { return false }
	for _,c:=range v[2:] { if !strings.ContainsRune("0123456789abcdefABCDEF",c) { return false } }
	return true
}

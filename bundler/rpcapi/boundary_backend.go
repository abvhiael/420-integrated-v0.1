package rpcapi

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/420integrated/420-integrated/bundler/gasestimation"
	"github.com/420integrated/420-integrated/bundler/lifecycle"
	"github.com/420integrated/420-integrated/bundler/mempool"
	"github.com/420integrated/420-integrated/bundler/simulation"
	"github.com/420integrated/420-integrated/bundler/userop"
)

var ErrValidationRejected = &Error{Code:-32502,Message:"UserOperation validation/simulation rejected"}

type Validator interface {
	ValidateAndSimulate(context.Context,userop.PackedUserOperation,time.Time)(simulation.Evidence,error)
}

type AdmissionPool interface {
	Add(userop.PackedUserOperation,simulation.Evidence,time.Time)(mempool.AddResult,error)
}

type GasEstimator interface {
	Estimate(context.Context,userop.PackedUserOperation,string)(gasestimation.Estimate,error)
}

type LifecycleTracker interface {
	GetReceipt(context.Context,string)(lifecycle.Receipt,bool,error)
}

type BoundaryBackend struct {
	EntryPoint string
	Validator Validator
	Mempool AdmissionPool
	GasEstimator GasEstimator
	Lifecycle LifecycleTracker
	Now func() time.Time
}

func (b BoundaryBackend) SupportedEntryPoints(context.Context) ([]string,error) {
	if !isAddress(b.EntryPoint) { return nil,errors.New("invalid configured EntryPoint") }
	return []string{strings.ToLower(b.EntryPoint)},nil
}

func (b BoundaryBackend) SendUserOperation(ctx context.Context,op userop.PackedUserOperation,entryPoint string)(string,error) {
	if !strings.EqualFold(entryPoint,b.EntryPoint) { return "",&Error{Code:-32602,Message:"unsupported EntryPoint"} }
	if b.Validator==nil { return "",errors.New("validation engine unavailable") }
	if b.Mempool==nil { return "",errors.New("mempool unavailable") }
	now:=time.Now().UTC()
	if b.Now!=nil { now=b.Now().UTC() }
	evidence,err:=b.Validator.ValidateAndSimulate(ctx,op,now)
	if err!=nil { return "",ErrValidationRejected }
	admitted,err:=b.Mempool.Add(op,evidence,now)
	if err!=nil {
		switch {
		case errors.Is(err,mempool.ErrNonceConflict):
			return "",&Error{Code:-32503,Message:"sender nonce conflict"}
		case errors.Is(err,mempool.ErrFull),errors.Is(err,mempool.ErrSenderLimit):
			return "",&Error{Code:-32506,Message:"Bundler mempool capacity exceeded"}
		default:
			return "",errors.New("mempool admission failed")
		}
	}
	return admitted.Hash,nil
}

func (b BoundaryBackend) EstimateUserOperationGas(ctx context.Context,op userop.PackedUserOperation,entryPoint string)(GasEstimate,error) {
	if !strings.EqualFold(entryPoint,b.EntryPoint) { return GasEstimate{},&Error{Code:-32602,Message:"unsupported EntryPoint"} }
	if b.GasEstimator==nil { return GasEstimate{},errors.New("gas estimator unavailable") }
	estimate,err:=b.GasEstimator.Estimate(ctx,op,entryPoint)
	if err!=nil { return GasEstimate{},&Error{Code:-32504,Message:"UserOperation gas estimation failed"} }
	return GasEstimate{
		PreVerificationGas:estimate.PreVerificationGas,
		VerificationGasLimit:estimate.VerificationGasLimit,
		CallGasLimit:estimate.CallGasLimit,
	},nil
}

func (b BoundaryBackend) GetUserOperationReceipt(ctx context.Context,hash string)(any,bool,error) {
	if b.Lifecycle==nil { return nil,false,errors.New("lifecycle tracker unavailable") }
	receipt,found,err:=b.Lifecycle.GetReceipt(ctx,hash)
	if err!=nil { return nil,false,&Error{Code:-32505,Message:"UserOperation receipt reconciliation failed"} }
	if !found { return nil,false,nil }
	return receipt,true,nil
}

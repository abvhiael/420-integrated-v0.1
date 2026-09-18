package rpcapi

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/420integrated/420-integrated/bundler/mempool"
	"github.com/420integrated/420-integrated/bundler/simulation"
	"github.com/420integrated/420-integrated/bundler/userop"
)

var ErrValidationRejected = &Error{Code:-32502,Message:"UserOperation validation/simulation rejected"}
var ErrEstimationNotImplemented = &Error{Code:-32504,Message:"UserOperation gas estimation is not available until GEN-11.7"}
var ErrReceiptTrackingNotImplemented = &Error{Code:-32505,Message:"UserOperation receipt tracking is not available until GEN-11.9"}

type Validator interface {
	ValidateAndSimulate(context.Context,userop.PackedUserOperation,time.Time)(simulation.Evidence,error)
}

type AdmissionPool interface {
	Add(userop.PackedUserOperation,simulation.Evidence,time.Time)(mempool.AddResult,error)
}

type BoundaryBackend struct {
	EntryPoint string
	Validator Validator
	Mempool AdmissionPool
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

func (b BoundaryBackend) EstimateUserOperationGas(context.Context,userop.PackedUserOperation,string)(GasEstimate,error) {
	return GasEstimate{},ErrEstimationNotImplemented
}

func (b BoundaryBackend) GetUserOperationReceipt(context.Context,string)(any,bool,error) {
	return nil,false,ErrReceiptTrackingNotImplemented
}

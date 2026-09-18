package rpcapi

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/420integrated/420-integrated/bundler/simulation"
	"github.com/420integrated/420-integrated/bundler/userop"
)

var ErrAdmissionNotImplemented = &Error{Code:-32500,Message:"UserOperation admission is not available until GEN-11.5"}
var ErrValidationRejected = &Error{Code:-32502,Message:"UserOperation validation/simulation rejected"}
var ErrEstimationNotImplemented = &Error{Code:-32504,Message:"UserOperation gas estimation is not available until GEN-11.7"}
var ErrReceiptTrackingNotImplemented = &Error{Code:-32505,Message:"UserOperation receipt tracking is not available until GEN-11.9"}

type Validator interface {
	ValidateAndSimulate(context.Context,userop.PackedUserOperation,time.Time)(simulation.Evidence,error)
}

type BoundaryBackend struct {
	EntryPoint string
	Validator Validator
	Now func() time.Time
}

func (b BoundaryBackend) SupportedEntryPoints(context.Context) ([]string,error) {
	if !isAddress(b.EntryPoint) { return nil,errors.New("invalid configured EntryPoint") }
	return []string{strings.ToLower(b.EntryPoint)},nil
}

func (b BoundaryBackend) SendUserOperation(ctx context.Context,op userop.PackedUserOperation,entryPoint string)(string,error) {
	if !strings.EqualFold(entryPoint,b.EntryPoint) { return "",&Error{Code:-32602,Message:"unsupported EntryPoint"} }
	if b.Validator==nil { return "",errors.New("validation engine unavailable") }
	now:=time.Now().UTC()
	if b.Now!=nil { now=b.Now().UTC() }
	if _,err:=b.Validator.ValidateAndSimulate(ctx,op,now); err!=nil { return "",ErrValidationRejected }
	return "",ErrAdmissionNotImplemented
}

func (b BoundaryBackend) EstimateUserOperationGas(context.Context,userop.PackedUserOperation,string)(GasEstimate,error) {
	return GasEstimate{},ErrEstimationNotImplemented
}

func (b BoundaryBackend) GetUserOperationReceipt(context.Context,string)(any,bool,error) {
	return nil,false,ErrReceiptTrackingNotImplemented
}

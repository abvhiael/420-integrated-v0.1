package rpcapi

import (
	"context"
	"errors"

	"github.com/420integrated/420-integrated/bundler/userop"
)

var ErrAdmissionNotImplemented = &Error{Code:-32500,Message:"UserOperation admission is not available in GEN-11.3"}
var ErrEstimationNotImplemented = &Error{Code:-32504,Message:"UserOperation gas estimation is not available until GEN-11.7"}
var ErrReceiptTrackingNotImplemented = &Error{Code:-32505,Message:"UserOperation receipt tracking is not available until GEN-11.9"}

type BoundaryBackend struct { EntryPoint string }

func (b BoundaryBackend) SupportedEntryPoints(context.Context) ([]string,error) {
	if !isAddress(b.EntryPoint) { return nil,errors.New("invalid configured EntryPoint") }
	return []string{b.EntryPoint},nil
}

func (b BoundaryBackend) SendUserOperation(context.Context,userop.PackedUserOperation,string)(string,error) {
	return "",ErrAdmissionNotImplemented
}

func (b BoundaryBackend) EstimateUserOperationGas(context.Context,userop.PackedUserOperation,string)(GasEstimate,error) {
	return GasEstimate{},ErrEstimationNotImplemented
}

func (b BoundaryBackend) GetUserOperationReceipt(context.Context,string)(any,bool,error) {
	return nil,false,ErrReceiptTrackingNotImplemented
}

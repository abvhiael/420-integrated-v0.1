package complianceauth

import (
 "context"
 "errors"
 "time"
)

// PaymentWorkflowReference is a non-executable Compliance decision reference.
// Pay and Wallet independently authorize and execute transactions.
type PaymentWorkflowReference struct {
 TenantID string
 OperationRef string
 Audience string
 Workflow string
 Stage string
 ReceiptID string
 PolicyDigest string
 FactsDigest string
 ExpiresAt time.Time
}
type PaymentReferenceAuthority interface {
 VerifyCurrentPaymentPolicy(context.Context,PaymentWorkflowReference,time.Time)error
}
var ErrPaymentReferenceDenied=errors.New("compliance payment reference denied")
func BindPaymentWorkflowReference(ctx context.Context,receipt BoundDecisionReceipt,tenant,operation,audience,workflow,stage,factsDigest string,authority PaymentReferenceAuthority,now time.Time)(PaymentWorkflowReference,error){
 var zero PaymentWorkflowReference
 if ctx==nil||ctx.Err()!=nil||authority==nil||now.IsZero()||!c051Scope(tenant)||!c051Scope(operation)||!c051Scope(audience)||!c051Scope(workflow)||!c051Scope(stage)||!digestValid(factsDigest){return zero,ErrPaymentReferenceDenied}
 // Restrict actions to explicitly reviewed Pay/Wallet external workflow calls.
 if workflow!="PAY_PREAUTH"&&workflow!="PAY_CAPTURE"&&workflow!="WALLET_PRESENT"{return zero,ErrPaymentReferenceDenied}
 if receipt.TenantID!=tenant||receipt.OperationRef!=operation||receipt.Audience!=audience||receipt.Stage!=stage||receipt.FactsDigest!=factsDigest||!digestValid(receipt.PolicyDigest)||!c051Scope(receipt.ReceiptID)||receipt.ReceiptID==""||now.Before(receipt.IssuedAt)||!now.Before(receipt.ExpiresAt){return zero,ErrPaymentReferenceDenied}
 // One receipt cannot switch purposes or become an independent refund permit.
 expectedAction:=map[string]string{"PAY_PREAUTH":"PAY_PREAUTH","PAY_CAPTURE":"PAY_CAPTURE","WALLET_PRESENT":"WALLET_PRESENT"}[workflow]
 if receipt.Action!=expectedAction{return zero,ErrPaymentReferenceDenied}
 result:=PaymentWorkflowReference{TenantID:tenant,OperationRef:operation,Audience:audience,Workflow:workflow,Stage:stage,ReceiptID:receipt.ReceiptID,PolicyDigest:receipt.PolicyDigest,FactsDigest:factsDigest,ExpiresAt:receipt.ExpiresAt}
 if err:=authority.VerifyCurrentPaymentPolicy(ctx,result,now);err!=nil||ctx.Err()!=nil{return zero,ErrPaymentReferenceDenied}
 return result,nil
}

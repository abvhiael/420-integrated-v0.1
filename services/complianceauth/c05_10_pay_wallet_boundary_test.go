package complianceauth

import (
 "context"
 "errors"
 "testing"
 "time"
)
type c0510Authority struct{deny bool;calls int}
func(a *c0510Authority)VerifyCurrentPaymentPolicy(context.Context,PaymentWorkflowReference,time.Time)error{a.calls++;if a.deny{return ErrPaymentReferenceDenied};return nil}
func TestC0510PayWalletBoundary(t *testing.T){
 now:=time.Date(2026,10,12,5,0,0,0,time.UTC)
 digest:=Digest([]byte("facts"))
 r:=BoundDecisionReceipt{ReceiptID:"receipt",TenantID:"tenant",OperationRef:"order",Audience:"Pay",Stage:"PAYMENT",Action:"PAY_CAPTURE",FactsDigest:digest,PolicyDigest:Digest([]byte("policy")),IssuedAt:now.Add(-time.Minute),ExpiresAt:now.Add(time.Minute)}
 a:=&c0510Authority{}
 bind:=func(x BoundDecisionReceipt,tenant,operation,audience,workflow,stage,facts string)(PaymentWorkflowReference,error){return BindPaymentWorkflowReference(context.Background(),x,tenant,operation,audience,workflow,stage,facts,a,now)}
 out,err:=bind(r,"tenant","order","Pay","PAY_CAPTURE","PAYMENT",digest)
 if err!=nil||out.Workflow!="PAY_CAPTURE"||a.calls!=1{t.Fatalf("valid reference %+v %v",out,err)}
 cases:=[]struct{name string;change func(*BoundDecisionReceipt,*string,*string,*string,*string,*string,*string)}{
 {"cross tenant",func(x *BoundDecisionReceipt,t,o,au,w,st,f *string){*t="other"}},
 {"cross order",func(x *BoundDecisionReceipt,t,o,au,w,st,f *string){*o="other"}},
 {"cross audience",func(x *BoundDecisionReceipt,t,o,au,w,st,f *string){*au="Wallet"}},
 {"stage change",func(x *BoundDecisionReceipt,t,o,au,w,st,f *string){*st="REFUND"}},
 {"facts change",func(x *BoundDecisionReceipt,t,o,au,w,st,f *string){*f=Digest([]byte("changed"))}},
 {"workflow switch",func(x *BoundDecisionReceipt,t,o,au,w,st,f *string){*w="PAY_PREAUTH"}},
 {"independent refund",func(x *BoundDecisionReceipt,t,o,au,w,st,f *string){*w="PAY_REFUND"}},
 {"expired",func(x *BoundDecisionReceipt,t,o,au,w,st,f *string){x.ExpiresAt=now}},
 {"missing policy",func(x *BoundDecisionReceipt,t,o,au,w,st,f *string){x.PolicyDigest=""}},
 }
 for _,tc:=range cases{x:=r;tenant,op,audience,work,stage,facts:="tenant","order","Pay","PAY_CAPTURE","PAYMENT",digest;tc.change(&x,&tenant,&op,&audience,&work,&stage,&facts);if _,err:=bind(x,tenant,op,audience,work,stage,facts);err==nil{t.Fatalf("%s bypass",tc.name)}}
 a.deny=true
 if _,err:=bind(r,"tenant","order","Pay","PAY_CAPTURE","PAYMENT",digest);!errors.Is(err,ErrPaymentReferenceDenied){t.Fatal("current policy denial bypass")}
 if _,err:=BindPaymentWorkflowReference(context.Background(),r,"tenant","order","Pay","PAY_CAPTURE","PAYMENT",digest,nil,now);err==nil{t.Fatal("missing authority allowed")}
}

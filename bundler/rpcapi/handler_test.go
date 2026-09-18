package rpcapi

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/420integrated/420-integrated/bundler/mempool"
	"github.com/420integrated/420-integrated/bundler/simulation"
	"github.com/420integrated/420-integrated/bundler/userop"
)

type fakeBackend struct {
	sendHash string
	sendErr error
	receipt any
	receiptFound bool
	receiptErr error
	estimate GasEstimate
	estimateErr error
	points []string
	pointsErr error
	lastEntry string
}

func (f *fakeBackend) SendUserOperation(_ context.Context, _ userop.PackedUserOperation, entry string)(string,error){
	f.lastEntry=entry
	return f.sendHash,f.sendErr
}
func (f *fakeBackend) GetUserOperationReceipt(context.Context,string)(any,bool,error){
	return f.receipt,f.receiptFound,f.receiptErr
}
func (f *fakeBackend) EstimateUserOperationGas(_ context.Context,_ userop.PackedUserOperation,entry string)(GasEstimate,error){
	f.lastEntry=entry
	return f.estimate,f.estimateErr
}
func (f *fakeBackend) SupportedEntryPoints(context.Context)([]string,error){ return f.points,f.pointsErr }

type fakeValidator struct {
	err error
	evidence simulation.Evidence
}

func (f fakeValidator) ValidateAndSimulate(context.Context,userop.PackedUserOperation,time.Time)(simulation.Evidence,error){
	if f.err!=nil { return simulation.Evidence{},f.err }
	return f.evidence,nil
}

type fakeAdmissionPool struct {
	result mempool.AddResult
	err error
}

func (f fakeAdmissionPool) Add(userop.PackedUserOperation,simulation.Evidence,time.Time)(mempool.AddResult,error){
	return f.result,f.err
}

func rpcFixture() userop.PackedUserOperation {
	return userop.PackedUserOperation{
		Sender:"0x2222222222222222222222222222222222222222",
		Nonce:"0x5",
		InitCode:"0x",
		CallData:"0x1234",
		AccountGasLimits:"0x3333333333333333333333333333333333333333333333333333333333333333",
		PreVerificationGas:"0x5208",
		GasFees:"0x4444444444444444444444444444444444444444444444444444444444444444",
		PaymasterAndData:"0x",
		Signature:"0xaabb",
	}
}

func call(t *testing.T,h http.Handler,body any) map[string]any {
	t.Helper()
	raw,err:=json.Marshal(body)
	if err!=nil { t.Fatal(err) }
	req:=httptest.NewRequest(http.MethodPost,"/",bytes.NewReader(raw))
	req.Header.Set("Content-Type","application/json")
	w:=httptest.NewRecorder()
	h.ServeHTTP(w,req)
	if w.Code!=http.StatusOK { t.Fatalf("http status %d: %s",w.Code,w.Body.String()) }
	var out map[string]any
	if err:=json.Unmarshal(w.Body.Bytes(),&out); err!=nil { t.Fatal(err) }
	return out
}

func TestSupportedEntryPoints(t *testing.T) {
	b:=&fakeBackend{points:[]string{"0x1111111111111111111111111111111111111111"}}
	h,_:=NewHandler(b)
	out:=call(t,h,map[string]any{"jsonrpc":"2.0","id":1,"method":"eth_supportedEntryPoints","params":[]any{}})
	if _,ok:=out["error"]; ok { t.Fatalf("unexpected error: %v",out) }
	result,ok:=out["result"].([]any)
	if !ok || len(result)!=1 || result[0]!="0x1111111111111111111111111111111111111111" { t.Fatalf("unexpected result: %v",out) }
}

func TestSendUserOperationValidatesEnvelopeAndReturnsHash(t *testing.T) {
	b:=&fakeBackend{sendHash:"0x"+strings.Repeat("ab",32)}
	h,_:=NewHandler(b)
	out:=call(t,h,map[string]any{
		"jsonrpc":"2.0","id":"abc","method":"eth_sendUserOperation",
		"params":[]any{rpcFixture(),"0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"},
	})
	if out["result"]!="0x"+strings.Repeat("ab",32) { t.Fatalf("unexpected result: %v",out) }
	if b.lastEntry!="0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" { t.Fatalf("entry point was not normalized: %s",b.lastEntry) }
}

func TestReceiptNotFoundReturnsExplicitNull(t *testing.T) {
	b:=&fakeBackend{}
	h,_:=NewHandler(b)
	out:=call(t,h,map[string]any{
		"jsonrpc":"2.0","id":7,"method":"eth_getUserOperationReceipt",
		"params":[]any{"0x"+strings.Repeat("11",32)},
	})
	result,ok:=out["result"]
	if !ok { t.Fatalf("missing result member: %v",out) }
	if result!=nil { t.Fatalf("expected null result: %v",out) }
}

func TestEstimateUserOperationGas(t *testing.T) {
	b:=&fakeBackend{estimate:GasEstimate{
		PreVerificationGas:"0x5208",VerificationGasLimit:"0x10000",CallGasLimit:"0x20000",
	}}
	h,_:=NewHandler(b)
	out:=call(t,h,map[string]any{
		"jsonrpc":"2.0","id":2,"method":"eth_estimateUserOperationGas",
		"params":[]any{rpcFixture(),"0x1111111111111111111111111111111111111111"},
	})
	if _,ok:=out["error"]; ok { t.Fatalf("unexpected error: %v",out) }
}

func TestBoundaryBackendAdmitsValidatedOperationAndReturnsCanonicalHash(t *testing.T) {
	hash:="0x"+strings.Repeat("11",32)
	b:=BoundaryBackend{
		EntryPoint:"0x1111111111111111111111111111111111111111",
		Validator:fakeValidator{evidence:simulation.Evidence{UserOpHash:hash,ExecutionSucceeded:true}},
		Mempool:fakeAdmissionPool{result:mempool.AddResult{Hash:hash}},
	}
	h,_:=NewHandler(b)
	send:=call(t,h,map[string]any{"jsonrpc":"2.0","id":1,"method":"eth_sendUserOperation","params":[]any{rpcFixture(),b.EntryPoint}})
	if send["result"]!=hash { t.Fatalf("unexpected send result: %v",send) }

	estimate:=call(t,h,map[string]any{"jsonrpc":"2.0","id":2,"method":"eth_estimateUserOperationGas","params":[]any{rpcFixture(),b.EntryPoint}})
	errObj:=estimate["error"].(map[string]any)
	if int(errObj["code"].(float64))!=-32504 { t.Fatalf("unexpected estimate boundary error: %v",estimate) }

	receipt:=call(t,h,map[string]any{"jsonrpc":"2.0","id":3,"method":"eth_getUserOperationReceipt","params":[]any{hash}})
	errObj=receipt["error"].(map[string]any)
	if int(errObj["code"].(float64))!=-32505 { t.Fatalf("unexpected receipt boundary error: %v",receipt) }
}

func TestBoundaryBackendRejectsFailedSimulation(t *testing.T) {
	b:=BoundaryBackend{
		EntryPoint:"0x1111111111111111111111111111111111111111",
		Validator:fakeValidator{err:errors.New("reverted")},
		Mempool:fakeAdmissionPool{},
	}
	h,_:=NewHandler(b)
	out:=call(t,h,map[string]any{
		"jsonrpc":"2.0","id":1,"method":"eth_sendUserOperation",
		"params":[]any{rpcFixture(),b.EntryPoint},
	})
	errObj:=out["error"].(map[string]any)
	if int(errObj["code"].(float64))!=-32502 { t.Fatalf("unexpected validation rejection: %v",out) }
}

func TestBoundaryBackendMapsMempoolConflictsAndCapacity(t *testing.T) {
	hash:="0x"+strings.Repeat("11",32)
	cases:=[]struct{name string; poolErr error; code int}{
		{"nonce-conflict",mempool.ErrNonceConflict,-32503},
		{"full",mempool.ErrFull,-32506},
		{"sender-limit",mempool.ErrSenderLimit,-32506},
	}
	for _,tc:=range cases {
		t.Run(tc.name,func(t *testing.T){
			b:=BoundaryBackend{
				EntryPoint:"0x1111111111111111111111111111111111111111",
				Validator:fakeValidator{evidence:simulation.Evidence{UserOpHash:hash,ExecutionSucceeded:true}},
				Mempool:fakeAdmissionPool{err:tc.poolErr},
			}
			h,_:=NewHandler(b)
			out:=call(t,h,map[string]any{"jsonrpc":"2.0","id":1,"method":"eth_sendUserOperation","params":[]any{rpcFixture(),b.EntryPoint}})
			errObj:=out["error"].(map[string]any)
			if int(errObj["code"].(float64))!=tc.code { t.Fatalf("unexpected mempool error mapping: %v",out) }
		})
	}
}

func TestInvalidRequestsFailClosed(t *testing.T) {
	b:=&fakeBackend{}
	h,_:=NewHandler(b)
	cases:=[]struct{
		name string
		body any
		code int
	}{
		{"wrong-version",map[string]any{"jsonrpc":"1.0","id":1,"method":"eth_supportedEntryPoints","params":[]any{}},-32600},
		{"object-id",map[string]any{"jsonrpc":"2.0","id":map[string]any{"x":1},"method":"eth_supportedEntryPoints","params":[]any{}},-32600},
		{"unknown-method",map[string]any{"jsonrpc":"2.0","id":1,"method":"eth_magic","params":[]any{}},-32601},
		{"bad-entrypoint",map[string]any{"jsonrpc":"2.0","id":1,"method":"eth_sendUserOperation","params":[]any{rpcFixture(),"0x12"}},-32602},
	}
	for _,tc:=range cases {
		t.Run(tc.name,func(t *testing.T){
			out:=call(t,h,tc.body)
			errObj,ok:=out["error"].(map[string]any)
			if !ok { t.Fatalf("expected error: %v",out) }
			if int(errObj["code"].(float64))!=tc.code { t.Fatalf("got %v want %d",errObj["code"],tc.code) }
		})
	}
}

func TestBackendErrorMapping(t *testing.T) {
	b:=&fakeBackend{pointsErr:&Error{Code:-32599,Message:"operator policy"}}
	h,_:=NewHandler(b)
	out:=call(t,h,map[string]any{"jsonrpc":"2.0","id":1,"method":"eth_supportedEntryPoints","params":[]any{}})
	errObj:=out["error"].(map[string]any)
	if int(errObj["code"].(float64))!=-32599 { t.Fatalf("unexpected mapped error: %v",out) }

	b.pointsErr=errors.New("secret dependency detail")
	out=call(t,h,map[string]any{"jsonrpc":"2.0","id":2,"method":"eth_supportedEntryPoints","params":[]any{}})
	errObj=out["error"].(map[string]any)
	if errObj["message"]!="internal error" { t.Fatalf("backend detail leaked: %v",out) }
}

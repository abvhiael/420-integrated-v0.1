package peer

import (
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

type fakeValidator struct{err error}
func (f fakeValidator) ValidateAndSimulate(_ context.Context,op userop.PackedUserOperation,now time.Time)(simulation.Evidence,error){
	if f.err!=nil{return simulation.Evidence{},f.err}
	h,err:=userop.Hash(420,"0x1111111111111111111111111111111111111111",op);if err!=nil{return simulation.Evidence{},err}
	return simulation.Evidence{UserOpHash:h,EntryPoint:"0x1111111111111111111111111111111111111111",ChainID:420,BlockNumber:1,BlockHash:"0x"+strings.Repeat("22",32),ObservedAt:now,ExecutionSucceeded:true},nil
}
type fakePool struct{adds int; err error}
func (p *fakePool) Add(_ userop.PackedUserOperation,e simulation.Evidence,_ time.Time)(mempool.AddResult,error){
	p.adds++
	if p.err!=nil{return mempool.AddResult{},p.err}
	return mempool.AddResult{Hash:e.UserOpHash},nil
}
func fixture()userop.PackedUserOperation{
	return userop.PackedUserOperation{
		Sender:"0x2222222222222222222222222222222222222222",Nonce:"0x1",InitCode:"0x",CallData:"0x1234",
		AccountGasLimits:"0x"+strings.Repeat("00",32),PreVerificationGas:"0x0",
		GasFees:"0x"+strings.Repeat("00",32),PaymasterAndData:"0x",Signature:"0xaa",
	}
}
func envelope(t *testing.T,op userop.PackedUserOperation)Envelope{
	t.Helper()
	h,err:=userop.Hash(420,"0x1111111111111111111111111111111111111111",op);if err!=nil{t.Fatal(err)}
	return Envelope{ChainID:420,EntryPoint:"0x1111111111111111111111111111111111111111",UserOpHash:h,UserOperation:op}
}
func post(t *testing.T,h http.Handler,env Envelope)*httptest.ResponseRecorder{
	t.Helper()
	raw,_:=json.Marshal(env)
	req:=httptest.NewRequest(http.MethodPost,"/peer/v1/user-operation",strings.NewReader(string(raw)))
	w:=httptest.NewRecorder();h.ServeHTTP(w,req);return w
}
func TestInboundPeerRequiresLocalValidation(t *testing.T){
	p:=&fakePool{}
	h,_:=NewHandler(420,"0x1111111111111111111111111111111111111111",fakeValidator{err:errors.New("reject")},p)
	w:=post(t,h,envelope(t,fixture()))
	if w.Code!=http.StatusUnprocessableEntity{t.Fatalf("status %d",w.Code)}
	if p.adds!=0{t.Fatal("peer bypassed local validation")}
}
func TestInboundPeerAdmitsOnlyMatchingDomainAndHash(t *testing.T){
	p:=&fakePool{}
	h,_:=NewHandler(420,"0x1111111111111111111111111111111111111111",fakeValidator{},p)
	env:=envelope(t,fixture())
	bad:=env;bad.ChainID=421
	if w:=post(t,h,bad);w.Code!=http.StatusConflict{t.Fatalf("wrong-domain status %d",w.Code)}
	bad=env;bad.UserOpHash="0x"+strings.Repeat("ff",32)
	if w:=post(t,h,bad);w.Code!=http.StatusBadRequest{t.Fatalf("wrong-hash status %d",w.Code)}
	if w:=post(t,h,env);w.Code!=http.StatusAccepted{t.Fatalf("valid status %d body=%s",w.Code,w.Body.String())}
	if p.adds!=1{t.Fatalf("unexpected admissions %d",p.adds)}
}
func TestPeerCapacityMapsTo429(t *testing.T){
	p:=&fakePool{err:mempool.ErrFull}
	h,_:=NewHandler(420,"0x1111111111111111111111111111111111111111",fakeValidator{},p)
	if w:=post(t,h,envelope(t,fixture()));w.Code!=http.StatusTooManyRequests{t.Fatalf("status %d",w.Code)}
}

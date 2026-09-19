package simulation

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/420integrated/420-integrated/bundler/userop"
)

type fakeSimulator struct {
	result Result
	err error
	entry string
	op userop.PackedUserOperation
}

func (f *fakeSimulator) SimulateHandleOp(_ context.Context,entry string,op userop.PackedUserOperation)(Result,error){
	f.entry=entry
	f.op=op
	return f.result,f.err
}

func simulationFixture() userop.PackedUserOperation {
	return userop.PackedUserOperation{
		Sender:"0x2222222222222222222222222222222222222222",
		Nonce:"0x5",InitCode:"0x",CallData:"0x1234",
		AccountGasLimits:"0x3333333333333333333333333333333333333333333333333333333333333333",
		PreVerificationGas:"0x5208",
		GasFees:"0x4444444444444444444444444444444444444444444444444444444444444444",
		PaymasterAndData:"0x",Signature:"0xaabb",
	}
}

func TestValidateAndSimulateProducesBoundEvidence(t *testing.T){
	now:=time.Date(2026,9,18,5,0,0,0,time.UTC)
	sim:=&fakeSimulator{result:Result{
		ExecutionSucceeded:true,
		Snapshot:Snapshot{BlockNumber:42,BlockHash:"0x"+strings.Repeat("ab",32),ObservedAt:now.Add(-time.Second)},
	}}
	engine,err:=NewEngine(420,"0x1111111111111111111111111111111111111111",2*time.Minute,sim)
	if err!=nil { t.Fatal(err) }
	evidence,err:=engine.ValidateAndSimulate(context.Background(),simulationFixture(),now)
	if err!=nil { t.Fatal(err) }
	expected,err:=userop.Hash(420,"0x1111111111111111111111111111111111111111",simulationFixture())
	if err!=nil { t.Fatal(err) }
	if evidence.UserOpHash!=expected { t.Fatalf("hash mismatch: %s != %s",evidence.UserOpHash,expected) }
	if evidence.BlockNumber!=42 || evidence.BlockHash!="0x"+strings.Repeat("ab",32) { t.Fatalf("snapshot mismatch: %+v",evidence) }
	if !evidence.ExecutionSucceeded { t.Fatal("successful simulation lost success evidence") }
}

func TestValidationFailsClosed(t *testing.T){
	now:=time.Date(2026,9,18,5,0,0,0,time.UTC)
	good:=Result{ExecutionSucceeded:true,Snapshot:Snapshot{BlockNumber:42,BlockHash:"0x"+strings.Repeat("ab",32),ObservedAt:now}}
	cases:=[]struct{name string; result Result; err error}{
		{"rpc-revert",Result{},errors.New("reverted")},
		{"execution-failure",Result{ExecutionSucceeded:false,Snapshot:good.Snapshot},nil},
		{"missing-block",Result{ExecutionSucceeded:true,Snapshot:Snapshot{BlockHash:good.Snapshot.BlockHash,ObservedAt:now}},nil},
		{"bad-block-hash",Result{ExecutionSucceeded:true,Snapshot:Snapshot{BlockNumber:42,BlockHash:"0x12",ObservedAt:now}},nil},
		{"stale",Result{ExecutionSucceeded:true,Snapshot:Snapshot{BlockNumber:42,BlockHash:good.Snapshot.BlockHash,ObservedAt:now.Add(-3*time.Minute)}},nil},
		{"future",Result{ExecutionSucceeded:true,Snapshot:Snapshot{BlockNumber:42,BlockHash:good.Snapshot.BlockHash,ObservedAt:now.Add(2*time.Second)}},nil},
	}
	for _,tc:=range cases {
		t.Run(tc.name,func(t *testing.T){
			sim:=&fakeSimulator{result:tc.result,err:tc.err}
			engine,_:=NewEngine(420,"0x1111111111111111111111111111111111111111",2*time.Minute,sim)
			if _,err:=engine.ValidateAndSimulate(context.Background(),simulationFixture(),now); err==nil { t.Fatal("expected rejection") }
		})
	}
}

func TestCanonicalFailureNeverCallsSimulator(t *testing.T){
	now:=time.Date(2026,9,18,5,0,0,0,time.UTC)
	sim:=&fakeSimulator{}
	engine,_:=NewEngine(420,"0x1111111111111111111111111111111111111111",time.Minute,sim)
	op:=simulationFixture()
	op.Nonce="0x05"
	if _,err:=engine.ValidateAndSimulate(context.Background(),op,now); err==nil { t.Fatal("expected malformed operation rejection") }
	if sim.entry!="" { t.Fatal("simulator called for malformed operation") }
}

func TestHandleOpEncodingAndResultDecoding(t *testing.T){
	raw,err:=EncodeHandleOp(simulationFixture())
	if err!=nil { t.Fatal(err) }
	if !strings.HasPrefix(raw,"0x9eec012b") { t.Fatalf("wrong handleOp selector: %s",raw[:10]) }
	if len(raw)<=10+64 { t.Fatal("encoded handleOp too short") }

	success:="0x"+strings.Repeat("0",63)+"1"+strings.Repeat("0",62)+"40"+strings.Repeat("0",64)
	ok,err:=DecodeHandleOpResult(success)
	if err!=nil || !ok { t.Fatalf("success decode failed: ok=%v err=%v",ok,err) }

	failure:="0x"+strings.Repeat("0",64)+strings.Repeat("0",62)+"40"+strings.Repeat("0",64)
	ok,err=DecodeHandleOpResult(failure)
	if err!=nil || ok { t.Fatalf("failure decode failed: ok=%v err=%v",ok,err) }
}

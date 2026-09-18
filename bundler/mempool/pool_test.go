package mempool

import (
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/420integrated/420-integrated/bundler/simulation"
	"github.com/420integrated/420-integrated/bundler/userop"
)

const testEntryPoint = "0x1111111111111111111111111111111111111111"

func fixture(nonce string,sender string) userop.PackedUserOperation {
	return userop.PackedUserOperation{
		Sender:sender,Nonce:nonce,InitCode:"0x",CallData:"0x1234",
		AccountGasLimits:"0x"+strings.Repeat("33",32),PreVerificationGas:"0x5208",
		GasFees:"0x"+strings.Repeat("44",32),PaymasterAndData:"0x",Signature:"0xaabb",
	}
}

func evidenceFor(t *testing.T,op userop.PackedUserOperation,now time.Time) simulation.Evidence {
	t.Helper()
	hash,err:=userop.Hash(420,testEntryPoint,op)
	if err!=nil { t.Fatal(err) }
	return simulation.Evidence{
		UserOpHash:hash,EntryPoint:testEntryPoint,
		ChainID:420,BlockNumber:42,BlockHash:"0x"+strings.Repeat("ab",32),
		ObservedAt:now,ExecutionSucceeded:true,
	}
}

func TestAdmissionDuplicateAndNonceConflict(t *testing.T){
	now:=time.Date(2026,9,18,20,0,0,0,time.UTC)
	pool,err:=New(Config{MaxOperations:4,MaxPerSender:2,TTL:time.Minute})
	if err!=nil { t.Fatal(err) }
	op:=fixture("0x1","0x2222222222222222222222222222222222222222")
	ev:=evidenceFor(t,op,now)
	first,err:=pool.Add(op,ev,now)
	if err!=nil || first.Duplicate { t.Fatalf("first add: %+v %v",first,err) }
	dupe,err:=pool.Add(op,ev,now.Add(time.Second))
	if err!=nil || !dupe.Duplicate { t.Fatalf("duplicate add: %+v %v",dupe,err) }
	if pool.Len(now)!=1 { t.Fatalf("duplicate increased pool size: %d",pool.Len(now)) }

	conflict:=op
	conflict.CallData="0x5678"
	_,err=pool.Add(conflict,evidenceFor(t,conflict,now),now.Add(2*time.Second))
	if !errors.Is(err,ErrNonceConflict) { t.Fatalf("expected nonce conflict, got %v",err) }
}

func TestBoundsAndTTL(t *testing.T){
	now:=time.Date(2026,9,18,20,0,0,0,time.UTC)
	pool,_:=New(Config{MaxOperations:2,MaxPerSender:1,TTL:time.Minute})
	senderA:="0x2222222222222222222222222222222222222222"
	senderB:="0x3333333333333333333333333333333333333333"
	senderC:="0x4444444444444444444444444444444444444444"

	opA1:=fixture("0x1",senderA)
	if _,err:=pool.Add(opA1,evidenceFor(t,opA1,now),now); err!=nil { t.Fatal(err) }
	opA2:=fixture("0x2",senderA)
	if _,err:=pool.Add(opA2,evidenceFor(t,opA2,now),now); !errors.Is(err,ErrSenderLimit) { t.Fatalf("expected sender bound, got %v",err) }
	opB:=fixture("0x1",senderB)
	if _,err:=pool.Add(opB,evidenceFor(t,opB,now),now); err!=nil { t.Fatal(err) }
	opC:=fixture("0x1",senderC)
	if _,err:=pool.Add(opC,evidenceFor(t,opC,now),now); !errors.Is(err,ErrFull) { t.Fatalf("expected full pool, got %v",err) }

	later:=now.Add(time.Minute+time.Second)
	if pool.Len(later)!=0 { t.Fatal("expired operations were not pruned") }
	if _,err:=pool.Add(opC,evidenceFor(t,opC,later),later); err!=nil { t.Fatalf("capacity not released after TTL: %v",err) }
}

func TestSnapshotIsDeterministicAndRetainsEvidence(t *testing.T){
	now:=time.Date(2026,9,18,20,0,0,0,time.UTC)
	pool,_:=New(Config{MaxOperations:4,MaxPerSender:2,TTL:time.Minute})
	opA:=fixture("0x1","0x2222222222222222222222222222222222222222")
	opB:=fixture("0x1","0x3333333333333333333333333333333333333333")
	evA:=evidenceFor(t,opA,now)
	evB:=evidenceFor(t,opB,now)
	_,_ = pool.Add(opA,evA,now)
	_,_ = pool.Add(opB,evB,now)

	items:=pool.Snapshot(now)
	if len(items)!=2 { t.Fatalf("snapshot len %d",len(items)) }
	expectedFirst:=evA.UserOpHash
	expectedSecond:=evB.UserOpHash
	if expectedSecond<expectedFirst { expectedFirst,expectedSecond=expectedSecond,expectedFirst }
	if items[0].Hash!=expectedFirst || items[1].Hash!=expectedSecond { t.Fatalf("same-time snapshot not hash deterministic: %+v",items) }
	if items[0].Evidence.BlockNumber!=42 || !items[0].Evidence.ExecutionSucceeded { t.Fatalf("simulation evidence not retained: %+v",items[0].Evidence) }
}

func TestAdmissionRequiresCanonicalOperationAndMatchingSuccessfulEvidence(t *testing.T){
	now:=time.Date(2026,9,18,20,0,0,0,time.UTC)
	pool,_:=New(Config{MaxOperations:2,MaxPerSender:2,TTL:time.Minute})
	op:=fixture("0x01","0x2222222222222222222222222222222222222222")
	if _,err:=pool.Add(op,simulation.Evidence{UserOpHash:"0x"+strings.Repeat("11",32),EntryPoint:testEntryPoint,ChainID:420,ExecutionSucceeded:true},now); err==nil { t.Fatal("malformed operation admitted") }

	op=fixture("0x1","0x2222222222222222222222222222222222222222")
	ev:=evidenceFor(t,op,now)
	ev.ExecutionSucceeded=false
	if _,err:=pool.Add(op,ev,now); err==nil { t.Fatal("failed simulation evidence admitted") }

	ev=evidenceFor(t,op,now)
	ev.UserOpHash="0x"+strings.Repeat("ff",32)
	if _,err:=pool.Add(op,ev,now); err==nil { t.Fatal("mismatched simulation evidence admitted") }
}

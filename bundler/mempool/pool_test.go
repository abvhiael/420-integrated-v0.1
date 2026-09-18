package mempool

import (
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/420integrated/420-integrated/bundler/simulation"
	"github.com/420integrated/420-integrated/bundler/userop"
)

func fixture(nonce string,sender string) userop.PackedUserOperation {
	return userop.PackedUserOperation{
		Sender:sender,Nonce:nonce,InitCode:"0x",CallData:"0x1234",
		AccountGasLimits:"0x"+strings.Repeat("33",32),PreVerificationGas:"0x5208",
		GasFees:"0x"+strings.Repeat("44",32),PaymasterAndData:"0x",Signature:"0xaabb",
	}
}

func evidence(hash string,now time.Time) simulation.Evidence {
	return simulation.Evidence{
		UserOpHash:hash,EntryPoint:"0x1111111111111111111111111111111111111111",
		ChainID:420,BlockNumber:42,BlockHash:"0x"+strings.Repeat("ab",32),
		ObservedAt:now,ExecutionSucceeded:true,
	}
}

func TestAdmissionDuplicateAndNonceConflict(t *testing.T){
	now:=time.Date(2026,9,18,20,0,0,0,time.UTC)
	pool,err:=New(Config{MaxOperations:4,MaxPerSender:2,TTL:time.Minute})
	if err!=nil { t.Fatal(err) }
	op:=fixture("0x1","0x2222222222222222222222222222222222222222")
	hash:="0x"+strings.Repeat("11",32)
	first,err:=pool.Add(op,evidence(hash,now),now)
	if err!=nil || first.Duplicate { t.Fatalf("first add: %+v %v",first,err) }
	dupe,err:=pool.Add(op,evidence(hash,now),now.Add(time.Second))
	if err!=nil || !dupe.Duplicate { t.Fatalf("duplicate add: %+v %v",dupe,err) }
	if pool.Len(now)!=1 { t.Fatalf("duplicate increased pool size: %d",pool.Len(now)) }

	conflict:=op
	conflict.CallData="0x5678"
	_,err=pool.Add(conflict,evidence("0x"+strings.Repeat("22",32),now),now.Add(2*time.Second))
	if !errors.Is(err,ErrNonceConflict) { t.Fatalf("expected nonce conflict, got %v",err) }
}

func TestBoundsAndTTL(t *testing.T){
	now:=time.Date(2026,9,18,20,0,0,0,time.UTC)
	pool,_:=New(Config{MaxOperations:2,MaxPerSender:1,TTL:time.Minute})
	senderA:="0x2222222222222222222222222222222222222222"
	senderB:="0x3333333333333333333333333333333333333333"
	senderC:="0x4444444444444444444444444444444444444444"

	if _,err:=pool.Add(fixture("0x1",senderA),evidence("0x"+strings.Repeat("11",32),now),now); err!=nil { t.Fatal(err) }
	if _,err:=pool.Add(fixture("0x2",senderA),evidence("0x"+strings.Repeat("12",32),now),now); !errors.Is(err,ErrSenderLimit) { t.Fatalf("expected sender bound, got %v",err) }
	if _,err:=pool.Add(fixture("0x1",senderB),evidence("0x"+strings.Repeat("22",32),now),now); err!=nil { t.Fatal(err) }
	if _,err:=pool.Add(fixture("0x1",senderC),evidence("0x"+strings.Repeat("33",32),now),now); !errors.Is(err,ErrFull) { t.Fatalf("expected full pool, got %v",err) }

	if pool.Len(now.Add(time.Minute+time.Second))!=0 { t.Fatal("expired operations were not pruned") }
	if _,err:=pool.Add(fixture("0x1",senderC),evidence("0x"+strings.Repeat("33",32),now),now.Add(time.Minute+time.Second)); err!=nil { t.Fatalf("capacity not released after TTL: %v",err) }
}

func TestSnapshotIsDeterministicAndRetainsEvidence(t *testing.T){
	now:=time.Date(2026,9,18,20,0,0,0,time.UTC)
	pool,_:=New(Config{MaxOperations:4,MaxPerSender:2,TTL:time.Minute})
	aHash:="0x"+strings.Repeat("aa",32)
	bHash:="0x"+strings.Repeat("bb",32)
	_,_ = pool.Add(fixture("0x1","0x2222222222222222222222222222222222222222"),evidence(bHash,now),now)
	_,_ = pool.Add(fixture("0x1","0x3333333333333333333333333333333333333333"),evidence(aHash,now),now)

	items:=pool.Snapshot(now)
	if len(items)!=2 { t.Fatalf("snapshot len %d",len(items)) }
	if items[0].Hash!=aHash || items[1].Hash!=bHash { t.Fatalf("same-time snapshot not hash deterministic: %+v",items) }
	if items[0].Evidence.BlockNumber!=42 || !items[0].Evidence.ExecutionSucceeded { t.Fatalf("simulation evidence not retained: %+v",items[0].Evidence) }
}

func TestAdmissionRequiresCanonicalOperationAndSuccessfulEvidence(t *testing.T){
	now:=time.Date(2026,9,18,20,0,0,0,time.UTC)
	pool,_:=New(Config{MaxOperations:2,MaxPerSender:2,TTL:time.Minute})
	op:=fixture("0x01","0x2222222222222222222222222222222222222222")
	if _,err:=pool.Add(op,evidence("0x"+strings.Repeat("11",32),now),now); err==nil { t.Fatal("malformed operation admitted") }

	op=fixture("0x1","0x2222222222222222222222222222222222222222")
	ev:=evidence("0x"+strings.Repeat("11",32),now)
	ev.ExecutionSucceeded=false
	if _,err:=pool.Add(op,ev,now); err==nil { t.Fatal("failed simulation evidence admitted") }
}

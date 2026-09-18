package bundle

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/420integrated/420-integrated/bundler/mempool"
	"github.com/420integrated/420-integrated/bundler/simulation"
	"github.com/420integrated/420-integrated/bundler/userop"
)

type fakePool struct {
	items []mempool.Entry
	removed []string
}
func (p *fakePool) Snapshot(time.Time) []mempool.Entry { return append([]mempool.Entry(nil),p.items...) }
func (p *fakePool) Remove(hash string) bool { p.removed=append(p.removed,hash); return true }

type fakeValidator struct { invalid map[string]bool }
func (v fakeValidator) ValidateAndSimulate(_ context.Context,op userop.PackedUserOperation,now time.Time)(simulation.Evidence,error){
	if v.invalid[op.Sender] { return simulation.Evidence{},errors.New("stale") }
	hash,err:=userop.Hash(420,"0x1111111111111111111111111111111111111111",op)
	if err!=nil { return simulation.Evidence{},err }
	return simulation.Evidence{UserOpHash:hash,EntryPoint:"0x1111111111111111111111111111111111111111",ChainID:420,ExecutionSucceeded:true,ObservedAt:now},nil
}

type fakeSubmitter struct {
	fails map[string]bool
	order []string
}
func (s *fakeSubmitter) Submit(_ context.Context,_ string,op userop.PackedUserOperation)(string,error){
	s.order=append(s.order,op.Sender)
	if s.fails[op.Sender] { return "",errors.New("send failed") }
	return "0x"+strings.Repeat("ab",32),nil
}

func op(sender,nonce string) userop.PackedUserOperation {
	return userop.PackedUserOperation{
		Sender:sender,Nonce:nonce,InitCode:"0x",CallData:"0x1234",
		AccountGasLimits:"0x"+strings.Repeat("33",32),PreVerificationGas:"0x5208",
		GasFees:"0x"+strings.Repeat("44",32),PaymasterAndData:"0x",Signature:"0xaabb",
	}
}

func entry(t *testing.T,operation userop.PackedUserOperation,at time.Time) mempool.Entry {
	t.Helper()
	hash,err:=userop.Hash(420,"0x1111111111111111111111111111111111111111",operation)
	if err!=nil { t.Fatal(err) }
	return mempool.Entry{Hash:hash,Operation:operation,AdmittedAt:at,ExpiresAt:at.Add(time.Minute)}
}

func TestSubmitNextPreservesSnapshotOrderAndBounds(t *testing.T){
	now:=time.Date(2026,9,18,21,0,0,0,time.UTC)
	a:=op("0x2222222222222222222222222222222222222222","0x1")
	b:=op("0x3333333333333333333333333333333333333333","0x1")
	c:=op("0x4444444444444444444444444444444444444444","0x1")
	pool:=&fakePool{items:[]mempool.Entry{entry(t,a,now),entry(t,b,now),entry(t,c,now)}}
	sub:=&fakeSubmitter{fails:map[string]bool{}}
	builder,err:=New(Config{EntryPoint:"0x1111111111111111111111111111111111111111",MaxOperations:2},pool,fakeValidator{invalid:map[string]bool{}},sub)
	if err!=nil { t.Fatal(err) }
	result,err:=builder.SubmitNext(context.Background(),now)
	if err!=nil { t.Fatal(err) }
	if result.Selected!=2 || len(result.Submitted)!=2 { t.Fatalf("unexpected result %+v",result) }
	if len(sub.order)!=2 || sub.order[0]!=a.Sender || sub.order[1]!=b.Sender { t.Fatalf("submission order changed: %v",sub.order) }
	if len(pool.removed)!=2 { t.Fatalf("submitted operations not removed: %v",pool.removed) }
}

func TestSubmitNextDropsInvalidButRetainsRPCFailure(t *testing.T){
	now:=time.Date(2026,9,18,21,0,0,0,time.UTC)
	a:=op("0x2222222222222222222222222222222222222222","0x1")
	b:=op("0x3333333333333333333333333333333333333333","0x1")
	pool:=&fakePool{items:[]mempool.Entry{entry(t,a,now),entry(t,b,now)}}
	sub:=&fakeSubmitter{fails:map[string]bool{b.Sender:true}}
	builder,_:=New(Config{EntryPoint:"0x1111111111111111111111111111111111111111",MaxOperations:4},pool,fakeValidator{invalid:map[string]bool{a.Sender:true}},sub)
	result,err:=builder.SubmitNext(context.Background(),now)
	if err!=nil { t.Fatal(err) }
	if len(result.Rejected)!=1 || result.Rejected[0]!=pool.items[0].Hash { t.Fatalf("invalid op not rejected: %+v",result) }
	if len(result.Failed)!=1 || result.Failed[0]!=pool.items[1].Hash { t.Fatalf("RPC failure not retained: %+v",result) }
	if len(pool.removed)!=1 || pool.removed[0]!=pool.items[0].Hash { t.Fatalf("failed submission was removed: %v",pool.removed) }
}

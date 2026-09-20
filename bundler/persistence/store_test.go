package persistence

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/420integrated/420-integrated/bundler/lifecycle"
	"github.com/420integrated/420-integrated/bundler/mempool"
	"github.com/420integrated/420-integrated/bundler/simulation"
	"github.com/420integrated/420-integrated/bundler/userop"
)

func testPool(t *testing.T)*mempool.Pool{
	t.Helper()
	p,err:=mempool.New(mempool.Config{MaxOperations:8,MaxPerSender:4,TTL:time.Hour,ReplacementBumpBps:1000})
	if err!=nil{t.Fatal(err)}
	return p
}
func testOp()userop.PackedUserOperation{
	return userop.PackedUserOperation{Sender:"0x2222222222222222222222222222222222222222",Nonce:"0x1",InitCode:"0x",CallData:"0x1234",AccountGasLimits:"0x"+strings.Repeat("33",32),PreVerificationGas:"0x5208",GasFees:"0x"+strings.Repeat("44",32),PaymasterAndData:"0x",Signature:"0xaabb"}
}

func TestPersistenceRoundTrip(t *testing.T){
	dir:=t.TempDir()
	now:=time.Date(2026,9,19,5,0,0,0,time.UTC)
	pool:=testPool(t); life:=lifecycle.NewStore()
	store,err:=Open(dir,pool,life,now);if err!=nil{t.Fatal(err)}
	op:=testOp()
	h,err:=userop.Hash(420,"0x1111111111111111111111111111111111111111",op);if err!=nil{t.Fatal(err)}
	ev:=simulation.Evidence{UserOpHash:h,EntryPoint:"0x1111111111111111111111111111111111111111",ChainID:420,ObservedAt:now,ExecutionSucceeded:true}
	if _,err:=store.Add(op,ev,now);err!=nil{t.Fatal(err)}
	if err:=store.BeginSubmission(h,"0x1111111111111111111111111111111111111111",now.Add(time.Second));err!=nil{t.Fatal(err)}
	tx:="0x"+strings.Repeat("ab",32)
	if err:=store.RecordSubmission(h,tx,"0x1111111111111111111111111111111111111111",now.Add(2*time.Second));err!=nil{t.Fatal(err)}
	if _,err:=os.Stat(filepath.Join(dir,"state.json"));err!=nil{t.Fatal(err)}
	if _,err:=os.Stat(filepath.Join(dir,"audit.jsonl"));err!=nil{t.Fatal(err)}

	pool2:=testPool(t); life2:=lifecycle.NewStore()
	store2,err:=Open(dir,pool2,life2,now.Add(3*time.Second));if err!=nil{t.Fatal(err)}
	if pool2.Len(now.Add(3*time.Second))!=1{t.Fatal("mempool state not restored")}
	sub,ok:=store2.LifecycleStore().Submission(h);if !ok || sub.TransactionHash!=tx{t.Fatalf("lifecycle state not restored: %+v %v",sub,ok)}
}

func TestRejectsCorruptStateAndAudit(t *testing.T){
	now:=time.Date(2026,9,19,5,0,0,0,time.UTC)
	dir:=t.TempDir()
	if err:=os.WriteFile(filepath.Join(dir,"state.json"),[]byte("{bad"),0o600);err!=nil{t.Fatal(err)}
	if _,err:=Open(dir,testPool(t),lifecycle.NewStore(),now);err==nil{t.Fatal("accepted corrupt state")}
	dir2:=t.TempDir()
	if err:=os.WriteFile(filepath.Join(dir2,"audit.jsonl"),[]byte("{\"version\":1,\"sequence\":2,\"time\":\"2026-09-19T05:00:00Z\",\"type\":\"x\"}\n"),0o600);err!=nil{t.Fatal(err)}
	if _,err:=Open(dir2,testPool(t),lifecycle.NewStore(),now);err==nil{t.Fatal("accepted invalid audit sequence")}
}

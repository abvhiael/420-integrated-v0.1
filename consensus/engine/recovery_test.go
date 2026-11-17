package engine

import (
 "context"
 "encoding/hex"
 "encoding/json"
 "errors"
 "fmt"
 "net/http"
 "net/http/httptest"
 "path/filepath"
 "strings"
 "testing"

 csys "github.com/420integrated/420-integrated/consensus/systemcall"
)

func recoveryHash(h [32]byte) Hash32{return Hash32("0x"+hex.EncodeToString(h[:]))}
type recoveryFixture struct{
 anchors map[string]csys.SequenceAnchor
 chain string
 fault string
}
func (f *recoveryFixture) client(t *testing.T)*Client{
 t.Helper()
 secret:=[]byte("0123456789abcdef0123456789abcdef")
 srv:=httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter,r *http.Request){
 verifyJWT(t,strings.TrimPrefix(r.Header.Get("Authorization"),"Bearer "),secret)
 var req struct{ID uint64; Method string; Params []json.RawMessage}
 if e:=json.NewDecoder(r.Body).Decode(&req);e!=nil{t.Error(e);return}
 var result any
 switch req.Method{
 case "eth_chainId":result=f.chain
 case "eth_getBlockByNumber":
 var number string;json.Unmarshal(req.Params[0],&number)
 if a,ok:=f.anchors[number];ok{result=map[string]any{"number":number,"hash":recoveryHash(a.BlockHash)}}
 case "eth_call":
 var call map[string]string;json.Unmarshal(req.Params[0],&call)
 var pin struct{BlockHash Hash32;RequireCanonical bool};json.Unmarshal(req.Params[1],&pin)
 if call["data"]!="0x3bc684e9"||call["to"]!="0x000000000000000000000000000000000000043c"||!pin.RequireCanonical{t.Error("incorrect gateway call or canonical pin")}
 for _,a:=range f.anchors{if recoveryHash(a.BlockHash)==pin.BlockHash{result=fmt.Sprintf("0x%064x",a.LastSequence)}}
 if f.fault=="malformed"{result="0x01"}
 if f.fault=="overflow"{result="0x"+strings.Repeat("f",64)}
 case "engine420_submitSystemCallsV1":
 var b SystemCallBatchV1;json.Unmarshal(req.Params[0],&b)
 status:="ACCEPTED";if f.fault=="stage"{status="INVALID"}
 result=SystemCallBatchStatusV1{Status:status,BatchRoot:b.BatchRoot}
 case "engine_newPayloadV3":
 var p ExecutionPayloadV3;json.Unmarshal(req.Params[0],&p)
 status:="VALID";if f.fault!=""{status=f.fault}
 result=PayloadStatusV1{Status:status,LatestValidHash:&p.BlockHash}
 default:t.Errorf("unexpected method %s",req.Method)
 }
 json.NewEncoder(w).Encode(map[string]any{"jsonrpc":"2.0","id":req.ID,"result":result})
 }))
 t.Cleanup(srv.Close)
 c,e:=NewClient(srv.URL,secret);if e!=nil{t.Fatal(e)}
 return c
}
func TestRecoveryRestartAndRejectedSettlement(t *testing.T){
 ctx:=context.Background()
 b:=testSystemBatch()
 p:=csys.SequenceAnchor{ChainID:420,ExecutionBlock:10,BlockHash:b.ParentHash}
 child:=csys.SequenceAnchor{ChainID:420,ExecutionBlock:11,BlockHash:[32]byte{99},LastSequence:1}
 f:=&recoveryFixture{chain:"0x1a4",anchors:map[string]csys.SequenceAnchor{"0xa":p}}
 c:=f.client(t)
 path:=filepath.Join(t.TempDir(),"seq.json")
 manager:=func()csys.SequenceManager{return csys.SequenceManager{Store:csys.FileSequenceStore{Path:path}}}
 m:=manager()
 if _,e:=c.RecoverVerifiedSequence(ctx,m,420,10,p.BlockHash);e!=nil{t.Fatal(e)}
 payload:=ExecutionPayloadV3{BlockNumber:"0xb",ParentHash:recoveryHash(p.BlockHash),BlockHash:recoveryHash(child.BlockHash),ExtraData:string(recoveryHash(b.Root()))}
 for _,fault:=range []string{"stage","INVALID","SYNCING","ACCEPTED"}{
 f.fault=fault
 if _,e:=c.NewPayloadV3WithSystemCalls(ctx,payload,nil,"",b,0);e==nil{t.Fatalf("accepted failure %s",fault)}
 if _,e:=m.RequireCanonicalParent(p);e!=nil{t.Fatal(e)}
 }
 f.fault=""
 status,e:=c.NewPayloadV3WithSystemCalls(ctx,payload,nil,"",b,0);if e!=nil{t.Fatal(e)}
 if _,e=c.CommitVerifiedSequence(ctx,m,p,child.BlockHash,b,status);e==nil{t.Fatal("noncanonical child committed")}
 // Execution has accepted and canonicalized child; crash before journal commit.
 f.anchors["0xb"]=child
 for _,mode:=range []string{"consensus","execution","both"}{t.Run(mode,func(t *testing.T){
  if e:=m.RecoverCanonicalParent(p);e!=nil{t.Fatal(e)}
  restarted:=m;client:=c
  if mode!="execution"{restarted=manager()}
  if mode!="consensus"{client=f.client(t)}
  if _,e:=restarted.RequireCanonicalParent(child);!errors.Is(e,csys.ErrSequenceRecoveryRequired){t.Fatalf("stale cursor: %v",e)}
  got,e:=client.RecoverVerifiedSequence(ctx,restarted,420,11,child.BlockHash);if e!=nil||got!=child{t.Fatalf("recover %v %v",got,e)}
  if _,e=client.CommitVerifiedSequence(ctx,restarted,p,child.BlockHash,b,status);e==nil{t.Fatal("duplicate commit")}
 })}
 // Divergent gateway sequence never advances the journal.
 if e:=m.RecoverCanonicalParent(p);e!=nil{t.Fatal(e)}
 wrong:=child;wrong.LastSequence=2;f.anchors["0xb"]=wrong
 if _,e=c.CommitVerifiedSequence(ctx,m,p,child.BlockHash,b,status);e==nil{t.Fatal("divergent sequence committed")}
 if _,e=m.RequireCanonicalParent(p);e!=nil{t.Fatal(e)}
 f.anchors["0xb"]=child
 if got,e:=c.CommitVerifiedSequence(ctx,m,p,child.BlockHash,b,status);e!=nil||got!=child{t.Fatalf("commit %v %v",got,e)}
 // Canonical replacement requires an independently selected replacement hash.
 alternate:=child;alternate.BlockHash=[32]byte{100};alternate.LastSequence=0
 f.anchors["0xb"]=alternate
 if _,e=c.RecoverVerifiedSequence(ctx,m,420,11,child.BlockHash);e==nil{t.Fatal("orphan recovered")}
 if got,e:=c.RecoverVerifiedSequence(ctx,m,420,11,alternate.BlockHash);e!=nil||got!=alternate{t.Fatalf("replacement %v %v",got,e)}
 for _,fault:=range []string{"malformed","overflow"}{f.fault=fault;if _,e=c.RecoverVerifiedSequence(ctx,m,420,11,alternate.BlockHash);e==nil{t.Fatal("bad gateway word accepted")}}
 f.fault="";f.chain="0x1a5"
 if _,e=c.RecoverVerifiedSequence(ctx,m,420,11,alternate.BlockHash);e==nil{t.Fatal("wrong chain accepted")}
 if _,e=m.RequireCanonicalParent(alternate);e!=nil{t.Fatal(e)}
}

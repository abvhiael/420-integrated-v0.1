package account

import (
 "context"
 "encoding/hex"
 "encoding/json"
 "fmt"
 "net/http"
 "net/http/httptest"
 "strings"
 "testing"
 "time"
)
func abiTestWordUint(n uint64)[]byte{
 b:=make([]byte,32);for i:=0;i<8;i++{b[31-i]=byte(n>>(8*i))};return b
}
func abiTestWordAddr(a string)[]byte{
 b,_:=walletHexBytes(a);v:=make([]byte,32);copy(v[12:],b);return v
}
func abiTestWordHash(s string)[]byte{b,_:=walletHexBytes(s);return b}
func abiTestTuple(words ...[]byte)string{
 var b []byte;for _,w:=range words{b=append(b,w...)}
 return "0x"+hex.EncodeToString(b)
}
func TestIdentityNamesFinalizedRPCAndBilateralBinding(t *testing.T){
 wallet:="0x"+strings.Repeat("a",40)
 identity:="0x"+strings.Repeat("1",40)
 names:="0x"+strings.Repeat("2",40)
 profile:="0x"+strings.Repeat("3",64)
 label:="0x"+strings.Repeat("4",64)
 blockHash:="0x"+strings.Repeat("5",64)
 identityCode:="0x60016001";namesCode:="0x60026002"
 hashCode:=func(raw string)string{b,_:=walletHexBytes(raw);d:=walletKeccak(b);return "0x"+hex.EncodeToString(d[:])}
 now:=time.Now().UTC().Truncate(time.Second)
 expiry:=uint64(now.Add(time.Hour).Unix())
 controller:=wallet
 active:=true
 primary:=label
 nameProfile:=profile
 forward:=wallet
 reverse:=label
 claim:=true
 chain:="0x1a4"
 stale:=false
 wrongCode:=false
 calls:=0
 server:=httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter,r *http.Request){
  calls++
  var req struct{JSONRPC string `json:"jsonrpc"`;ID int `json:"id"`;Method string `json:"method"`;Params []json.RawMessage `json:"params"`}
  if r.Method!="POST"||json.NewDecoder(r.Body).Decode(&req)!=nil||req.JSONRPC!="2.0"||req.ID!=1{t.Error("malformed RPC");w.WriteHeader(400);return}
  var result any
  switch req.Method {
  case "eth_chainId":result=chain
  case "eth_getBlockByNumber":
   if len(req.Params)!=2||string(req.Params[0])!=`"finalized"`{t.Error("unfinalized tag")}
   ts:=now.Unix();if stale{ts-=3600}
   result=map[string]string{"number":"0x100","hash":blockHash,"timestamp":fmt.Sprintf("0x%x",ts)}
  case "eth_getCode","eth_call":
   if len(req.Params)!=2{t.Error("missing block ref")}
   var block map[string]any;if json.Unmarshal(req.Params[1],&block)!=nil||block["blockHash"]!=blockHash||block["requireCanonical"]!=true{t.Error("unpinned block hash")}
   var op map[string]string;_ = json.Unmarshal(req.Params[0],&op)
   to:=op["to"]
   if req.Method=="eth_getCode"{
    if json.Unmarshal(req.Params[0],&to)!=nil{t.Error("no address")}
    if to==identity {result=identityCode;if wrongCode{result="0x6001"}}else if to==names{result=namesCode}else{t.Error("unrecognized address");result="0x"}
    break
   }
   data:=op["data"];if len(data)<10{t.Error("no ABI selector");result="0x";break}
   selector:=data[:10]
   match:=func(method string)bool{return selector=="0x"+hex.EncodeToString(abiSelector(method))}
   switch{
   case match("protocolVersion()"):result=abiTestTuple(abiTestWordUint(3))
   case to==identity&&match("profiles(bytes32)"):
    yes:=uint64(0);if active{yes=1}
    result=abiTestTuple(abiTestWordAddr(controller),abiTestWordAddr("0x"+strings.Repeat("0",40)),abiTestWordHash(zero32),abiTestWordHash(primary),abiTestWordUint(1),abiTestWordUint(1),abiTestWordUint(yes))
   case to==names&&match("resolve(bytes32)"):
    result=abiTestTuple(abiTestWordAddr(wallet),abiTestWordAddr("0x"+strings.Repeat("0",40)),abiTestWordAddr(forward),abiTestWordHash(nameProfile),abiTestWordHash(zero32),abiTestWordUint(expiry),abiTestWordUint(5))
   case to==names&&match("reverseResolve(address)"):
    result=abiTestTuple(abiTestWordHash(reverse))
   case to==names&&match("nameClaimsProfile(bytes32,bytes32)"):
    yes:=uint64(0);if claim{yes=1};result=abiTestTuple(abiTestWordUint(yes))
   case to==identity&&match("hasValidCredential(bytes32,bytes32)"):
    result=abiTestTuple(abiTestWordUint(1))
   default:t.Error("unexpected ABI selector",selector);result="0x"
   }
  default:t.Error("unexpected RPC method",req.Method);result=nil
  }
  w.Header().Set("Content-Type","application/json")
  _=json.NewEncoder(w).Encode(map[string]any{"jsonrpc":"2.0","id":1,"result":result})
 }))
 defer server.Close()
 rpc,e:=NewIdentityNamesRPC(server.URL,420,identity,hashCode(identityCode),names,hashCode(namesCode),server.Client())
 if e!=nil{t.Fatal("valid pinned verifier rejected",e)}
 ctx:=context.Background()
 identityOnly,e:=rpc.Verify(ctx,420,wallet,profile,"")
 if e!=nil||!identityOnly.IdentityActive||identityOnly.BilateralNameVerified||identityOnly.NameLabelHash!=""{t.Fatal("identity-only proof",identityOnly,e)}
 both,e:=rpc.Verify(ctx,420,wallet,profile,label)
 if e!=nil||!both.BilateralNameVerified||both.FinalizedBlockHash!=blockHash||both.WalletAddress!=wallet{t.Fatal("bilateral proof",both,e)}
 if ok,e:=rpc.ValidCredential(ctx,420,wallet,profile,"0x"+strings.Repeat("8",64));e!=nil||!ok{t.Fatal("fresh credential view",ok,e)}
 if calls<20{t.Fatal("missing mandatory chain checks",calls)}
 checkFail:=func(name string){t.Helper();if v,e:=rpc.Verify(ctx,420,wallet,profile,label);e==nil{t.Fatalf("%s accepted: %+v",name,v)}}
 controller="0x"+strings.Repeat("b",40);checkFail("wrong controller")
 if ok,e:=rpc.ValidCredential(ctx,420,wallet,profile,"0x"+strings.Repeat("8",64));ok||e==nil{t.Fatal("credential read accepted changed Identity controller")}
 controller=wallet
 active=false;checkFail("inactive identity");active=true
 primary=zero32;checkFail("one-sided identity binding");primary=label
 nameProfile=zero32;checkFail("one-sided names binding");nameProfile=profile
 forward="0x"+strings.Repeat("b",40);checkFail("wrong forward target");forward=wallet
 reverse=zero32;checkFail("missing reverse agreement");reverse=label
 claim=false;checkFail("nameClaimsProfile false");claim=true
 expiry=uint64(now.Add(-time.Second).Unix());checkFail("expired name");expiry=uint64(now.Add(time.Hour).Unix())
 wrongCode=true;checkFail("codehash mismatch");wrongCode=false
 chain="0x1a5";checkFail("wrong RPC chain");chain="0x1a4"
 stale=true;checkFail("stale finalized head");stale=false
 if _,e=rpc.Verify(ctx,421,wallet,profile,label);e==nil{t.Fatal("cross-chain accept")}
 if _,e=rpc.Verify(ctx,420,wallet,zero32,label);e==nil{t.Fatal("zero profile accept")}
 if _,e=NewIdentityNamesRPC("http://localhost:8545",420,identity,hashCode(identityCode),names,hashCode(namesCode),nil);e==nil{t.Fatal("unencrypted RPC accepted")}
 if _,e=NewIdentityNamesRPC(server.URL,420,identity,hashCode(identityCode),identity,hashCode(namesCode),server.Client());e==nil{t.Fatal("aliased contracts accepted")}
 if _,e=NewIdentityNamesRPC(server.URL,420,identity,zero32,names,hashCode(namesCode),server.Client());e==nil{t.Fatal("zero code identity accepted")}
 untrusted,_:=NewIdentityNamesRPC(server.URL,420,identity,hashCode(identityCode),names,hashCode(namesCode),nil)
 if _,e=untrusted.Verify(ctx,420,wallet,profile,label);e==nil{t.Fatal("untrusted TLS accepted")}
}
func TestIdentityNamesStrictABIAndInput(t *testing.T){
 for _,item:=range []string{"",zero32,"0x1","0X"+strings.Repeat("a",64),"0x"+strings.Repeat("x",64)}{
  if _,e:=canonicalBytes32(item,false);e==nil{t.Fatal("invalid profile id",item)}
 }
 if _,e:=canonicalBytes32("",true);e!=nil{t.Fatal("empty optional hash rejected")}
 if v,e:=canonicalBytes32("0x"+strings.Repeat("A",64),false);e!=nil||v!="0x"+strings.Repeat("a",64){t.Fatal("canonicalization",e)}
 if _,e:=wordBool(abiTestWordUint(2));e==nil{t.Fatal("noncanonical bool accepted")}
 if _,e:=wordUint64(append([]byte{1},make([]byte,31)...));e==nil{t.Fatal("oversized uint accepted")}
 if _,e:=wordAddress(append([]byte{1},make([]byte,31)...));e==nil{t.Fatal("noncanonical address accepted")}
 if _,e:=rpcWords("0xdeadbeef",7);e==nil{t.Fatal("malformed tuple accepted")}
 if _,e:=abiCall("profiles(bytes32)","0xdeadbeef");e==nil{t.Fatal("malformed ABI input accepted")}
}

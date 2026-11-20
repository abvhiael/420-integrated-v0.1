package account
import (
 "context"
 "encoding/hex"
 "encoding/json"
 "errors"
 "fmt"
 "net/http"
 "net/http/httptest"
 "strings"
 "testing"
 "time"
)
func TestEIP1271FinalizedChainVerifier(t *testing.T){
 address:="0x"+strings.Repeat("a",40);message:="420ID Optional Wallet Link";sig:="0x"+strings.Repeat("1",130)
 digest:=walletMessageDigest(message)
 chain,code,magic:="0x1a4","0x6001600155","0x1626ba7e"+strings.Repeat("0",56)
 calls:=[]string{}
 server:=httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter,r *http.Request){
  if r.Method!="POST"{t.Error("wrong RPC verb");w.WriteHeader(405);return}
  var req struct{JSONRPC string `json:"jsonrpc"`;ID int `json:"id"`;Method string `json:"method"`;Params []json.RawMessage `json:"params"`}
  if json.NewDecoder(r.Body).Decode(&req)!=nil||req.JSONRPC!="2.0"||req.ID!=1{t.Error("RPC envelope");w.WriteHeader(400);return}
  calls=append(calls,req.Method)
  var result string
  switch req.Method{
  case "eth_chainId":result=chain
  case "eth_getCode":
   if len(req.Params)!=2||string(req.Params[1])!="\"finalized\""{t.Error("RPC getCode not finalized")}
   result=code
  case "eth_call":
   if len(req.Params)!=2||string(req.Params[1])!="\"finalized\""{t.Error("RPC eth_call not finalized")}
   var p map[string]string
   if json.Unmarshal(req.Params[0],&p)!=nil||p["to"]!=address{t.Error("RPC address mismatch")}
   input,e:=walletHexBytes(p["data"])
   if e!=nil||len(input)<165||hex.EncodeToString(input[:4])!="1626ba7e"||hex.EncodeToString(input[4:36])!=hex.EncodeToString(digest[:]){t.Error("invalid EIP-1271 ABI")}
   result=magic
  default:t.Error("unexpected method",req.Method);w.WriteHeader(400);return
  }
  w.Header().Set("Content-Type","application/json")
  fmt.Fprintf(w,`{"jsonrpc":"2.0","id":1,"result":%q}`,result)
 }))
 defer server.Close()
 v,e:=NewWallet1271RPC(server.URL,420,server.Client());if e!=nil{t.Fatal(e)}
 ctx,cancel:=context.WithTimeout(context.Background(),5*time.Second);defer cancel()
 ok,e:=v.VerifyContractSignature(ctx,420,address,message,sig)
 if e!=nil||!ok||strings.Join(calls,",")!="eth_chainId,eth_getCode,eth_call"{t.Fatal("valid 1271 finalized proof denied",ok,e,calls)}
 if ok,e=v.VerifyContractSignature(ctx,421,address,message,sig);ok||!errors.Is(e,ErrUnavailable){t.Fatal("wrong configured chain accepted",ok,e)}
 chain="0x1a5";if ok,_=v.VerifyContractSignature(ctx,420,address,message,sig);ok{t.Fatal("wrong RPC chain accepted")}
 chain="0x1a4";code="0x";if ok,_=v.VerifyContractSignature(ctx,420,address,message,sig);ok{t.Fatal("no deployed contract accepted")}
 code="0x6001600155";magic="0x00000000"+strings.Repeat("0",56)
 if ok,_=v.VerifyContractSignature(ctx,420,address,message,sig);ok{t.Fatal("invalid 1271 magic accepted")}
 if _,e=NewWallet1271RPC("http://127.0.0.1:8545",420,nil);e==nil{t.Fatal("insecure RPC accepted")}
 if _,e=NewWallet1271RPC("https://user:secret@rpc.example.org",420,nil);e==nil{t.Fatal("embedded credentials accepted")}
 untrusted,e:=NewWallet1271RPC(server.URL,420,nil);if e!=nil{t.Fatal(e)}
 if ok,_=untrusted.VerifyContractSignature(ctx,420,address,message,sig);ok{t.Fatal("untrusted certificate accepted")}
}

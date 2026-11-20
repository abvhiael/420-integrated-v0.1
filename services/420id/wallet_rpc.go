package account

import (
 "bytes"
 "context"
 "encoding/hex"
 "encoding/json"
 "errors"
 "io"
 "net/http"
 "net/url"
 "strconv"
 "strings"
 "time"
)

// Wallet1271RPC verifies contract-wallet signatures using the actual pinned
// EVM chain at a finalized block. Unavailable finality, missing code, wrong
// chain, bad magic, invalid JSON or TLS failure always deny. No EOA fallback.
type Wallet1271RPC struct{
 endpoint string
 chainID int64
 client *http.Client
}
func NewWallet1271RPC(raw string,chainID int64,client *http.Client)(*Wallet1271RPC,error){
 u,e:=url.Parse(raw)
 if e!=nil||chainID<=0||u.Scheme!="https"||u.Host==""||u.User!=nil||u.Fragment!=""||u.RawQuery!=""||u.ForceQuery||u.Hostname()==""{return nil,ErrInvalid}
 if client==nil{client=&http.Client{Timeout:4*time.Second}}
 clone:=*client
 clone.CheckRedirect=func(_ *http.Request,_ []*http.Request)error{return errors.New("redirect rejected")}
 return &Wallet1271RPC{endpoint:raw,chainID:chainID,client:&clone},nil
}
func (r *Wallet1271RPC) call(ctx context.Context,method string,params any)(string,error){
 body,e:=json.Marshal(map[string]any{"jsonrpc":"2.0","id":1,"method":method,"params":params});if e!=nil{return "",ErrUnavailable}
 req,e:=http.NewRequestWithContext(ctx,"POST",r.endpoint,bytes.NewReader(body));if e!=nil{return "",ErrUnavailable}
 req.Header.Set("Content-Type","application/json")
 response,e:=r.client.Do(req);if e!=nil{return "",ErrUnavailable}
 defer response.Body.Close()
 if response.StatusCode!=200||!strings.HasPrefix(response.Header.Get("Content-Type"),"application/json"){return "",ErrUnavailable}
 raw,e:=io.ReadAll(io.LimitReader(response.Body,16385));if e!=nil||len(raw)>16384{return "",ErrUnavailable}
 var result struct{
  JSONRPC string `json:"jsonrpc"`
  ID int `json:"id"`
  Result *string `json:"result"`
  Error json.RawMessage `json:"error"`
 }
 decoder:=json.NewDecoder(bytes.NewReader(raw));decoder.DisallowUnknownFields()
 if decoder.Decode(&result)!=nil||result.JSONRPC!="2.0"||result.ID!=1||result.Result==nil||len(result.Error)!=0&&string(result.Error)!="null"{return "",ErrUnavailable}
 if _,e=decoder.Token();e!=io.EOF{return "",ErrUnavailable}
 return *result.Result,nil
}
func walletHexBytes(raw string)([]byte,error){
 if !strings.HasPrefix(raw,"0x")||len(raw)%2!=0{return nil,ErrInvalid}
 result,e:=hex.DecodeString(raw[2:]);if e!=nil{return nil,ErrInvalid}
 return result,nil
}
func wallet1271CallData(message,signature string)(string,error){
 sig,e:=walletHexBytes(signature)
 if e!=nil||len(sig)<65||len(sig)>2048{return "",ErrInvalid}
 digest:=walletMessageDigest(message)
 // isValidSignature(bytes32,bytes): selector, digest, bytes offset (0x40),
 // bytes length, then ABI padded bytes.
 data:=make([]byte,4+32+32+32+((len(sig)+31)/32)*32)
 copy(data[:4],[]byte{0x16,0x26,0xba,0x7e})
 copy(data[4:36],digest[:])
 data[67]=0x40
 n:=len(sig)
 data[96]=byte(n>>24);data[97]=byte(n>>16);data[98]=byte(n>>8);data[99]=byte(n)
 copy(data[100:],sig)
 return "0x"+hex.EncodeToString(data),nil
}
func (r *Wallet1271RPC) VerifyContractSignature(ctx context.Context,chainID int64,address,message,signature string)(bool,error){
 if r==nil||chainID!=r.chainID{return false,ErrUnavailable}
 canonical,e:=canonicalWalletAddress(address)
 if e!=nil||canonical!=address||!validWalletSignature("contract",signature){return false,ErrInvalid}
 chain,e:=r.call(ctx,"eth_chainId",[]any{});if e!=nil{return false,e}
 expected:="0x"+strconv.FormatInt(chainID,16)
 if !strings.EqualFold(chain,expected){return false,ErrUnavailable}
 code,e:=r.call(ctx,"eth_getCode",[]any{address,"finalized"});if e!=nil{return false,e}
 decoded,e:=walletHexBytes(code);if e!=nil||len(decoded)==0{return false,ErrUnavailable}
 data,e:=wallet1271CallData(message,signature);if e!=nil{return false,e}
 response,e:=r.call(ctx,"eth_call",[]any{map[string]string{"to":address,"data":data},"finalized"})
 if e!=nil{return false,e}
 out,e:=walletHexBytes(response)
 if e!=nil||len(out)!=32{return false,ErrUnavailable}
 if !bytes.Equal(out[:4],[]byte{0x16,0x26,0xba,0x7e}){return false,nil}
 for _,b:=range out[4:]{if b!=0{return false,ErrUnavailable}}
 return true,nil
}

package account

import (
 "bytes"
 "context"
 "encoding/hex"
 "encoding/json"
 "io"
 "net/http"
 "strconv"
 "strings"
 "time"
)

// IdentityNamesRPC is a chain-pinned, code-hash-pinned read-only consumer of
// the deployed v3 Identity420 and Names420 contract interfaces. Every read
// uses the SAME canonical finalized block hash (EIP-1898). Inconsistent,
// stale, unsupported or unfinalized RPC responses fail closed.
type IdentityNamesRPC struct{
 rpc *Wallet1271RPC
 identity,identityHash string
 names,namesHash string
 now func()time.Time
}
func NewIdentityNamesRPC(endpoint string,chainID int64,identityAddr,identityCodeHash,namesAddr,namesCodeHash string,client *http.Client)(*IdentityNamesRPC,error){
 rpc,e:=NewWallet1271RPC(endpoint,chainID,client);if e!=nil{return nil,e}
 identity,e:=canonicalWalletAddress(identityAddr);if e!=nil||identity!=identityAddr{return nil,ErrInvalid}
 names,e:=canonicalWalletAddress(namesAddr);if e!=nil||names!=namesAddr||names==identity{return nil,ErrInvalid}
 ih,e:=canonicalBytes32(identityCodeHash,false);if e!=nil||ih!=identityCodeHash{return nil,ErrInvalid}
 nh,e:=canonicalBytes32(namesCodeHash,false);if e!=nil||nh!=namesCodeHash{return nil,ErrInvalid}
 return &IdentityNamesRPC{rpc:rpc,identity:identity,identityHash:ih,names:names,namesHash:nh,now:time.Now},nil
}

type finalizedIdentityBlock struct{
 hash string
 timestamp time.Time
}
func (p *IdentityNamesRPC) finalized(ctx context.Context)(finalizedIdentityBlock,error){
 var none finalizedIdentityBlock
 body,_:=json.Marshal(map[string]any{"jsonrpc":"2.0","id":1,"method":"eth_getBlockByNumber","params":[]any{"finalized",false}})
 req,e:=http.NewRequestWithContext(ctx,"POST",p.rpc.endpoint,bytes.NewReader(body));if e!=nil{return none,ErrUnavailable}
 req.Header.Set("Content-Type","application/json")
 res,e:=p.rpc.client.Do(req);if e!=nil{return none,ErrUnavailable};defer res.Body.Close()
 if res.StatusCode!=200||!strings.HasPrefix(res.Header.Get("Content-Type"),"application/json"){return none,ErrUnavailable}
 raw,e:=io.ReadAll(io.LimitReader(res.Body,16385));if e!=nil||len(raw)>16384{return none,ErrUnavailable}
 var envelope struct{
  JSONRPC string `json:"jsonrpc"`
  ID int `json:"id"`
  Result json.RawMessage `json:"result"`
  Error json.RawMessage `json:"error"`
 }
 dec:=json.NewDecoder(bytes.NewReader(raw));dec.DisallowUnknownFields()
 if dec.Decode(&envelope)!=nil||dec.Decode(&struct{}{})!=io.EOF||envelope.JSONRPC!="2.0"||envelope.ID!=1||
  len(envelope.Result)==0||bytes.Equal(envelope.Result,[]byte("null"))||
  len(envelope.Error)>0&&!bytes.Equal(envelope.Error,[]byte("null")){return none,ErrUnavailable}
 var block struct{
  Hash string `json:"hash"`
  Number string `json:"number"`
  Timestamp string `json:"timestamp"`
 }
 // Most EVM blocks contain additional fields; decode only needed fields
 // and reject malformed/nullable/oversized values, not legitimate metadata.
 if json.Unmarshal(envelope.Result,&block)!=nil{return none,ErrUnavailable}
 if block.Hash==zero32||!bytes32Hex.MatchString(block.Hash){return none,ErrUnavailable}
 number,e:=parseHexQuantity(block.Number);if e!=nil||number==0{return none,ErrUnavailable}
 unix,e:=parseHexQuantity(block.Timestamp);if e!=nil||unix==0||unix>uint64(1<<63-1){return none,ErrUnavailable}
 stamp:=time.Unix(int64(unix),0).UTC()
 now:=p.now()
 if stamp.After(now.Add(30*time.Second))||stamp.Before(now.Add(-30*time.Minute)){return none,ErrUnavailable}
 return finalizedIdentityBlock{hash:block.Hash,timestamp:stamp},nil
}
func parseHexQuantity(s string)(uint64,error){
 if len(s)<3||!strings.HasPrefix(s,"0x")||s[2]=='0'&&len(s)>3{return 0,ErrUnavailable}
 return strconv.ParseUint(s[2:],16,64)
}
func rpcWord(s string)([]byte,error){
 b,e:=walletHexBytes(s);if e!=nil||len(b)!=32{return nil,ErrUnavailable};return b,nil
}
func rpcWords(s string,n int)([][]byte,error){
 b,e:=walletHexBytes(s);if e!=nil||len(b)!=32*n{return nil,ErrUnavailable}
 out:=make([][]byte,n);for i:=range out{out[i]=b[i*32:(i+1)*32]};return out,nil
}
func abiSelector(method string)[]byte{digest:=walletKeccak([]byte(method));return digest[:4]}
func abiCall(method string,values ...string)(string,error){
 data:=append([]byte{},abiSelector(method)...)
 for _,v:=range values{
  switch len(v){
  case 66:
   b,e:=walletHexBytes(v);if e!=nil||len(b)!=32{return "",ErrInvalid}
   data=append(data,b...)
  case 42:
   b,e:=walletHexBytes(v);if e!=nil||len(b)!=20{return "",ErrInvalid}
   data=append(data,make([]byte,12)...);data=append(data,b...)
  default:return "",ErrInvalid
  }
 }
 return "0x"+hex.EncodeToString(data),nil
}
func wordAddress(w []byte)(string,error){
 if len(w)!=32||!bytes.Equal(w[:12],make([]byte,12)){return "",ErrUnavailable}
 return "0x"+hex.EncodeToString(w[12:]),nil
}
func wordHash(w []byte)string{return "0x"+hex.EncodeToString(w)}
func wordUint64(w []byte)(uint64,error){
 if len(w)!=32||!bytes.Equal(w[:24],make([]byte,24)){return 0,ErrUnavailable}
 return uint64(w[24])<<56|uint64(w[25])<<48|uint64(w[26])<<40|uint64(w[27])<<32|uint64(w[28])<<24|uint64(w[29])<<16|uint64(w[30])<<8|uint64(w[31]),nil
}
func wordBool(w []byte)(bool,error){
 n,e:=wordUint64(w);if e!=nil||n>1{return false,ErrUnavailable};return n==1,nil
}
func (p *IdentityNamesRPC) call(ctx context.Context,addr,method string,block finalizedIdentityBlock,words int,values ...string)([][]byte,error){
 input,e:=abiCall(method,values...);if e!=nil{return nil,e}
 out,e:=p.rpc.call(ctx,"eth_call",[]any{map[string]string{"to":addr,"data":input},map[string]any{"blockHash":block.hash,"requireCanonical":true}})
 if e!=nil{return nil,ErrUnavailable}
 return rpcWords(out,words)
}
func (p *IdentityNamesRPC) preflight(ctx context.Context,chain int64)(finalizedIdentityBlock,error){
 if p==nil||chain!=p.rpc.chainID{return finalizedIdentityBlock{},ErrUnavailable}
 id,e:=p.rpc.call(ctx,"eth_chainId",[]any{});if e!=nil{return finalizedIdentityBlock{},ErrUnavailable}
 numeric,e:=parseHexQuantity(id);if e!=nil||numeric!=uint64(chain){return finalizedIdentityBlock{},ErrUnavailable}
 block,e:=p.finalized(ctx);if e!=nil{return block,e}
 for _,pair:=range [][2]string{{p.identity,p.identityHash},{p.names,p.namesHash}}{
  code,e:=p.rpc.call(ctx,"eth_getCode",[]any{pair[0],map[string]any{"blockHash":block.hash,"requireCanonical":true}})
  if e!=nil{return block,ErrUnavailable}
  raw,e:=walletHexBytes(code);if e!=nil||len(raw)==0||len(raw)>65536{return block,ErrUnavailable}
  digest:=walletKeccak(raw)
  if "0x"+hex.EncodeToString(digest[:])!=pair[1]{return block,ErrUnavailable}
  version,e:=p.call(ctx,pair[0],"protocolVersion()",block,1)
  if e!=nil{return block,e}
  v,e:=wordUint64(version[0]);if e!=nil||v!=3{return block,ErrUnavailable}
 }
 return block,nil
}
func (p *IdentityNamesRPC) Verify(ctx context.Context,chain int64,wallet,profileID,labelHash string)(OnChainIdentityDisplay,error){
 var empty OnChainIdentityDisplay
 addr,e:=canonicalWalletAddress(wallet)
 if e!=nil||addr!=wallet{return empty,ErrInvalid}
 profile,e:=canonicalBytes32(profileID,false);if e!=nil||profile!=profileID{return empty,ErrInvalid}
 label,e:=canonicalBytes32(labelHash,true);if e!=nil||label!=labelHash{return empty,ErrInvalid}
 block,e:=p.preflight(ctx,chain);if e!=nil{return empty,e}
 raw,e:=p.call(ctx,p.identity,"profiles(bytes32)",block,7,profile);if e!=nil{return empty,e}
 controller,e:=wordAddress(raw[0]);if e!=nil||controller!=addr{return empty,ErrAuthentication}
 active,e:=wordBool(raw[6]);if e!=nil{return empty,e}
 if !active{return empty,ErrAuthentication}
 result:=OnChainIdentityDisplay{IdentityProfileID:profile,NameLabelHash:label,ChainID:chain,WalletAddress:addr,IdentityActive:true,FinalizedBlockHash:block.hash,VerifiedAt:block.timestamp}
 if label==""{return result,nil}
 if wordHash(raw[3])!=label{return empty,ErrAuthentication}
 record,e:=p.call(ctx,p.names,"resolve(bytes32)",block,7,label);if e!=nil{return empty,ErrUnavailable}
 owner,e:=wordAddress(record[0]);if e!=nil||owner=="0x0000000000000000000000000000000000000000"{return empty,ErrAuthentication}
 target,e:=wordAddress(record[2]);if e!=nil||target!=addr{return empty,ErrAuthentication}
 if wordHash(record[3])!=profile{return empty,ErrAuthentication}
 expiry,e:=wordUint64(record[5]);if e!=nil{return empty,e}
 if expiry<=uint64(block.timestamp.Unix()){return empty,ErrAuthentication}
 reverse,e:=p.call(ctx,p.names,"reverseResolve(address)",block,1,addr);if e!=nil||wordHash(reverse[0])!=label{return empty,ErrAuthentication}
 claim,e:=p.call(ctx,p.names,"nameClaimsProfile(bytes32,bytes32)",block,1,label,profile);if e!=nil{return empty,ErrUnavailable}
 yes,e:=wordBool(claim[0]);if e!=nil||!yes{return empty,ErrAuthentication}
 result.BilateralNameVerified=true
 return result,nil
}

// Credential validity is read-only from canonical Identity420's
// hasValidCredential(subject,type), and only for the actively linked,
// freshly revalidated selected profile. It does not grant trust, KYC or app
// authority. Its issuer/trust policy remains the chain's responsibility.
func (p *IdentityNamesRPC) ValidCredential(ctx context.Context,chain int64,wallet,profileID,credentialType string)(bool,error){
 addr,e:=canonicalWalletAddress(wallet)
 if e!=nil||addr!=wallet{return false,ErrInvalid}
 subject,e:=canonicalBytes32(profileID,false)
 if e!=nil||subject!=profileID{return false,ErrInvalid}
 kind,e:=canonicalBytes32(credentialType,false);if e!=nil{return false,e}
 block,e:=p.preflight(ctx,chain);if e!=nil{return false,e}
 profile,e:=p.call(ctx,p.identity,"profiles(bytes32)",block,7,subject)
 if e!=nil{return false,e}
 controller,e:=wordAddress(profile[0]);if e!=nil||controller!=addr{return false,ErrAuthentication}
 active,e:=wordBool(profile[6]);if e!=nil||!active{return false,ErrAuthentication}
 // The controller/active proof and credential validity MUST refer to the
 // identical canonical finalized block, not two successive RPC snapshots.
 result,e:=p.call(ctx,p.identity,"hasValidCredential(bytes32,bytes32)",block,1,subject,kind)
 if e!=nil{return false,e}
 return wordBool(result[0])
}
var _ IdentityNamesReader=(*IdentityNamesRPC)(nil)

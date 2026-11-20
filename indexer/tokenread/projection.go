// Package tokenread reconstructs historical Token V1 deployment evidence.
// It is a read projection, not an asset registry, audit, listing or signer.
package tokenread

import (
 "encoding/json"
 "errors"
 "io"
 "math/big"
 "regexp"
 "strconv"
 "strings"

 "github.com/420integrated/420-integrated/indexer/model"
)

const (
 Registry = "0x0000000000000000000000000000000000000434"
 ServiceID = "0x76b0de4fe89da68b19741e7d8ae6273b3ea40d74f544a0f28511091c6238a879"
 VaultID = "0x928187054f31f4a02547fa03a1fc48de277e822b9257d95101a142f5ec216aed"
 Published = "0x19aa152c2c4c6794d89883e0808ea2365e3f6d5267840423debc9b08db5b3608"
 Profile = "0x19af5a8b78ed7364ffacb8ddf22ac42f4bb67c6d9532cb2b7504781867c550d9"
 Deployed = "0x45d0e026aef0ee7a66e25a58e08aa2394ae91739474927cb0d88b8f29f2c5d5e"
 Fee = "0x5128de580b27803c2ec8474a27324a7bb7e4eff78a40d67868e349881044741a"
 Native = "0xb5d7700fb0cf415158b8db7cc7c39f0eab16a825c92e221404b4c8bb099b4bbb"
 Deposit = "0xdbf530fef1f70be00976ffb4d5ad694e65f46988cca1bfdb1bf68b0e954452d4"
 FeeWei = "42000000000000000000"
 FeeWord = "00000000000000000000000000000000000000000000000246ddf97976680000"
 Kind = "factory-creation-and-fee-events"
)
var ErrInvalid = errors.New("invalid Token provenance")
var ErrUnavailable = errors.New("Token deployment binding or canonical snapshot unavailable")
var ErrNotFound = errors.New("Token deployment not observed")
var addressRE = regexp.MustCompile("^0x[0-9a-f]{40}$")
var hashRE = regexp.MustCompile("^0x[0-9a-f]{64}$")
var templates=map[string]string{
 "0x0517055aa8d8da1332a6a60f625f6d07c05e47f5b365f33b6fec4209c040ce0a":"ERC20_FIXED",
 "0xe5156234ac9b3e54dc1c2c6e8c94a57d3b07f62ad50ced369eac4f47f60b3b1c":"ERC20_MINTABLE",
 "0xe74089deb750312b3004a6a55dd2c4ff16555e6906ff2889ed8866a787312782":"ERC20_CAPPED",
 "0x2344b056575b6fa10fb2fea2187b5b55bcab2a0de20e31be1ec08c1f617b625e":"ERC20_BURNABLE",
 "0x72295c9752e27886f56cf2a7ce4927021b7f78c35dc206b107821153c3e7d15d":"ERC20_PERMIT",
 "0xd34aaf0c10eb82c0747dc2132ddd55a9e4761d2055f9e0e76f7bb316a764019a":"ERC20_VOTES",
 "0x14293498e399ab72ce8a044fed1b6444024a16f32644162736846536bf96813c":"ERC721_COLLECTION",
 "0x29477a601d8fab1bd6524005e80cc4653ff0ac4cf32290312ffc65ff7e1cd755":"ERC1155_MULTI",
}
func ValidAddress(v string)bool{return addressRE.MatchString(v)&&v!="0x"+strings.Repeat("0",40)}
func validHash(v string)bool{return hashRE.MatchString(v)&&v!="0x"+strings.Repeat("0",64)}
func dependency(v string)bool{
 if !ValidAddress(v){return false};n,_:=new(big.Int).SetString(v[2:],16)
 return n.Cmp(big.NewInt(0x420))<0||n.Cmp(big.NewInt(0x4ff))>0
}
func aw(v string)string{return "0x"+strings.Repeat("0",24)+v[2:]}
func w(n uint64)string{return strings.Repeat("0",64-len(strconv.FormatUint(n,16)))+strconv.FormatUint(n,16)}
func word(v string)bool{return hashRE.MatchString(v)}
func words(s string,n int)[]string{
 if len(s)!=2+64*n||!strings.HasPrefix(s,"0x"){return nil}
 a:=make([]string,n);for i:=range a{a[i]="0x"+s[2+64*i:2+64*(i+1)];if !word(a[i]){return nil}}
 return a
}
func u(s string)(uint64,bool){n,e:=strconv.ParseUint(s,10,64);return n,e==nil&&s==strconv.FormatUint(n,10)}
// Binding is obtained from independent approved release evidence, not
// a public request, token metadata, or a search result. Never supplies live defaults.
type Binding struct{
 ChainID uint64 `json:"chainId"`
 GenesisHash string `json:"genesisHash"`
 Factory string `json:"factory"`
 Vault string `json:"vault"`
 Accounting string `json:"accounting"`
 FactoryCodeHash string `json:"factoryCodeHash"`
 MetadataHash string `json:"metadataHash"`
 ManifestHash string `json:"manifestHash"`
 DependencyRoot string `json:"dependencyRoot"`
 InterfaceHash string `json:"interfaceHash"`
}
func (b Binding) Valid()bool{
 return b.ChainID>0&&validHash(b.GenesisHash)&&dependency(b.Factory)&&dependency(b.Vault)&&dependency(b.Accounting)&&b.Factory!=b.Vault&&b.Factory!=b.Accounting&&b.Vault!=b.Accounting&&validHash(b.FactoryCodeHash)&&validHash(b.MetadataHash)&&validHash(b.ManifestHash)&&validHash(b.DependencyRoot)&&validHash(b.InterfaceHash)
}
func ParseBinding(raw string)(Binding,error){
 var b Binding;d:=json.NewDecoder(strings.NewReader(raw));d.DisallowUnknownFields()
 if d.Decode(&b)!=nil||d.Decode(new(any))!=io.EOF||!b.Valid(){return Binding{},ErrInvalid};return b,nil
}
func(b Binding) Addresses()[]string{return []string{Registry,b.Factory,b.Vault,b.Accounting}}
type Projection struct{
 ChainID string `json:"chainId"`
 GenesisHash string `json:"genesisHash"`
 SnapshotHeight string `json:"snapshotHeight"`
 SnapshotHash string `json:"snapshotHash"`
 Token string `json:"token"`
 Creator string `json:"creator"`
 TemplateID string `json:"templateId"`
 Template string `json:"template"`
 TemplateVersion uint32 `json:"templateVersion"`
 ConfigHash string `json:"configHash"`
 Factory string `json:"factory"`
 Vault string `json:"vault"`
 Accounting string `json:"accounting"`
 CreationFeeWei string `json:"creationFeeWei"`
 BlockNumber string `json:"blockNumber"`
 BlockHash string `json:"blockHash"`
 TransactionHash string `json:"transactionHash"`
 TransactionIndex *uint64 `json:"transactionIndex"`
 LogIndex *uint64 `json:"logIndex"`
 AccountingLogIndex *uint64 `json:"accountingLogIndex"`
 VaultLogIndex *uint64 `json:"vaultLogIndex"`
 FeeLogIndex *uint64 `json:"feeLogIndex"`
 EvidenceKind string `json:"evidenceKind"`
 Authoritative *bool `json:"authoritative"`
}
func (p Projection) Validate(chain uint64,token string)error{
 height,hOK:=u(p.SnapshotHeight);block,bOK:=u(p.BlockNumber)
 if chain==0||p.ChainID!=strconv.FormatUint(chain,10)||!ValidAddress(token)||p.Token!=token||
 !validHash(p.GenesisHash)||!validHash(p.SnapshotHash)||!validHash(p.BlockHash)||!validHash(p.TransactionHash)||!hashRE.MatchString(p.ConfigHash)||
 !hOK||!bOK||block>height||(block==height&&p.BlockHash!=p.SnapshotHash)||!ValidAddress(p.Creator)||
 p.TemplateVersion!=1||p.Template==""||templates[p.TemplateID]!=p.Template||p.CreationFeeWei!=FeeWei||p.EvidenceKind!=Kind||
 !dependency(p.Factory)||!dependency(p.Vault)||!dependency(p.Accounting)||p.Factory==p.Vault||p.Factory==p.Accounting||p.Vault==p.Accounting||
 token==p.Factory||token==p.Vault||token==p.Accounting||token==p.Creator||
 p.Authoritative==nil||*p.Authoritative||p.TransactionIndex==nil||p.LogIndex==nil||p.AccountingLogIndex==nil||p.VaultLogIndex==nil||p.FeeLogIndex==nil||
 *p.LogIndex>=*p.AccountingLogIndex||*p.AccountingLogIndex>=*p.VaultLogIndex||*p.VaultLogIndex>=*p.FeeLogIndex{return ErrInvalid}
 return nil
}
func sameTx(a,b model.LogRecord)bool{return a.ChainID==b.ChainID&&a.BlockNumber==b.BlockNumber&&a.BlockHash==b.BlockHash&&a.TransactionHash==b.TransactionHash&&a.TransactionIndex==b.TransactionIndex}
func before(a,b model.LogRecord)bool{return a.BlockNumber<b.BlockNumber||(a.BlockNumber==b.BlockNumber&&a.LogIndex<b.LogIndex)}
func topic(l model.LogRecord,t string)bool{return len(l.Topics)>0&&l.Topics[0]==t}
func normalized(l model.LogRecord)model.LogRecord{
 l.Address=strings.ToLower(l.Address);l.BlockHash=strings.ToLower(l.BlockHash);l.TransactionHash=strings.ToLower(l.TransactionHash);l.Data=strings.ToLower(l.Data)
 l.Topics=append([]string(nil),l.Topics...);for i,t:=range l.Topics{l.Topics[i]=strings.ToLower(t)};return l
}
// Project consumes only a coherent canonical-source snapshot (with receipts
// and transactions validated by the store). Historical publication is evidence
// of the registered release at creation, not a claim of current availability.
func Project(b Binding,cp model.ChainCheckpoint,token string,logs []model.LogRecord)(Projection,error){
 var out Projection
 if !ValidAddress(token){return out,ErrInvalid}
 if !b.Valid()||cp.ChainID!=b.ChainID||!validHash(cp.IndexedHash){return out,ErrUnavailable}
 var publication,profile,created *model.LogRecord
 seen:=map[string]bool{}
 normalizedLogs:=make([]model.LogRecord,0,len(logs))
 for _,raw:=range logs{
  l:=normalized(raw)
  if l.Address!=Registry&&l.Address!=b.Factory&&l.Address!=b.Vault&&l.Address!=b.Accounting{continue}
  if l.ChainID!=cp.ChainID||l.BlockNumber>cp.IndexedHeight||!validHash(l.BlockHash)||!validHash(l.TransactionHash){return out,ErrInvalid}
  key:=strconv.FormatUint(l.BlockNumber,10)+":"+strconv.FormatUint(l.LogIndex,10)
  if seen[key]{return out,ErrInvalid};seen[key]=true;normalizedLogs=append(normalizedLogs,l)
  if l.Address==Registry&&len(l.Topics)>=2&&l.Topics[1]==ServiceID&&(topic(l,Published)||topic(l,Profile)){
   if len(l.Topics)<3||!word(l.Topics[2]){return out,ErrInvalid}
   if l.Topics[2]!="0x"+w(1){continue}
   if topic(l,Published){
    if publication!=nil||len(l.Topics)!=4||l.Topics[3]!=aw(b.Factory)||l.Data!="0x"+b.FactoryCodeHash[2:]+b.MetadataHash[2:]+w(1){return out,ErrInvalid}
    publication=&l
   }else{
    if profile!=nil||len(l.Topics)!=3||l.Data!="0x"+w(3)+b.ManifestHash[2:]+b.DependencyRoot[2:]+b.InterfaceHash[2:]{return out,ErrInvalid}
    profile=&l
   }
  }
  if l.Address==b.Factory&&topic(l,Deployed)&&len(l.Topics)>1&&l.Topics[1]==aw(token){
   if created!=nil{return out,ErrInvalid};created=&l
  }
 }
 if publication==nil||profile==nil||!sameTx(*publication,*profile)||!before(*publication,*profile){return out,ErrUnavailable}
 if created==nil{return out,ErrNotFound}
 c:=*created;fields:=words(c.Data,3)
 if !before(*profile,c)||len(c.Topics)!=4||!word(c.Topics[2])||!strings.HasPrefix(c.Topics[2],"0x"+strings.Repeat("0",24))||templates[c.Topics[3]]==""||fields==nil||fields[0]!="0x"+w(1)||fields[2]!="0x"+FeeWord{return out,ErrInvalid}
 creator:="0x"+c.Topics[2][26:]
 var accounting,vault,fee *model.LogRecord
 for _,l:=range normalizedLogs{
  if !sameTx(c,l){continue}
  // Reject multiple factory deployments in the same transaction in this V1
  // evidence path: fee events are not individually keyed by token address.
  if l.Address==b.Factory&&topic(l,Deployed)&&l.LogIndex!=c.LogIndex{return out,ErrInvalid}
  if l.Address==b.Factory&&topic(l,Fee){
   if fee!=nil||len(l.Topics)!=3||l.Topics[1]!=aw(b.Vault)||l.Topics[2]!=VaultID||l.Data!="0x"+FeeWord{return out,ErrInvalid};v:=l;fee=&v
  }
  if l.Address==b.Vault&&topic(l,Native){
   if len(l.Topics)!=2||l.Topics[1]!=aw(b.Factory)||l.Data!="0x"+FeeWord||vault!=nil{return out,ErrInvalid};v:=l;vault=&v
  }
  if l.Address==b.Accounting&&topic(l,Deposit){
   // Other vault/asset deposits are not Token creation revenue. Reject
   // malformed or duplicate matching native community deposit evidence.
   if len(l.Topics)!=3{return out,ErrInvalid}
   if l.Topics[1]!=VaultID||l.Topics[2]!="0x"+w(0){continue}
   a:=words(l.Data,2);if accounting!=nil||a==nil||a[0]!="0x"+FeeWord{return out,ErrInvalid}
   bal,_:=new(big.Int).SetString(a[1][2:],16);min,_:=new(big.Int).SetString(FeeWei,10);if bal.Cmp(min)<0{return out,ErrInvalid}
   v:=l;accounting=&v
  }
 }
 if accounting==nil||vault==nil||fee==nil{return out,ErrInvalid}
 out=Projection{ChainID:strconv.FormatUint(b.ChainID,10),GenesisHash:b.GenesisHash,SnapshotHeight:strconv.FormatUint(cp.IndexedHeight,10),SnapshotHash:cp.IndexedHash,Token:token,Creator:creator,TemplateID:c.Topics[3],Template:templates[c.Topics[3]],TemplateVersion:1,ConfigHash:fields[1],Factory:b.Factory,Vault:b.Vault,Accounting:b.Accounting,CreationFeeWei:FeeWei,BlockNumber:strconv.FormatUint(c.BlockNumber,10),BlockHash:c.BlockHash,TransactionHash:c.TransactionHash,TransactionIndex:&c.TransactionIndex,LogIndex:&c.LogIndex,AccountingLogIndex:&accounting.LogIndex,VaultLogIndex:&vault.LogIndex,FeeLogIndex:&fee.LogIndex,EvidenceKind:Kind,Authoritative:new(bool)}
 return out,out.Validate(b.ChainID,token)
}

package treasuryread

import (
 "encoding/hex"
 "encoding/json"
 "fmt"
 "io"
 "math/big"
 "sort"
 "strconv"
 "strings"

 "github.com/420integrated/420-integrated/420-indexer/descriptors"
 "github.com/420integrated/420-integrated/indexer/model"
)

const policyContract = "TreasuryPolicyRegistry420"
const budgetContract = "TreasuryBudgetRegistry420"
const disbursementContract = "TreasuryDisbursementRegistry420"

// Binding is supplied from the verified deployment/Registry evidence, never from
// an HTTP request or a guessed Genesis address. It is pinned to one chain/genesis.
type Binding struct {
 ChainID uint64 `json:"chainId"`
 GenesisHash string `json:"genesisHash"`
 Addresses map[string]string `json:"addresses"`
}

func ParseBinding(raw string) (Binding,error) {
 var b Binding
 d:=json.NewDecoder(strings.NewReader(raw));d.DisallowUnknownFields()
 if err:=d.Decode(&b);err!=nil{return Binding{},err}
 var trailing any
 if err:=d.Decode(&trailing);err!=io.EOF {return Binding{},ErrInvalid}
 if b.ChainID!=420 || !hash.MatchString(b.GenesisHash)||zero(b.GenesisHash)||len(b.Addresses)!=3{return Binding{},ErrInvalid}
 b.GenesisHash=strings.ToLower(b.GenesisHash)
 seen:=map[string]bool{}
 for _,name:=range []string{policyContract,budgetContract,disbursementContract}{
  a:=strings.ToLower(b.Addresses[name])
  if !addr.MatchString(a)||zero(a)||seen[a]{return Binding{},ErrInvalid}
  seen[a]=true;b.Addresses[name]=a
 }
 return b,nil
}

func zero(s string)bool{return strings.Trim(s[2:],"0")==""}
func HashHex(data []byte)string{h:=keccak256(data);return "0x"+hex.EncodeToString(h[:])}
func ValidID(kind,id string)bool{
 switch kind{case "budgets","disbursements":return hash.MatchString(id);case "asset-policies":return addr.MatchString(id)}
 return false
}
type abiInput struct{Name string;Type string;Indexed bool}
type abiEvent struct{Name string;Signature string;Inputs []abiInput;Contract string}

func eventTable() (map[string]abiEvent,error){
 var m struct{Schema string;DescriptorVersion int;Protocol string;Authority string;Contracts []struct{ContractName string;Events []abiEvent}}
 if json.Unmarshal([]byte(descriptors.TreasuryV1),&m)!=nil||m.Schema!="420-treasury-artifact-descriptor-v1"||m.DescriptorVersion!=1||m.Protocol!="420Treasury"||m.Authority!="artifact_events_only_addresses_resolved_by_deployment"||len(m.Contracts)!=3{return nil,ErrInvalid}
 out:=map[string]abiEvent{};seen:=map[string]bool{}
 for _,c:=range m.Contracts{
  if seen[c.ContractName]||c.ContractName!=policyContract&&c.ContractName!=budgetContract&&c.ContractName!=disbursementContract{return nil,ErrInvalid};seen[c.ContractName]=true
  for _,e:=range c.Events{
   types:=[]string{};for _,i:=range e.Inputs{types=append(types,i.Type)}
   if e.Signature!=e.Name+"("+strings.Join(types,",")+")"{return nil,ErrInvalid}
   e.Contract=c.ContractName;topic:=HashHex([]byte(e.Signature));if _,ok:=out[topic];ok{return nil,ErrInvalid};out[topic]=e
  }
 }
 if len(out)!=7{return nil,ErrInvalid}
 return out,nil
}

func decodeWord(word []byte,typ string)(any,error){
 if len(word)!=32{return nil,ErrInvalid}
 n:=new(big.Int).SetBytes(word)
 switch typ{
 case "address":if n.BitLen()>160{return nil,ErrInvalid};return "0x"+hex.EncodeToString(word[12:]),nil
 case "bytes32":return "0x"+hex.EncodeToString(word),nil
 case "bool":if n.BitLen()>1{return nil,ErrInvalid};return n.Sign()==1,nil
 default:
  if !strings.HasPrefix(typ,"uint"){return nil,ErrInvalid}
  bits,err:=strconv.Atoi(typ[4:]);if err!=nil||bits<8||bits>256||bits%8!=0||n.BitLen()>bits{return nil,ErrInvalid};return n.String(),nil
 }
}

func decodeEvent(l model.LogRecord,e abiEvent)(map[string]any,error){
 if !strings.HasPrefix(l.Data,"0x"){return nil,ErrInvalid}
 data,err:=hex.DecodeString(l.Data[2:]);if err!=nil{return nil,ErrInvalid}
 ti,di:=1,0;fields:=map[string]any{}
 for _,i:=range e.Inputs{
  var word []byte
  if i.Indexed{if ti>=len(l.Topics)||!hash.MatchString(l.Topics[ti]){return nil,ErrInvalid};word,err=hex.DecodeString(l.Topics[ti][2:]);ti++}else{if di+32>len(data){return nil,ErrInvalid};word=data[di:di+32];di+=32}
  if err!=nil{return nil,ErrInvalid}
  v,err:=decodeWord(word,i.Type);if err!=nil{return nil,err};fields[i.Name]=v
 }
 if ti!=len(l.Topics)||di!=len(data){return nil,ErrInvalid}
 return fields,nil
}

func str(f map[string]any,k string)string{v,_:=f[k].(string);return v}
func num(f map[string]any,k string)*big.Int{v,_:=new(big.Int).SetString(str(f,k),10);if v==nil{return new(big.Int)};return v}
func nonzero(f map[string]any,keys ...string)bool{for _,k:=range keys{v:=str(f,k);if len(v)<2||zero(v){return false}};return true}
func canonicalDisbursement(f map[string]any)string{
 domain:=keccak256([]byte("420/TREASURY/DISBURSEMENT/V1"))
 words:=append([]byte(nil),domain[:]...)
 for _,k:=range []string{"budgetId","recipient","amount","notBefore","expiresAt","civicActionHash","purposeHash"}{
  var word [32]byte;v:=str(f,k)
  if strings.HasPrefix(v,"0x"){raw,_:=hex.DecodeString(v[2:]);copy(word[32-len(raw):],raw)}else{num(f,k).FillBytes(word[:])}
  words=append(words,word[:]...)
 }
 return HashHex(words)
}

func apply(kind string,state,f map[string]any,event string)(map[string]any,error){
 switch kind{
 case "budgets":
  if event=="BudgetCreated"{
   if state!=nil||!nonzero(f,"budgetId","vaultId","category","civicActionHash")||num(f,"ceiling").Sign()==0||num(f,"validUntil").Cmp(num(f,"validFrom"))<=0{return nil,ErrInvalid}
   f["committed"]="0";f["executed"]="0";return f,nil
  }
  if state==nil||event!="BudgetCommitmentChanged"{return nil,ErrInvalid}
  c,x:=num(f,"committed"),num(f,"executed")
  if x.Cmp(num(state,"executed"))<0||x.Cmp(num(state,"executed"))!=0&&c.Cmp(num(state,"committed"))!=0||c.Cmp(num(state,"ceiling"))>0||x.Cmp(c)>0{return nil,ErrInvalid}
  state["committed"]=f["committed"];state["executed"]=f["executed"]
 case "disbursements":
  if event=="DisbursementScheduled"{
   if state!=nil||!nonzero(f,"disbursementId","budgetId","recipient","civicActionHash","purposeHash")||num(f,"amount").Sign()==0||num(f,"expiresAt").Cmp(num(f,"notBefore"))<=0||canonicalDisbursement(f)!=str(f,"disbursementId"){return nil,ErrInvalid}
   f["state"]="SCHEDULED";f["executor"]=nil;f["vaultReleaseHash"]=nil;return f,nil
  }
  if state==nil||state["state"]!="SCHEDULED"{return nil,ErrInvalid}
  switch event{
  case "DisbursementExecuted":if !nonzero(f,"executor","vaultReleaseHash"){return nil,ErrInvalid};state["state"]="EXECUTED";state["executor"]=f["executor"];state["vaultReleaseHash"]=f["vaultReleaseHash"]
  case "DisbursementCancelled":state["state"]="CANCELLED"
  default:return nil,ErrInvalid
  }
 case "asset-policies":
  revision:=num(f,"revision");expected:=big.NewInt(1);if state!=nil{expected.Add(num(state,"revision"),expected)}
  if event!="AssetPolicySet"||num(f,"maxSingleDisbursement").Sign()==0||num(f,"maxEpochDisbursement").Cmp(num(f,"maxSingleDisbursement"))<0||num(f,"epochSeconds").Sign()==0||revision.Cmp(expected)!=0||state!=nil&&str(state,"epochSeconds")!=str(f,"epochSeconds"){return nil,ErrInvalid}
  return f,nil
 default:return nil,ErrInvalid
 }
 return state,nil
}

// Project replays the checkpoint-consistent, receipt-validated log snapshot.
// Derived history is never persisted as independent settlement authority.
func Project(binding Binding,kind,id string,logs []model.LogRecord)(json.RawMessage,error){
 if !ValidID(kind,id){return nil,ErrInvalid};id=strings.ToLower(id)
 events,err:=eventTable();if err!=nil{return nil,err}
 expected,key:="",""
 switch kind{case "budgets":expected,key=budgetContract,"budgetId";case "disbursements":expected,key=disbursementContract,"disbursementId";case "asset-policies":expected,key=policyContract,"asset"}
 logs=append([]model.LogRecord(nil),logs...)
 sort.Slice(logs,func(i,j int)bool{a,b:=logs[i],logs[j];if a.BlockNumber!=b.BlockNumber{return a.BlockNumber<b.BlockNumber};if a.TransactionIndex!=b.TransactionIndex{return a.TransactionIndex<b.TransactionIndex};return a.LogIndex<b.LogIndex})
 var state map[string]any
 var prev *model.LogRecord
 for _,l:=range logs{
  if len(l.Topics)==0{continue}
  e,ok:=events[strings.ToLower(l.Topics[0])];if !ok{continue}
  if l.ChainID!=binding.ChainID||!strings.EqualFold(l.Address,binding.Addresses[e.Contract])||!hash.MatchString(l.BlockHash)||!hash.MatchString(l.TransactionHash){return nil,ErrInvalid}
  if prev!=nil&&prev.BlockNumber==l.BlockNumber&&(!strings.EqualFold(prev.BlockHash,l.BlockHash)||prev.LogIndex>=l.LogIndex||prev.TransactionIndex==l.TransactionIndex&&!strings.EqualFold(prev.TransactionHash,l.TransactionHash)){return nil,ErrInvalid}
  copyLog:=l;prev=&copyLog
  f,err:=decodeEvent(l,e);if err!=nil{return nil,fmt.Errorf("%w: %s",err,e.Name)}
  if e.Contract!=expected||str(f,key)!=id{continue}
  state,err=apply(kind,state,f,e.Name);if err!=nil{return nil,err}
  state["chainId"]=strconv.FormatUint(binding.ChainID,10);state["blockNumber"]=strconv.FormatUint(l.BlockNumber,10)
  state["blockHash"]=strings.ToLower(l.BlockHash);state["transactionHash"]=strings.ToLower(l.TransactionHash);state["transactionIndex"]=l.TransactionIndex;state["logIndex"]=l.LogIndex;state["authoritative"]=false
 }
 if state==nil{return nil,nil}
 raw,err:=json.Marshal(state);if err!=nil{return nil,err}
 if err=Validate(raw,binding.ChainID,kind,id);err!=nil{return nil,err};return raw,nil
}

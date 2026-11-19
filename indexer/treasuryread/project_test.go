package treasuryread

import (
 "encoding/hex"
 "encoding/json"
 "fmt"
 "strings"
 "testing"

 "github.com/420integrated/420-integrated/indexer/model"
)

func h(n int)string{return fmt.Sprintf("0x%064x",n)}
func a(n int)string{return fmt.Sprintf("0x%040x",n)}
func words(v ...string)string{out:="0x";for _,s:=range v{out+=strings.TrimPrefix(s,"0x")};return out}
func bindingFixture()Binding{return Binding{420,h(900),map[string]string{policyContract:a(101),budgetContract:a(102),disbursementContract:a(103)}}}
func logFixture(contract,signature string,height int,topics []string,data string)model.LogRecord{
 return model.LogRecord{ChainID:420,BlockNumber:uint64(height),BlockHash:h(900+height),TransactionHash:h(500+height),Address:bindingFixture().Addresses[contract],Topics:append([]string{HashHex([]byte(signature))},topics...),Data:data}
}
func budgetCreated()model.LogRecord{return logFixture(budgetContract,"BudgetCreated(bytes32,bytes32,bytes32,address,uint128,uint64,uint64,bytes32,bytes32)",1,[]string{h(1),h(2),h(3)},words(h(0),h(100),h(10),h(100),h(4),h(5)))}
func budgetChanged(height,c,x int)model.LogRecord{return logFixture(budgetContract,"BudgetCommitmentChanged(bytes32,uint128,uint128)",height,[]string{h(1)},words(h(c),h(x)))}
func policy(height,revision,epoch int)model.LogRecord{return logFixture(policyContract,"AssetPolicySet(address,bool,uint128,uint128,uint64,uint32)",height,[]string{h(0)},words(h(1),h(20),h(100),h(epoch),h(revision)))}
func schedule() (model.LogRecord,string){
 domain:=HashHex([]byte("420/TREASURY/DISBURSEMENT/V1"))
 raw,_:=hex.DecodeString(words(domain,h(1),h(9),h(35),h(10),h(100),h(4),h(5))[2:])
 id:=HashHex(raw)
 return logFixture(disbursementContract,"DisbursementScheduled(bytes32,bytes32,address,address,uint128,uint64,uint64,bytes32,bytes32)",2,[]string{id,h(1),h(9)},words(h(0),h(35),h(10),h(100),h(4),h(5))),id
}
func projectOK(t *testing.T,kind,id string,logs ...model.LogRecord)map[string]any{
 t.Helper();raw,err:=Project(bindingFixture(),kind,id,logs);if err!=nil||raw==nil{t.Fatalf("project %s: %s %v",kind,raw,err)};var v map[string]any;if err=json.Unmarshal(raw,&v);err!=nil{t.Fatal(err)};return v
}
func TestTreasuryReplayAllObjects(t *testing.T){
 if HashHex(nil)!="0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470"{t.Fatal("Ethereum Keccak vector mismatch")}
 table,err:=eventTable();if err!=nil||len(table)!=7{t.Fatalf("manifest %v %v",table,err)}
 b:=projectOK(t,"budgets",h(1),budgetChanged(3,40,35),budgetCreated(),budgetChanged(2,40,0))
 if b["executed"]!="35"||b["committed"]!="40"||b["metadataHash"]!=h(5)||b["blockNumber"]!="3"||b["authoritative"]!=false{t.Fatalf("wrong budget: %v",b)}
 p:=projectOK(t,"asset-policies",a(0),policy(1,1,50),policy(2,2,50))
 if p["revision"]!="2"||p["allowed"]!=true||p["epochSeconds"]!="50"{t.Fatalf("wrong policy: %v",p)}
 s,id:=schedule()
 e:=logFixture(disbursementContract,"DisbursementExecuted(bytes32,bytes32,address)",3,[]string{id,h(10)},h(8))
 d:=projectOK(t,"disbursements",id,s,e)
 if d["state"]!="EXECUTED"||d["vaultReleaseHash"]!=h(8)||d["executor"]!=a(10)||d["authoritative"]!=false{t.Fatalf("wrong disbursement: %v",d)}
 c:=logFixture(disbursementContract,"DisbursementCancelled(bytes32)",3,[]string{id},"0x")
 d=projectOK(t,"disbursements",id,s,c)
 if d["state"]!="CANCELLED"||d["vaultReleaseHash"]!=nil||d["executor"]!=nil{t.Fatalf("wrong cancelled: %v",d)}
}
func TestTreasuryReplayRejectsInvalidHistories(t *testing.T){
 b:=budgetCreated();malformed:=b;malformed.Data=b.Data+"00";wrong:=b;wrong.Address=bindingFixture().Addresses[policyContract];wrongChain:=b;wrongChain.ChainID=1
 s,id:=schedule();forged:=s;forged.Topics=append([]string(nil),s.Topics...);forged.Topics[1]=h(99)
 cancel:=logFixture(disbursementContract,"DisbursementCancelled(bytes32)",3,[]string{id},"0x")
 cancel2:=logFixture(disbursementContract,"DisbursementCancelled(bytes32)",4,[]string{id},"0x")
 failedExecution:=logFixture(disbursementContract,"DisbursementExecuted(bytes32,bytes32,address)",3,[]string{id,h(10)},h(0))
 for _,tc:=range []struct{name,kind,id string;logs []model.LogRecord}{
  {"duplicate","budgets",h(1),[]model.LogRecord{b,b}},
  {"malformed","budgets",h(1),[]model.LogRecord{malformed}},
  {"wrong emitter","budgets",h(1),[]model.LogRecord{wrong}},
  {"wrong chain","budgets",h(1),[]model.LogRecord{wrongChain}},
  {"missing creation","budgets",h(1),[]model.LogRecord{budgetChanged(2,10,0)}},
  {"intermediate ceiling","budgets",h(1),[]model.LogRecord{b,budgetChanged(2,101,0),budgetChanged(3,5,0)}},
  {"executed exceeds committed","budgets",h(1),[]model.LogRecord{b,budgetChanged(2,10,0),budgetChanged(3,10,11)}},
  {"revision skipped","asset-policies",a(0),[]model.LogRecord{policy(1,1,50),policy(2,3,50)}},
  {"epoch changed","asset-policies",a(0),[]model.LogRecord{policy(1,1,50),policy(2,2,51)}},
  {"forged canonical id","disbursements",h(99),[]model.LogRecord{forged}},
  {"terminal replay","disbursements",id,[]model.LogRecord{s,cancel,cancel2}},
  {"missing release commitment","disbursements",id,[]model.LogRecord{s,failedExecution}},
 }{t.Run(tc.name,func(t *testing.T){if raw,err:=Project(bindingFixture(),tc.kind,tc.id,tc.logs);err==nil{t.Fatalf("accepted invalid history: %s",raw)}})}
}
func TestTreasuryBindingRejectsMalformedAndSubstitutedAddresses(t *testing.T){
 b:=bindingFixture();raw,_:=json.Marshal(b)
 if _,err:=ParseBinding(string(raw));err!=nil{t.Fatal(err)}
 for _,s:=range []string{string(raw)+" {}",strings.Replace(string(raw),a(101),a(102),1),strings.Replace(string(raw),h(900),h(0),1),strings.Replace(string(raw),"\"chainId\":420","\"chainId\":1",1)}{if _,err:=ParseBinding(s);err==nil{t.Fatalf("accepted %s",s)}}
}

package api

import (
 "context"
 "encoding/hex"
 "encoding/json"
 "fmt"
 "net/http"
 "net/http/httptest"
 "path/filepath"
 "strings"
 "testing"
 "time"

 analytics "github.com/420integrated/420-integrated/analytics/indexerclient"
 "github.com/420integrated/420-integrated/explorer/indexerclient"
 explorerservice "github.com/420integrated/420-integrated/explorer/service"
 indexerapi "github.com/420integrated/420-integrated/indexer/api"
 "github.com/420integrated/420-integrated/indexer/model"
 "github.com/420integrated/420-integrated/indexer/store"
 "github.com/420integrated/420-integrated/indexer/treasuryread"
)
func th(n int)string{return fmt.Sprintf("0x%064x",n)}
func ta(n int)string{return fmt.Sprintf("0x%040x",n)}
func tw(v ...string)string{out:="0x";for _,x:=range v{out+=strings.TrimPrefix(x,"0x")};return out}
func tl(address,signature string,topics []string,data string)model.LogRecord{return model.LogRecord{Address:address,Topics:append([]string{treasuryread.HashHex([]byte(signature))},topics...),Data:data}}
func treasuryBundle(t *testing.T,s *store.FileStore,n int,bhash string,success uint64,events ...model.LogRecord){
 t.Helper()
 b:=model.BlockRecord{ChainID:420,Number:uint64(n),Hash:bhash,Finality:model.FinalityHead,SchemaVersion:"v1"}
 if n>0{parent,ok,err:=s.Block(uint64(n-1));if err!=nil||!ok{t.Fatalf("missing parent: %v",err)};b.ParentHash=parent.Hash}
 var txs []model.TransactionRecord; var receipts []model.ReceiptRecord
 if len(events)>0{
  hash:=th(n+10000)
  txs=[]model.TransactionRecord{{ChainID:420,BlockNumber:uint64(n),BlockHash:bhash,Hash:hash,Index:0}}
  receipts=[]model.ReceiptRecord{{ChainID:420,BlockNumber:uint64(n),BlockHash:bhash,TransactionHash:hash,TransactionIndex:0,Status:success}}
  for i:=range events{events[i].ChainID=420;events[i].BlockNumber=uint64(n);events[i].BlockHash=bhash;events[i].TransactionHash=hash;events[i].LogIndex=uint64(i)}
 }
 if err:=s.PutBundle(b,txs,receipts,events);err!=nil{t.Fatal(err)}
}
func treasuryCheckpoint(t *testing.T,s *store.FileStore,n int,bhash string){
 t.Helper();if err:=s.SaveCheckpoint(model.ChainCheckpoint{ChainID:420,IndexedHeight:uint64(n),IndexedHash:bhash,SchemaVersion:"v1",UpdatedAt:time.Now().UTC()});err!=nil{t.Fatal(err)}
}
func treasuryBindingJSON(genesis string)string{
 b,_:=json.Marshal(treasuryread.Binding{ChainID:420,GenesisHash:genesis,Addresses:map[string]string{"TreasuryPolicyRegistry420":ta(101),"TreasuryBudgetRegistry420":ta(102),"TreasuryDisbursementRegistry420":ta(103)}});return string(b)
}
func treasuryHTTP(t *testing.T,h http.Handler,path string,status int)*httptest.ResponseRecorder{
 t.Helper();rr:=httptest.NewRecorder();h.ServeHTTP(rr,httptest.NewRequest(http.MethodGet,path,nil));if rr.Code!=status{t.Fatalf("%s: status %d, want %d: %s",path,rr.Code,status,rr.Body.String())};return rr
}

func TestTreasuryRuntimeExplorerAnalyticsAgreementAndRecovery(t *testing.T){
 path:=filepath.Join(t.TempDir(),"index.json");s,err:=store.NewFileStore(path);if err!=nil{t.Fatal(err)}
 genesis:=th(900)
 treasuryBundle(t,s,0,genesis,1)
 treasuryBundle(t,s,1,th(901),1,
  tl(ta(101),"AssetPolicySet(address,bool,uint128,uint128,uint64,uint32)",[]string{th(0)},tw(th(1),th(50),th(100),th(20),th(1))),
  tl(ta(102),"BudgetCreated(bytes32,bytes32,bytes32,address,uint128,uint64,uint64,bytes32,bytes32)",[]string{th(1),th(2),th(3)},tw(th(0),th(100),th(10),th(100),th(4),th(5))))
 domain:=treasuryread.HashHex([]byte("420/TREASURY/DISBURSEMENT/V1"))
 raw,_:=hex.DecodeString(tw(domain,th(1),th(9),th(35),th(10),th(100),th(4),th(5))[2:]);id:=treasuryread.HashHex(raw)
 treasuryBundle(t,s,2,th(902),1,
  tl(ta(102),"BudgetCommitmentChanged(bytes32,uint128,uint128)",[]string{th(1)},tw(th(35),th(0))),
  tl(ta(103),"DisbursementScheduled(bytes32,bytes32,address,address,uint128,uint64,uint64,bytes32,bytes32)",[]string{id,th(1),th(9)},tw(th(0),th(35),th(10),th(100),th(4),th(5))))
 treasuryCheckpoint(t,s,2,th(902))
 treasuryBundle(t,s,3,th(903),1,
  tl(ta(102),"BudgetCommitmentChanged(bytes32,uint128,uint128)",[]string{th(1)},tw(th(35),th(35))),
  tl(ta(103),"DisbursementExecuted(bytes32,bytes32,address)",[]string{id,th(10)},th(8)))
 // Simulate interruption after durable bundle write and before checkpoint advance.
 check:=func(s *store.FileStore,state,committed,executed,block string){
  t.Helper()
  backend:=indexerapi.NewStoreBackend(s,nil);if err:=backend.ConfigureTreasury(treasuryBindingJSON(genesis));err!=nil{t.Fatal(err)}
  indexer:=httptest.NewServer(indexerapi.NewServer(backend).Handler());defer indexer.Close()
  ec,err:=indexerclient.New(indexer.URL,time.Second);if err!=nil{t.Fatal(err)}
  svc,err:=explorerservice.New(ec,420,time.Minute);if err!=nil{t.Fatal(err)}
  explorer,err:=NewServer(svc);if err!=nil{t.Fatal(err)}
  ac,err:=analytics.New(indexer.URL,420,time.Second,time.Minute);if err!=nil{t.Fatal(err)}
  ctx:=context.Background()
  for _,item:=range []struct{kind,id string}{{"budgets",th(1)},{"disbursements",id},{"asset-policies",ta(0)}}{
   suffix:="/v1/treasury/"+item.kind+"/"+item.id
   rr:=treasuryHTTP(t,explorer.Handler(),suffix,http.StatusOK)
   if rr.Header().Get("X-420-Canonical-Authority")!="false"{t.Fatal("missing authority boundary")}
   var view indexerclient.TreasuryProjection;if err=json.Unmarshal(rr.Body.Bytes(),&view);err!=nil{t.Fatal(err)}
   if view.Authoritative||view.VaultReleaseVerified{t.Fatal("claimed authority")}
   var fields map[string]any;if err=json.Unmarshal(view.Data,&fields);err!=nil{t.Fatal(err)}
   switch item.kind{
   case "budgets":
    v,e:=ac.TreasuryBudget(ctx,item.id);if e!=nil||v.Committed!=committed||v.Executed!=executed||v.Committed!=fields["committed"]||v.Executed!=fields["executed"]||v.BlockHash!=fields["blockHash"]{t.Fatalf("budget disagreement: %+v %v %v",v,fields,e)}
   case "disbursements":
    v,e:=ac.TreasuryDisbursement(ctx,item.id);if e!=nil||v.State!=state||v.BlockHash!=block||v.State!=fields["state"]||v.TransactionHash!=fields["transactionHash"]||view.ReleaseEvidence!="Treasury commitment only; Vault release not verified"{t.Fatalf("disbursement disagreement: %+v %v %v",v,fields,e)}
   case "asset-policies":
    v,e:=ac.TreasuryAssetPolicy(ctx,item.id);if e!=nil||v.Revision!="1"||!v.Allowed||v.Revision!=fields["revision"]{t.Fatalf("policy disagreement: %+v %v %v",v,fields,e)}
   }
  }
  treasuryHTTP(t,explorer.Handler(),"/v1/treasury/invalid/"+id,http.StatusNotFound)
  treasuryHTTP(t,indexerapi.NewServer(backend).Handler(),"/v1/treasury/budgets/"+th(99)+"?chainId=420",http.StatusNotFound)
  treasuryHTTP(t,indexerapi.NewServer(backend).Handler(),"/v1/treasury/budgets/"+th(1)+"?chainId=1",http.StatusBadRequest)
  treasuryHTTP(t,indexerapi.NewServer(backend).Handler(),"/v1/treasury/budgets/bad?chainId=420",http.StatusBadRequest)
  treasuryHTTP(t,indexerapi.NewServer(backend).Handler(),"/v1/treasury/budgets/"+th(1),http.StatusBadRequest)
 }
 reopened,err:=store.NewFileStore(path);if err!=nil{t.Fatal(err)}
 check(reopened,"SCHEDULED","35","0",th(902))
 treasuryCheckpoint(t,reopened,3,th(903))
 check(reopened,"EXECUTED","35","35",th(903))
 if err=reopened.DeleteBlocksAbove(2);err!=nil{t.Fatal(err)}
 treasuryBundle(t,reopened,3,th(904),1,
  tl(ta(102),"BudgetCommitmentChanged(bytes32,uint128,uint128)",[]string{th(1)},tw(th(0),th(0))),
  tl(ta(103),"DisbursementCancelled(bytes32)",[]string{id},"0x"))
 treasuryCheckpoint(t,reopened,3,th(904))
 reopened,err=store.NewFileStore(path);if err!=nil{t.Fatal(err)}
 check(reopened,"CANCELLED","0","0",th(904))
}
func TestTreasuryRuntimeFailsClosedOnMissingBindingGenesisAndReceipt(t *testing.T){
 s,err:=store.NewFileStore(filepath.Join(t.TempDir(),"index.json"));if err!=nil{t.Fatal(err)}
 treasuryBundle(t,s,0,th(900),1)
 treasuryBundle(t,s,1,th(901),0,tl(ta(101),"AssetPolicySet(address,bool,uint128,uint128,uint64,uint32)",[]string{th(0)},tw(th(1),th(50),th(100),th(20),th(1))))
 treasuryCheckpoint(t,s,1,th(901))
 backend:=indexerapi.NewStoreBackend(s,nil);h:=indexerapi.NewServer(backend).Handler();p:="/v1/treasury/asset-policies/"+ta(0)+"?chainId=420"
 treasuryHTTP(t,h,p,http.StatusServiceUnavailable)
 if err=backend.ConfigureTreasury(treasuryBindingJSON(th(999)));err!=nil{t.Fatal(err)}
 treasuryHTTP(t,h,p,http.StatusServiceUnavailable)
 if err=backend.ConfigureTreasury(treasuryBindingJSON(th(900)));err!=nil{t.Fatal(err)}
 treasuryHTTP(t,h,p,http.StatusServiceUnavailable)
}

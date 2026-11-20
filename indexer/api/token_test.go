package api

import (
 "context"
 "encoding/json"
 "errors"
 "fmt"
 "net/http"
 "net/http/httptest"
 "path/filepath"
 "testing"
 "time"

 "github.com/420integrated/420-integrated/indexer/model"
 "github.com/420integrated/420-integrated/indexer/store"
 "github.com/420integrated/420-integrated/indexer/tokenread"
)

func TestTokenFileStoreHTTPCheckpointRollback(t *testing.T){
 w:=func(n uint64)string{return fmt.Sprintf("%064x",n)}
 h:=func(n uint64)string{return "0x"+w(n)}
 a:=func(n uint64)string{return fmt.Sprintf("0x%040x",n)}
 aw:=func(v string)string{return "0x"+fmt.Sprintf("%024s","")+v[2:]}
 // fmt's zero flag on strings is not an ABI requirement; construct exact padding.
 aw=func(v string)string{return "0x000000000000000000000000"+v[2:]}
 b:=tokenread.Binding{ChainID:31337,GenesisHash:h(1),Factory:a(10),Vault:a(11),Accounting:a(12),FactoryCodeHash:h(21),MetadataHash:h(22),ManifestHash:h(23),DependencyRoot:h(24),InterfaceHash:h(25)}
 token:=a(20);creator:=a(30)
 log:=func(block,index uint64,address string,topics []string,data string)model.LogRecord{return model.LogRecord{ChainID:b.ChainID,BlockNumber:block,BlockHash:h(block+1),TransactionHash:h(block+100),LogIndex:index,Address:address,Topics:topics,Data:data}}
 publication:=[]model.LogRecord{
 log(1,0,tokenread.Registry,[]string{tokenread.Published,tokenread.ServiceID,h(1),aw(b.Factory)},"0x"+b.FactoryCodeHash[2:]+b.MetadataHash[2:]+w(1)),
 log(1,1,tokenread.Registry,[]string{tokenread.Profile,tokenread.ServiceID,h(1)},"0x"+w(3)+b.ManifestHash[2:]+b.DependencyRoot[2:]+b.InterfaceHash[2:]),
 }
 creation:=[]model.LogRecord{
 log(2,1,b.Factory,[]string{tokenread.Deployed,aw(token),aw(creator),"0x0517055aa8d8da1332a6a60f625f6d07c05e47f5b365f33b6fec4209c040ce0a"},"0x"+w(1)+w(31)+tokenread.FeeWord),
 log(2,2,b.Accounting,[]string{tokenread.Deposit,tokenread.VaultID,h(0)},"0x"+tokenread.FeeWord+tokenread.FeeWord),
 log(2,3,b.Vault,[]string{tokenread.Native,aw(b.Factory)},"0x"+tokenread.FeeWord),
 log(2,4,b.Factory,[]string{tokenread.Fee,aw(b.Vault),tokenread.VaultID},"0x"+tokenread.FeeWord),
 }
 path:=filepath.Join(t.TempDir(),"index.json");s,err:=store.NewFileStore(path);if err!=nil{t.Fatal(err)}
 block:=func(n uint64)model.BlockRecord{return model.BlockRecord{ChainID:b.ChainID,Number:n,Hash:h(n+1),ParentHash:h(n),Timestamp:uint64(time.Now().Unix()),Finality:model.FinalityHead,SchemaVersion:"v1"}}
 if err=s.PutBlock(block(0));err!=nil{t.Fatal(err)}
 put:=func(n,status uint64,logs []model.LogRecord){t.Helper();tx:=model.TransactionRecord{ChainID:b.ChainID,BlockNumber:n,BlockHash:h(n+1),Hash:h(100+n),From:creator,To:b.Factory,ValueWei:"0",Input:"0x"};receipt:=model.ReceiptRecord{ChainID:b.ChainID,BlockNumber:n,BlockHash:h(n+1),TransactionHash:tx.Hash,Status:status};if err:=s.PutBundle(block(n),[]model.TransactionRecord{tx},[]model.ReceiptRecord{receipt},logs);err!=nil{t.Fatal(err)}}
 put(1,1,publication);put(2,1,creation)
 cp:=model.ChainCheckpoint{ChainID:b.ChainID,IndexedHeight:2,IndexedHash:h(3),FinalizedHash:h(1),SafeHash:h(1),SchemaVersion:"v1",UpdatedAt:time.Now()}
 if err=s.SaveCheckpoint(cp);err!=nil{t.Fatal(err)}
 raw,_:=json.Marshal(b)
 backend:=NewStoreBackend(s,nil);if err=backend.ConfigureToken(string(raw));err!=nil{t.Fatal(err)}
 health:=NewRuntimeHealth();backend.WithRuntimeHealth(health)
 server:=httptest.NewServer(NewServer(backend).Handler());defer server.Close()
 read:=func()(tokenread.Projection,error){return tokenread.ReadHTTP(context.Background(),server.Client(),server.URL,b.ChainID,token)}
 p,err:=read();if err!=nil||p.SnapshotHash!=h(3)||p.CreationFeeWei!=tokenread.FeeWei{t.Fatalf("%+v %v",p,err)}
 health.MarkFailure("ingestion interrupted");if _,err=read();!errors.Is(err,tokenread.ErrUnavailable){t.Fatal(err)};health.MarkHealthy()
 put(2,0,creation);if _,err=read();!errors.Is(err,tokenread.ErrUnavailable){t.Fatal("failed receipt accepted",err)};put(2,1,creation)
 if err=s.DeleteBlocksAbove(1);err!=nil{t.Fatal(err)}
 if _,err=read();!errors.Is(err,tokenread.ErrNotFound){t.Fatal("rolled back token remains visible",err)}
 s2,err:=store.NewFileStore(path);if err!=nil{t.Fatal(err)};backend2:=NewStoreBackend(s2,nil);if err=backend2.ConfigureToken(string(raw));err!=nil{t.Fatal(err)}
 if _,err=backend2.TokenDeployment(b.ChainID,token);!errors.Is(err,tokenread.ErrNotFound){t.Fatal("restart resurrected token",err)}
 req:=httptest.NewRequest(http.MethodGet,"/v1/token/deployments/"+token+"?chainId=31337&chainId=420",nil)
 rec:=httptest.NewRecorder();NewServer(backend2).Handler().ServeHTTP(rec,req);if rec.Code!=400{t.Fatal("ambiguous chain accepted",rec.Code)}
 b.GenesisHash=h(999);raw,_=json.Marshal(b);if err=backend2.ConfigureToken(string(raw));err!=nil{t.Fatal(err)};if _,err=backend2.TokenDeployment(b.ChainID,token);!errors.Is(err,tokenread.ErrUnavailable){t.Fatal("wrong genesis accepted")}
}

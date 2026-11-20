package tokenread

import (
 "testing"
 "fmt"
 "strings"
 "errors"
 "github.com/420integrated/420-integrated/indexer/model"
)
func hh(n uint64)string{return "0x"+w(n)}
func aa(n uint64)string{return fmt.Sprintf("0x%040x",n)}
func fixture()(Binding,model.ChainCheckpoint,string,[]model.LogRecord){
 b:=Binding{ChainID:31337,GenesisHash:hh(1),Factory:aa(10),Vault:aa(11),Accounting:aa(12),FactoryCodeHash:hh(21),MetadataHash:hh(22),ManifestHash:hh(23),DependencyRoot:hh(24),InterfaceHash:hh(25)}
 cp:=model.ChainCheckpoint{ChainID:b.ChainID,IndexedHeight:2,IndexedHash:hh(3)}
 token:=aa(20);creator:=aa(30)
 log:=func(block,idx uint64,address string,topics []string,data string)model.LogRecord{return model.LogRecord{ChainID:b.ChainID,BlockNumber:block,BlockHash:hh(block+1),TransactionHash:hh(block+100),TransactionIndex:0,LogIndex:idx,Address:address,Topics:topics,Data:data}}
 var id string;for k,v:=range templates{if v=="ERC20_FIXED"{id=k}}
 logs:=[]model.LogRecord{
 log(1,0,Registry,[]string{Published,ServiceID,hh(1),aw(b.Factory)},"0x"+b.FactoryCodeHash[2:]+b.MetadataHash[2:]+w(1)),
 log(1,1,Registry,[]string{Profile,ServiceID,hh(1)},"0x"+w(3)+b.ManifestHash[2:]+b.DependencyRoot[2:]+b.InterfaceHash[2:]),
 log(2,1,b.Factory,[]string{Deployed,aw(token),aw(creator),id},"0x"+w(1)+w(31)+FeeWord),
 log(2,2,b.Accounting,[]string{Deposit,VaultID,hh(0)},"0x"+FeeWord+FeeWord),
 log(2,3,b.Vault,[]string{Native,aw(b.Factory)},"0x"+FeeWord),
 log(2,4,b.Factory,[]string{Fee,aw(b.Vault),VaultID},"0x"+FeeWord),
 };return b,cp,token,logs
}
func TestTokenAllTemplatesAndBatch(t *testing.T){
 for id,name:=range templates{t.Run(name,func(t *testing.T){
 b,cp,token,logs:=fixture();logs[2].Topics[3]=id
 p,err:=Project(b,cp,token,logs);if err!=nil||p.Template!=name||p.CreationFeeWei!=FeeWei||*p.Authoritative{t.Fatalf("%+v %v",p,err)}
 other:=aa(40);for _,l:=range append([]model.LogRecord(nil),logs[2:]...){l.LogIndex+=4;l.Topics=append([]string(nil),l.Topics...);if l.Topics[0]==Deployed{l.Topics[1]=aw(other)};logs=append(logs,l)}
 for _,a:=range []string{token,other}{if _,err:=Project(b,cp,a,logs);err!=nil{t.Fatal(err)}}
 })}
}
func TestTokenRejectsInvalidEvidence(t *testing.T){
 for name,mutate:=range map[string]func(*Binding,*model.ChainCheckpoint,[]model.LogRecord){
 "wrong chain":func(b *Binding,c *model.ChainCheckpoint,l []model.LogRecord){c.ChainID++},
 "wrong checkpoint":func(b *Binding,c *model.ChainCheckpoint,l []model.LogRecord){c.IndexedHash=hh(99)},
 "wrong registry code":func(b *Binding,c *model.ChainCheckpoint,l []model.LogRecord){b.FactoryCodeHash=hh(99)},
 "wrong profile":func(b *Binding,c *model.ChainCheckpoint,l []model.LogRecord){b.DependencyRoot=hh(99)},
 "wrong fee":func(b *Binding,c *model.ChainCheckpoint,l []model.LogRecord){l[5].Data=hh(41)},
 "wrong accounting":func(b *Binding,c *model.ChainCheckpoint,l []model.LogRecord){l[3].Data="0x"+FeeWord+w(1)},
 "wrong receipt":func(b *Binding,c *model.ChainCheckpoint,l []model.LogRecord){l[4].TransactionHash=hh(99)},
 "forged emitter":func(b *Binding,c *model.ChainCheckpoint,l []model.LogRecord){l[4].Address=aa(99)},
 "duplicate log":func(b *Binding,c *model.ChainCheckpoint,l []model.LogRecord){l[5].LogIndex=l[4].LogIndex},
 "out of order":func(b *Binding,c *model.ChainCheckpoint,l []model.LogRecord){l[4].LogIndex,l[5].LogIndex=l[5].LogIndex,l[4].LogIndex},
 "unknown template":func(b *Binding,c *model.ChainCheckpoint,l []model.LogRecord){l[2].Topics[3]=hh(99)},
 }{t.Run(name,func(t *testing.T){b,cp,token,logs:=fixture();mutate(&b,&cp,logs);if _,err:=Project(b,cp,token,logs);err==nil{t.Fatal("unsafe evidence accepted")}})}
 b,cp,token,logs:=fixture();if _,err:=Project(b,cp,token,logs[:2]);!errors.Is(err,ErrNotFound){t.Fatal(err)}
 if _,err:=Project(b,cp,token,logs[:5]);err==nil{t.Fatal("missing fee accepted")}
 if _,err:=ParseBinding(strings.ReplaceAll(`{"unknown":1}`,"unknown","chainId"));err==nil{t.Fatal("incomplete binding accepted")}
}

package store

import (
 "database/sql"
 "errors"
 "fmt"
 "net/url"
 "os"
 "testing"
 "time"

 "github.com/420integrated/420-integrated/indexer/model"
)

func TestPostgresStoreRejectsUnverifiedRemoteTransport(t *testing.T) {
 for _,dsn:=range []string{
  "postgres://user:pass@some-remote-host.invalid:5432/postgres?sslmode=disable",
  "postgres://user:pass@some-remote-host.invalid:5432/postgres?sslmode=require",
  "http://127.0.0.1:5432/postgres",
 }{
  if _,err:=NewPostgresStore(dsn);err==nil{
   t.Fatalf("unsafe PostgreSQL Indexer transport was accepted: %s",dsn)
  }
 }
}

// This test runs only when a disposable PostgreSQL16 is available, not on a
// developer's default production database. It creates and destroys an entirely
// separate test database and checks crash/restart, native logs, source finality
// and two-process concurrent-writer rejection.
func TestPostgresStoreNativeAndSignedBundleDurability(t *testing.T) {
 base:=os.Getenv("INDEXER_PG_URL")
 if base==""{t.Skip("INDEXER_PG_URL not configured for isolated PostgreSQL16 qualification")}
 u,err:=url.Parse(base)
 if err!=nil{t.Fatal(err)}
 u.Query()
 q:=u.Query();q.Set("sslmode","disable");u.RawQuery=q.Encode()
 admin,err:=sql.Open("postgres",u.String())
 if err!=nil{t.Fatal(err)}
 defer admin.Close()
 name:=fmt.Sprintf("idx_go_qualification_%d",time.Now().UnixNano())
 if _,err=admin.Exec("CREATE DATABASE "+name);err!=nil{t.Fatal(err)}
 defer func(){if _,err:=admin.Exec("DROP DATABASE "+name+" WITH (FORCE)");err!=nil{t.Error(err)}}()
 u.Path="/"+name
 dsn:=u.String()
 s,err:=NewPostgresStore(dsn)
 if err!=nil{t.Fatal(err)}
 zero:="0x0000000000000000000000000000000000000000000000000000000000000000"
 producer:=&model.BlockProducer{ConsensusSlot:2,ProducerSeat:0,ProposerRank:0,
  ConsensusBlockRoot:"0x"+fmt.Sprintf("%064x",23),Certified:true}
 b0:=model.BlockRecord{ChainID:420,Number:0,Hash:"0xgenesis",SchemaVersion:"v1"}
 b1:=model.BlockRecord{ChainID:420,Number:1,Hash:"0xb1",ParentHash:"0xgenesis",
  Finality:model.FinalityFinalized,SchemaVersion:"v1"}
 b2:=model.BlockRecord{ChainID:420,Number:2,Hash:"0xb2",ParentHash:"0xb1",
  Finality:model.FinalityHead,Producer:producer,SchemaVersion:"v1"}
 for _,b:=range []model.BlockRecord{b0,b1}{if err:=s.PutBlock(b);err!=nil{t.Fatal(err)}}
 tx:=model.TransactionRecord{ChainID:420,BlockNumber:2,BlockHash:b2.Hash,Hash:"0xtx",
  From:"0xa1",To:"0xa2",ValueWei:"1",Input:"0x",Index:0}
 receipt:=model.ReceiptRecord{ChainID:420,BlockNumber:2,BlockHash:b2.Hash,
  TransactionHash:tx.Hash,Status:1,GasUsed:21000,EffectiveGasPriceWei:"1000000000",
  ActualFeeWei:"21000000000000"}
 native:=model.LogRecord{ChainID:420,BlockNumber:2,BlockHash:b2.Hash,
  TransactionHash:zero,LogIndex:0,Address:"0x0420",
  DecoderVersion:"native-systemcall-v1"}
 if err:=s.PutBundle(b2,[]model.TransactionRecord{tx},[]model.ReceiptRecord{receipt},[]model.LogRecord{native});err!=nil{t.Fatal(err)}
 cp:=model.ChainCheckpoint{ChainID:420,IndexedHeight:2,IndexedHash:b2.Hash,
  SafeHeight:1,SafeHash:b1.Hash,FinalizedHeight:1,FinalizedHash:b1.Hash,
  SchemaVersion:"v1"}
 if err:=s.SaveCheckpoint(cp);err!=nil{t.Fatal(err)}
 if err:=s.Close();err!=nil{t.Fatal(err)}
 reopened,err:=NewPostgresStore(dsn)
 if err!=nil{t.Fatal(err)}
 defer reopened.Close()
 got,ok,err:=reopened.Checkpoint()
 if err!=nil||!ok||got.IndexedHash!=b2.Hash||got.FinalizedHash!=b1.Hash{
  t.Fatalf("durable certified PostgreSQL checkpoint lost: %+v %v %v",got,ok,err)
 }
 logs,err:=reopened.LogsByBlock(2)
 if err!=nil||len(logs)!=1||logs[0].TransactionHash!=zero||
  logs[0].DecoderVersion!="native-systemcall-v1"{
  t.Fatalf("authenticated native logs lost across PostgreSQL restart: %+v %v",logs,err)
 }
 if txRecord,ok,err:=reopened.Transaction(tx.Hash);err!=nil||!ok||txRecord.BlockHash!=b2.Hash{
  t.Fatalf("signed EVM tx lost across PostgreSQL restart: %+v %v %v",txRecord,ok,err)
 }
 if err:=reopened.DeleteBlocksAbove(0);!errors.Is(err,ErrFinalizedMutation){
  t.Fatalf("rolled back below certified finality: %v",err)
 }
 stale,err:=NewPostgresStore(dsn)
 if err!=nil{t.Fatal(err)}
 defer stale.Close()
 b3:=model.BlockRecord{ChainID:420,Number:3,Hash:"0xb3",ParentHash:b2.Hash}
 if err:=reopened.PutBlock(b3);err!=nil{t.Fatal(err)}
 if err:=stale.PutBlock(model.BlockRecord{ChainID:420,Number:3,Hash:"0xfork"});err==nil{
  t.Fatal("concurrent stale writer bypassed atomic PostgreSQL version lock")
 }
 if _,ok,_:=stale.Block(3);ok{t.Fatal("failed PostgreSQL writer retained uncommitted fork")}
 validated,err:=NewPostgresStore(dsn)
 if err!=nil{t.Fatal(err)}
 defer validated.Close()
 if b,ok,_:=validated.Block(3);!ok||b.Hash!=b3.Hash{
  t.Fatalf("PostgreSQL lost single canonical writer after restart: %+v %v",b,ok)
 }
}

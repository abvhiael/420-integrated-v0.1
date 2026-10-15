package complianceauth

import (
 "context"
 "errors"
 "sync"
 "testing"
 "time"
)
type c054Authority struct{denied bool;onVerify func()}
func(a c054Authority) VerifyStage(_ context.Context,_ DOOBrStageRequest,_ time.Time)error{
 if a.onVerify!=nil{a.onVerify()}
 if a.denied{return ErrDOOBrStageDenied}
 return nil
}
func TestC054DOOBrStagesBypassAndReplay(t *testing.T){
 now:=time.Date(2026,10,11,20,0,0,0,time.UTC)
 initial:=DOOBrStageState{TenantID:"tenant",OrderID:"order",Revision:1}
 store:=&MemoryDOOBrStageStore{States:map[string]DOOBrStageState{doobrKey("tenant","order"):initial}}
 stages:=[]DOOBrStage{DOOBrAccept,DOOBrPickup,DOOBrDispatch,DOOBrHandover}
 entries:=[]DOOBrEntry{EntryAPI,EntryAlternate,EntryMobileReplay,EntryOperator}
 for i,stage:=range stages {
  req:=DOOBrStageRequest{TenantID:"tenant",OrderID:"order",Stage:stage,Entry:entries[i],ActorID:"verified-operator",IdempotencyKey:"nonce"+string(rune('a'+i)),FactsDigest:Digest([]byte(stage)),ExpectedRevision:uint64(i+1)}
  if _,err:=AdvanceDOOBrStage(context.Background(),store,c054Authority{denied:true},req,now);err==nil{t.Fatalf("%s bypassed stage authority",entries[i])}
  state,err:=AdvanceDOOBrStage(context.Background(),store,c054Authority{},req,now)
  if err!=nil||state.Stage!=stage||state.Revision!=uint64(i+2){t.Fatalf("%s %s: %+v %v",entries[i],stage,state,err)}
  if _,err:=AdvanceDOOBrStage(context.Background(),store,c054Authority{},req,now);err==nil{t.Fatal("replay accepted")}
 }
 old:=DOOBrStageRequest{TenantID:"tenant",OrderID:"order",Stage:DOOBrHandover,Entry:EntryOperator,ActorID:"operator",IdempotencyKey:"replay",FactsDigest:Digest([]byte("evidence")),ExpectedRevision:5}
 if _,err:=AdvanceDOOBrStage(context.Background(),store,c054Authority{},old,now);err==nil{t.Fatal("repeat handover allowed")}
 fresh:=&MemoryDOOBrStageStore{States:map[string]DOOBrStageState{doobrKey("tenant","order"):initial}}
 req:=DOOBrStageRequest{TenantID:"tenant",OrderID:"order",Stage:DOOBrAccept,Entry:EntryMobileReplay,ActorID:"operator",IdempotencyKey:"key",FactsDigest:Digest([]byte("facts")),ExpectedRevision:1}
 for _,tc:=range []struct{name string;change func(*DOOBrStageRequest)}{
 {"cross tenant",func(x *DOOBrStageRequest){x.TenantID="other"}},
 {"cross order",func(x *DOOBrStageRequest){x.OrderID="other"}},
 {"offline stale revision",func(x *DOOBrStageRequest){x.ExpectedRevision=0}},
 {"skip stage",func(x *DOOBrStageRequest){x.Stage=DOOBrDispatch}},
 {"unknown endpoint",func(x *DOOBrStageRequest){x.Entry="rogue"}},
 {"no idempotency",func(x *DOOBrStageRequest){x.IdempotencyKey=""}},
 {"invalid facts",func(x *DOOBrStageRequest){x.FactsDigest="bad"}},
 }{copy:=req;tc.change(&copy);if _,err:=AdvanceDOOBrStage(context.Background(),fresh,c054Authority{},copy,now);err==nil{t.Fatalf("%s accepted",tc.name)}}
 if _,err:=AdvanceDOOBrStage(context.Background(),fresh,c054Authority{},req,now);err!=nil{t.Fatal(err)}
 // Multiple endpoints compete for one revision. Only one can commit.
 contested:=&MemoryDOOBrStageStore{States:map[string]DOOBrStageState{doobrKey("tenant","order"):initial}}
 var wg sync.WaitGroup
 results:=make(chan error,32)
 for i:=0;i<32;i++{wg.Add(1);go func(i int){defer wg.Done();x:=req;x.IdempotencyKey="race"+string(rune('A'+i));_,err:=AdvanceDOOBrStage(context.Background(),contested,c054Authority{},x,now);results<-err}(i)}
 wg.Wait();close(results)
 success:=0
 for err:=range results{if err==nil{success++}else if !errors.Is(err,ErrDOOBrStageDenied){t.Fatal(err)}}
 if success!=1{t.Fatalf("CAS must accept one transition, got %d",success)}
}

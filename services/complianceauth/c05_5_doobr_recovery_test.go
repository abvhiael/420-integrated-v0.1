package complianceauth

import (
 "context"
 "errors"
 "sync"
 "testing"
 "time"
)
type c055Store struct{mu sync.Mutex; state DOOBrRecoveryState; unavailable bool}
func(s *c055Store)LoadRecovery(_ context.Context,tenant,order string)(DOOBrRecoveryState,error){s.mu.Lock();defer s.mu.Unlock();if s.unavailable||s.state.TenantID!=tenant||s.state.OrderID!=order{return DOOBrRecoveryState{},ErrRecoveryDenied};return s.state,nil}
func(s *c055Store)CompareAndSwapRecovery(_ context.Context,old,next DOOBrRecoveryState)(bool,error){s.mu.Lock();defer s.mu.Unlock();if s.unavailable{return false,ErrRecoveryDenied};if s.state!=old{return false,nil};s.state=next;return true,nil}
type c055Safety struct{denied bool}
func(a c055Safety)VerifySafetyAction(context.Context,DOOBrRecoveryRequest,DOOBrRecoveryState,time.Time)error{if a.denied{return ErrRecoveryDenied};return nil}
func TestC055RefusalReturnPolicyChangeRecovery(t *testing.T){
 now:=time.Date(2026,10,11,20,0,0,0,time.UTC)
 prev:=Digest([]byte("prior signed receipt"));next:=Digest([]byte("new policy"))
 state:=DOOBrRecoveryState{TenantID:"tenant",OrderID:"order",Revision:1,Phase:"IN_TRANSIT",SaleHalted:true,PriorReceiptDigest:prev,NewPolicyDigest:next}
 store:=&c055Store{state:state}
 req:=DOOBrRecoveryRequest{TenantID:"tenant",OrderID:"order",ActorID:"courier",IdempotencyKey:"first",FactsDigest:Digest([]byte("refusal facts")),PriorReceiptDigest:prev,NewPolicyDigest:next,Action:RecoveryRefuse,ExpectedRevision:1,PolicyChange:true}
 if _,err:=RecoverDOOBrOrder(context.Background(),store,c055Safety{denied:true},req,now);err==nil{t.Fatal("independent safety denial bypassed")}
 bad:=req;bad.NewPolicyDigest=Digest([]byte("stale"));if _,err:=RecoverDOOBrOrder(context.Background(),store,c055Safety{},bad,now);err==nil{t.Fatal("stale activation accepted")}
 bad=req;bad.TenantID="other";if _,err:=RecoverDOOBrOrder(context.Background(),store,c055Safety{},bad,now);err==nil{t.Fatal("tenant crossover")}
 bad=req;bad.Action=RecoveryReturn;if _,err:=RecoverDOOBrOrder(context.Background(),store,c055Safety{},bad,now);err==nil{t.Fatal("return without custody/refusal")}
 out,err:=RecoverDOOBrOrder(context.Background(),store,c055Safety{},req,now)
 if err!=nil||out.Phase!="REFUSED"||!out.SaleHalted{t.Fatalf("refuse %+v %v",out,err)}
 if _,err:=RecoverDOOBrOrder(context.Background(),store,c055Safety{},req,now);err==nil{t.Fatal("replay accepted")}
 returnReq:=req;returnReq.Action=RecoveryReturn;returnReq.ExpectedRevision=2;returnReq.IdempotencyKey="return";returnReq.FactsDigest=Digest([]byte("return custody"))
 out,err=RecoverDOOBrOrder(context.Background(),store,c055Safety{},returnReq,now)
 if err!=nil||out.Phase!="RETURNED"||!out.SaleHalted{t.Fatalf("return %+v %v",out,err)}
 if _,err:=RecoverDOOBrOrder(context.Background(),store,c055Safety{},returnReq,now);err==nil{t.Fatal("terminal replay accepted")}
 store=&c055Store{state:state}
 var wg sync.WaitGroup
 errs:=make(chan error,24)
 for i:=0;i<24;i++{wg.Add(1);go func(i int){defer wg.Done();q:=req;q.IdempotencyKey="race"+string(rune('a'+i));_,e:=RecoverDOOBrOrder(context.Background(),store,c055Safety{},q,now);errs<-e}(i)}
 wg.Wait();close(errs);passed:=0
 for e:=range errs{if e==nil{passed++}else if !errors.Is(e,ErrRecoveryDenied){t.Fatal(e)}}
 if passed!=1{t.Fatalf("recovery CAS allowed %d concurrent winners",passed)}
 store=&c055Store{state:state,unavailable:true}
 if _,err:=RecoverDOOBrOrder(context.Background(),store,c055Safety{},req,now);err==nil{t.Fatal("outage accepted")}
}

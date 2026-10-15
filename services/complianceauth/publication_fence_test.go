package complianceauth
import("context";"sync";"testing";"time")
func TestC038PublicationAcrossInstances(t *testing.T){
 ctx:=context.Background();now:=time.Date(2026,10,10,20,0,0,0,time.UTC)
 old:=PublicationFence{Scope:"BC/doobr/delivery",Sequence:7,RevocationEpoch:3,PolicyDigest:Digest([]byte("old")),DependencyDigest:Digest([]byte("deps-old")),ExpiresAt:now.Add(time.Hour)}
 next:=old;next.Sequence++;next.RevocationEpoch++;next.PolicyDigest=Digest([]byte("new"));next.DependencyDigest=Digest([]byte("deps-new"))
 store:=&MemoryPublicationStore{entries:map[string]PublicationFence{old.Scope:old}}
 a,b:=&PublicationCache{},&PublicationCache{}
 if _,e:=a.ReadCurrent(ctx,store,old,now);e!=nil{t.Fatal(e)}
 if _,e:=b.ReadCurrent(ctx,store,old,now);e!=nil{t.Fatal(e)}
 if e:=AdvancePublication(ctx,store,old,next,now);e!=nil{t.Fatal(e)}
 for _,c:=range []*PublicationCache{a,b}{
  if _,e:=c.ReadCurrent(ctx,store,old,now);e==nil{t.Fatal("stale cache permitted")}
  if _,e:=c.ReadCurrent(ctx,store,next,now);e!=nil{t.Fatal(e)}
 }
 if e:=AdvancePublication(ctx,store,old,next,now);e==nil{t.Fatal("replay allowed")}
 rollback:=old;rollback.Sequence=9;rollback.RevocationEpoch=2
 if e:=AdvancePublication(ctx,store,next,rollback,now);e==nil{t.Fatal("epoch rollback allowed")}
 if _,e:=a.ReadCurrent(ctx,nil,next,now);e==nil{t.Fatal("unavailable authority allowed")}
 if _,e:=a.ReadCurrent(ctx,store,next,now.Add(2*time.Hour));e==nil{t.Fatal("expired publication allowed")}
 changed:=next;changed.DependencyDigest=Digest([]byte("other"))
 if _,e:=a.ReadCurrent(ctx,store,changed,now);e==nil{t.Fatal("changed dependency accepted")}
 newer:=next;newer.Sequence++
 var wg sync.WaitGroup;success:=0;var mu sync.Mutex
 for i:=0;i<32;i++{wg.Add(1);go func(){defer wg.Done();if AdvancePublication(ctx,store,next,newer,now)==nil{mu.Lock();success++;mu.Unlock()}}()}
 wg.Wait();if success!=1{t.Fatalf("CAS publication race: %d winners",success)}
 if _,e:=b.ReadCurrent(ctx,store,next,now);e==nil{t.Fatal("other instance served stale epoch")}
}

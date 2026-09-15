package storage

import (
	"context"
	"crypto/sha256"
	"fmt"
	"os"
	"testing"
	"time"
)

type cacheCanonicalStub struct { valid map[string]bool; err error }
func (s cacheCanonicalStub) ValidateCacheEntry(_ context.Context, key CacheKey) (bool,error) {
	if s.err != nil { return false,s.err }
	id,_:=CanonicalCacheKey(key)
	v,ok:=s.valid[id]
	return ok&&v,nil
}

func reconcileKey(object, manifest string, index uint32, payload []byte) CacheKey {
	sum:=sha256.Sum256(payload)
	return CacheKey{ObjectID:object,ManifestID:manifest,ShardIndex:index,ShardRoot:"0x"+fmt.Sprintf("%x",sum[:]),SizeBytes:uint64(len(payload))}
}

func TestPersistentCacheReconcileInvalidatesCanonicalMismatch(t *testing.T){
	now:=time.Unix(1000,0).UTC(); policy:=CachePolicy{MaxBytes:1024,MaxEntries:8,DefaultTTL:time.Hour,MaxTTL:2*time.Hour}
	p,err:=NewPersistentCacheRuntime(t.TempDir(),policy);if err!=nil{t.Fatal(err)}
	keep:=reconcileKey("obj1","man1",0,[]byte("keep")); drop:=reconcileKey("obj2","man2",1,[]byte("drop"))
	if _,err=p.Put(keep,[]byte("keep"),now,time.Hour);err!=nil{t.Fatal(err)}
	if _,err=p.Put(drop,[]byte("drop"),now,time.Hour);err!=nil{t.Fatal(err)}
	keepID,_:=CanonicalCacheKey(keep); dropID,_:=CanonicalCacheKey(drop)
	res,err:=p.Reconcile(context.Background(),now.Add(time.Minute),cacheCanonicalStub{valid:map[string]bool{keepID:true,dropID:false}});if err!=nil{t.Fatal(err)}
	if res.Checked!=2||res.Kept!=1||len(res.Invalidated)!=1||res.Invalidated[0]!=dropID{t.Fatalf("bad result %+v",res)}
	if _,_,err=p.Get(drop,now.Add(time.Minute));err==nil{t.Fatal("expected invalidated cache miss")}
	if _,_,err=p.Get(keep,now.Add(time.Minute));err!=nil{t.Fatal(err)}
}

func TestPersistentCacheReconcileDropsCorruptPayload(t *testing.T){
	now:=time.Unix(1000,0).UTC(); policy:=CachePolicy{MaxBytes:1024,MaxEntries:8,DefaultTTL:time.Hour,MaxTTL:2*time.Hour}
	p,err:=NewPersistentCacheRuntime(t.TempDir(),policy);if err!=nil{t.Fatal(err)}
	key:=reconcileKey("obj","man",0,[]byte("good")); if _,err=p.Put(key,[]byte("good"),now,time.Hour);err!=nil{t.Fatal(err)}
	id,_:=CanonicalCacheKey(key); if err=os.WriteFile(p.payloadPath(id),[]byte("bad"),0o644);err!=nil{t.Fatal(err)}
	res,err:=p.Reconcile(context.Background(),now.Add(time.Minute),cacheCanonicalStub{valid:map[string]bool{id:true}});if err!=nil{t.Fatal(err)}
	if len(res.Invalidated)!=1||res.Invalidated[0]!=id{t.Fatalf("bad result %+v",res)}
}

func TestPersistentCacheReconcileRemovesOrphanPayloads(t *testing.T){
	now:=time.Unix(1000,0).UTC(); policy:=CachePolicy{MaxBytes:1024,MaxEntries:8,DefaultTTL:time.Hour,MaxTTL:2*time.Hour}
	p,err:=NewPersistentCacheRuntime(t.TempDir(),policy);if err!=nil{t.Fatal(err)}
	orphan:=p.dataDir()+string(os.PathSeparator)+"orphan.cache"; if err=os.WriteFile(orphan,[]byte("orphan"),0o644);err!=nil{t.Fatal(err)}
	if _,err=p.Reconcile(context.Background(),now,cacheCanonicalStub{valid:map[string]bool{}});err!=nil{t.Fatal(err)}
	if _,err=os.Stat(orphan);!os.IsNotExist(err){t.Fatalf("orphan still present: %v",err)}
}

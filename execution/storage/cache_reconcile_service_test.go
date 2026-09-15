package storage

import (
	"context"
	"errors"
	"testing"
	"time"
)

type cacheCanonicalSequence struct { failures int }
func (c *cacheCanonicalSequence) ValidateCacheEntry(context.Context, CacheKey) (bool,error) {
	if c.failures > 0 { c.failures--; return false, errors.New("canonical unavailable") }
	return true,nil
}

func TestCacheReconcileServiceBackoffAndReset(t *testing.T) {
	policy:=CachePolicy{MaxBytes:1024,MaxEntries:8,DefaultTTL:time.Hour,MaxTTL:2*time.Hour}
	p,err:=NewPersistentCacheRuntime(t.TempDir(),policy); if err!=nil{t.Fatal(err)}
	canonical:=&cacheCanonicalSequence{failures:2}
	s,err:=NewCacheReconcileService(p,canonical,time.Minute,5*time.Second,20*time.Second); if err!=nil{t.Fatal(err)}
	now:=time.Unix(100,0)
	_,delay,err:=s.RunOnce(context.Background(),now); if err==nil||delay!=5*time.Second{t.Fatalf("first failure delay=%v err=%v",delay,err)}
	_,delay,err=s.RunOnce(context.Background(),now.Add(time.Second)); if err==nil||delay!=10*time.Second{t.Fatalf("second failure delay=%v err=%v",delay,err)}
	_,delay,err=s.RunOnce(context.Background(),now.Add(2*time.Second)); if err!=nil||delay!=time.Minute{t.Fatalf("success delay=%v err=%v",delay,err)}
	m:=s.Metrics(); if m.Runs!=3||m.Failures!=2||m.Successes!=1||m.ConsecutiveFailures!=0||m.LastError!=""{t.Fatalf("bad metrics %+v",m)}
}

func TestCacheReconcileServiceTriggeredInvalidation(t *testing.T) {
	policy:=CachePolicy{MaxBytes:1024,MaxEntries:8,DefaultTTL:time.Hour,MaxTTL:2*time.Hour}
	p,err:=NewPersistentCacheRuntime(t.TempDir(),policy); if err!=nil{t.Fatal(err)}
	payload:=[]byte("cache-data")
	key:=CacheKey{ObjectID:"0x01",ManifestID:"0x02",ShardIndex:1,ShardRoot:"0x"+sha256Hex(payload),SizeBytes:uint64(len(payload))}
	now:=time.Unix(200,0)
	if _,err:=p.Put(key,payload,now,time.Hour);err!=nil{t.Fatal(err)}
	s,err:=NewCacheReconcileService(p,&cacheCanonicalSequence{},time.Minute,time.Second,time.Minute); if err!=nil{t.Fatal(err)}
	removed,err:=s.InvalidateCanonicalChange(now.Add(time.Second),key); if err!=nil||!removed{t.Fatalf("removed=%v err=%v",removed,err)}
	if _,_,err:=p.Get(key,now.Add(2*time.Second)); !errors.Is(err,ErrCacheMiss){t.Fatalf("expected miss, got %v",err)}
	m:=s.Metrics(); if m.TriggeredEvictions!=1{t.Fatalf("bad metrics %+v",m)}
	removed,err=s.InvalidateCanonicalChange(now.Add(3*time.Second),key); if err!=nil||removed{t.Fatalf("second removal=%v err=%v",removed,err)}
	if s.Metrics().TriggeredEvictions!=1{t.Fatalf("unexpected metric increment")}
}

func TestCacheReconcileServiceRejectsInvalidConfig(t *testing.T) {
	if _,err:=NewCacheReconcileService(nil,nil,0,0,0); !errors.Is(err,ErrCacheReconcileService){t.Fatalf("unexpected err %v",err)}
}

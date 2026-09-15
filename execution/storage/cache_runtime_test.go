package storage

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"testing"
	"time"
)

type cacheOriginStub struct{ payload []byte; calls int; err error }
func (s *cacheOriginStub) FetchCacheObject(context.Context, CacheKey)([]byte,error){ s.calls++; if s.err!=nil{return nil,s.err}; return append([]byte(nil),s.payload...),nil }

func cacheTestKey(payload []byte, manifest string, index uint32) CacheKey {
	sum:=sha256.Sum256(payload)
	return CacheKey{ObjectID:"object",ManifestID:manifest,ShardIndex:index,ShardRoot:"0x"+hex.EncodeToString(sum[:]),SizeBytes:uint64(len(payload))}
}

func cachePolicyTest() CachePolicy { return CachePolicy{MaxBytes:8,MaxEntries:2,DefaultTTL:time.Minute,MaxTTL:5*time.Minute} }

func TestCacheRuntimePutGetVerifiesIntegrity(t *testing.T){ r,err:=NewCacheRuntime(cachePolicyTest());if err!=nil{t.Fatal(err)};p:=[]byte("abcd");k:=cacheTestKey(p,"manifest-a",0);now:=time.Unix(100,0);if _,err:=r.Put(k,p,now,time.Minute);err!=nil{t.Fatal(err)};got,e,err:=r.Get(k,now.Add(time.Second));if err!=nil{t.Fatal(err)};if string(got)!="abcd"||e.HitCount!=1{t.Fatalf("bad get %q %+v",got,e)} }

func TestCacheRuntimeRejectsWrongRoot(t *testing.T){ r,_:=NewCacheRuntime(cachePolicyTest());p:=[]byte("abcd");k:=cacheTestKey(p,"manifest-a",0);k.ShardRoot=cacheTestKey([]byte("wxyz"),"manifest-a",0).ShardRoot;if _,err:=r.Put(k,p,time.Now(),time.Minute);!errors.Is(err,ErrCacheIntegrity){t.Fatalf("expected integrity error, got %v",err)} }

func TestCacheRuntimeAppliesLRUEviction(t *testing.T){ r,_:=NewCacheRuntime(cachePolicyTest());now:=time.Unix(100,0);a:=[]byte("aaaa");b:=[]byte("bbbb");c:=[]byte("cccc");ka:=cacheTestKey(a,"manifest-a",0);kb:=cacheTestKey(b,"manifest-b",0);kc:=cacheTestKey(c,"manifest-c",0);if _,err:=r.Put(ka,a,now,time.Minute);err!=nil{t.Fatal(err)};if _,err:=r.Put(kb,b,now.Add(time.Second),time.Minute);err!=nil{t.Fatal(err)};if _,_,err:=r.Get(kb,now.Add(2*time.Second));err!=nil{t.Fatal(err)};if _,err:=r.Put(kc,c,now.Add(3*time.Second),time.Minute);err!=nil{t.Fatal(err)};if _,_,err:=r.Get(ka,now.Add(4*time.Second));!errors.Is(err,ErrCacheMiss){t.Fatalf("expected a evicted, got %v",err)};if _,_,err:=r.Get(kb,now.Add(4*time.Second));err!=nil{t.Fatalf("expected b retained: %v",err)} }

func TestCacheRuntimeExpiresEntries(t *testing.T){ r,_:=NewCacheRuntime(cachePolicyTest());p:=[]byte("abcd");k:=cacheTestKey(p,"manifest-a",0);now:=time.Unix(100,0);if _,err:=r.Put(k,p,now,time.Second);err!=nil{t.Fatal(err)};if _,_,err:=r.Get(k,now.Add(2*time.Second));!errors.Is(err,ErrCacheMiss){t.Fatalf("expected miss, got %v",err)} }

func TestCacheRuntimeOriginFillThenHit(t *testing.T){ r,_:=NewCacheRuntime(cachePolicyTest());p:=[]byte("abcd");k:=cacheTestKey(p,"manifest-a",0);o:=&cacheOriginStub{payload:p};now:=time.Unix(100,0);got,_,hit,err:=r.GetOrFill(context.Background(),k,now,time.Minute,o);if err!=nil{t.Fatal(err)};if hit||string(got)!="abcd"||o.calls!=1{t.Fatalf("bad fill hit=%v calls=%d got=%q",hit,o.calls,got)};_,_,hit,err=r.GetOrFill(context.Background(),k,now.Add(time.Second),time.Minute,o);if err!=nil{t.Fatal(err)};if !hit||o.calls!=1{t.Fatalf("expected cache hit calls=%d",o.calls)} }

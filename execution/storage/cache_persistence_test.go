package storage

import (
	"crypto/sha256"
	"encoding/hex"
	"os"
	"testing"
	"time"
)

func persistentTestKey(payload []byte) CacheKey {
	s := sha256.Sum256(payload)
	return CacheKey{ObjectID:"obj", ManifestID:"manifest", ShardIndex:1, ShardRoot:"0x"+hex.EncodeToString(s[:]), SizeBytes:uint64(len(payload))}
}

func persistentTestPolicy() CachePolicy {
	return CachePolicy{MaxBytes:1024, MaxEntries:8, DefaultTTL:time.Hour, MaxTTL:24*time.Hour}
}

func TestPersistentCacheRecoversVerifiedEntry(t *testing.T) {
	root:=t.TempDir(); now:=time.Unix(100,0).UTC(); payload:=[]byte("persistent-cache")
	p,err:=NewPersistentCacheRuntime(root,persistentTestPolicy()); if err!=nil{t.Fatal(err)}
	key:=persistentTestKey(payload); if _,err:=p.Put(key,payload,now,time.Hour);err!=nil{t.Fatal(err)}
	p2,err:=NewPersistentCacheRuntime(root,persistentTestPolicy()); if err!=nil{t.Fatal(err)}
	if err:=p2.Recover(now.Add(time.Minute));err!=nil{t.Fatal(err)}
	got,entry,err:=p2.Get(key,now.Add(2*time.Minute));if err!=nil{t.Fatal(err)}
	if string(got)!=string(payload)||entry.HitCount!=1{t.Fatalf("unexpected recovered cache entry %+v %q",entry,string(got))}
}

func TestPersistentCacheDropsCorruptPayloadOnRecovery(t *testing.T) {
	root:=t.TempDir(); now:=time.Unix(200,0).UTC(); payload:=[]byte("good")
	p,err:=NewPersistentCacheRuntime(root,persistentTestPolicy()); if err!=nil{t.Fatal(err)}
	key:=persistentTestKey(payload); if _,err:=p.Put(key,payload,now,time.Hour);err!=nil{t.Fatal(err)}
	id,_:=CanonicalCacheKey(key); if err:=os.WriteFile(p.payloadPath(id),[]byte("bad"),0o644);err!=nil{t.Fatal(err)}
	p2,err:=NewPersistentCacheRuntime(root,persistentTestPolicy()); if err!=nil{t.Fatal(err)}
	if err:=p2.Recover(now.Add(time.Minute));err!=nil{t.Fatal(err)}
	if _,_,err:=p2.Get(key,now.Add(2*time.Minute));err!=ErrCacheMiss{t.Fatalf("expected cache miss, got %v",err)}
}

func TestPersistentCacheDropsExpiredEntryOnRecovery(t *testing.T) {
	root:=t.TempDir(); now:=time.Unix(300,0).UTC(); payload:=[]byte("expire")
	p,err:=NewPersistentCacheRuntime(root,persistentTestPolicy()); if err!=nil{t.Fatal(err)}
	key:=persistentTestKey(payload); if _,err:=p.Put(key,payload,now,time.Minute);err!=nil{t.Fatal(err)}
	p2,err:=NewPersistentCacheRuntime(root,persistentTestPolicy()); if err!=nil{t.Fatal(err)}
	if err:=p2.Recover(now.Add(2*time.Minute));err!=nil{t.Fatal(err)}
	if _,_,err:=p2.Get(key,now.Add(2*time.Minute));err!=ErrCacheMiss{t.Fatalf("expected cache miss, got %v",err)}
}

func TestPersistentCacheRejectsCorruptMetadata(t *testing.T) {
	root:=t.TempDir(); if err:=os.WriteFile(root+"/metadata.json",[]byte("{"),0o644);err!=nil{t.Fatal(err)}
	p,err:=NewPersistentCacheRuntime(root,persistentTestPolicy()); if err!=nil{t.Fatal(err)}
	if err:=p.Recover(time.Now());err!=ErrCachePersistence{t.Fatalf("expected persistence error, got %v",err)}
}

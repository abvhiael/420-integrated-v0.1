package storage

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"os"
	"testing"
	"time"
)

type reconcileStateStore struct{ snapshots map[string]AssignmentSnapshot }
func (s *reconcileStateStore) Load(context.Context)(map[string]AssignmentSnapshot,error){out:=map[string]AssignmentSnapshot{};for k,v:=range s.snapshots{out[k]=v};return out,nil}
func (s *reconcileStateStore) Save(_ context.Context,in map[string]AssignmentSnapshot)error{s.snapshots=cloneSnapshots(in);return nil}
func (s *reconcileStateStore) Clear(context.Context)error{s.snapshots=map[string]AssignmentSnapshot{};return nil}

type reconcileReader struct{
	snaps map[string]AssignmentSnapshot
	next map[string]uint32
	missed map[string]uint32
	terminal map[string]bool
	err error
}
func (r reconcileReader) AssignmentByAgreement(_ context.Context,id string)(AssignmentSnapshot,error){if r.err!=nil{return AssignmentSnapshot{},r.err};s,ok:=r.snaps[id];if !ok{return AssignmentSnapshot{},ErrInactiveAssignment};return s,nil}
func (r reconcileReader) Window(context.Context,string,uint32)(Challenge,time.Time,error){return Challenge{},time.Time{},ErrInactiveAssignment}
func (r reconcileReader) ReconcileWindows(_ context.Context,id string,count uint32,_ time.Time)(string,uint32,uint32,bool,error){if r.err!=nil{return "",0,0,false,r.err};next:=count;if v,ok:=r.next[id];ok{next=v};return "settlement-"+id,next,r.missed[id],r.terminal[id],nil}

func reconcileAssignment(payload []byte,agreement,commitment,node string,now time.Time)Assignment{
	s:=sha256.Sum256(payload)
	return Assignment{AgreementID:agreement,CommitmentID:commitment,NodeID:node,ShardRoot:hex.EncodeToString(s[:]),SizeBytes:uint64(len(payload)),StartTime:now.Add(-time.Hour),EndTime:now.Add(time.Hour),Active:true}
}

func TestProviderReconcilerRepairsLocalDrift(t *testing.T){
	now:=time.Unix(2_000_000_000,0).UTC();node:="node-a"
	keepData:=[]byte("keep-data");corruptData:=[]byte("corrupt-data");missingData:=[]byte("missing-data");staleData:=[]byte("stale-data")
	keep:=reconcileAssignment(keepData,"agreement-keep","keep",node,now)
	corrupt:=reconcileAssignment(corruptData,"agreement-corrupt","corrupt",node,now)
	missing:=reconcileAssignment(missingData,"agreement-missing","missing",node,now)
	reader:=reconcileReader{snaps:map[string]AssignmentSnapshot{
		keep.AgreementID:{Assignment:keep,WindowCount:3},
		corrupt.AgreementID:{Assignment:corrupt,WindowCount:3},
		missing.AgreementID:{Assignment:missing,WindowCount:3},
	},next:map[string]uint32{keep.AgreementID:1,corrupt.AgreementID:1,missing.AgreementID:1},missed:map[string]uint32{keep.AgreementID:1}}
	state:=&reconcileStateStore{snapshots:cloneSnapshots(reader.snaps)}
	projection,err:=NewStorageProjection(StorageContracts{Agreement:"agreement-contract"},StorageEventTopics{},reader,state);if err!=nil{t.Fatal(err)}
	store,err:=OpenFileStore(t.TempDir());if err!=nil{t.Fatal(err)}
	for _,item:=range []struct{a Assignment;b []byte}{{keep,keepData},{corrupt,corruptData}}{
		rec:=ShardRecord{AgreementID:item.a.AgreementID,CommitmentID:item.a.CommitmentID,ShardRoot:item.a.ShardRoot,SizeBytes:item.a.SizeBytes,StoredAt:now}
		if err:=store.Put(context.Background(),rec,bytesReader(item.b));err!=nil{t.Fatal(err)}
	}
	staleRoot:=sha256.Sum256(staleData);staleRec:=ShardRecord{AgreementID:"agreement-stale",CommitmentID:"stale",ShardRoot:hex.EncodeToString(staleRoot[:]),SizeBytes:uint64(len(staleData)),StoredAt:now}
	if err:=store.Put(context.Background(),staleRec,bytesReader(staleData));err!=nil{t.Fatal(err)}
	runtime,err:=NewRuntime(node,1024,store,projection,nil);if err!=nil{t.Fatal(err)}
	if err:=os.WriteFile(store.shardPath(corrupt.CommitmentID),[]byte("xxxxxxxxxxxx"),0o600);err!=nil{t.Fatal(err)}
	rec,err:=NewProviderReconciler(runtime,projection,time.Minute,time.Second,8*time.Second);if err!=nil{t.Fatal(err)}
	res,delay,err:=rec.RunOnce(context.Background(),now);if err!=nil{t.Fatal(err)}
	if delay!=time.Minute{t.Fatalf("delay=%v",delay)}
	if res.StaleRemoved!=1||res.CorruptRemoved!=1||res.MissingShards!=2||res.MissedProofWindows!=1||!res.CapacityCorrected{t.Fatalf("bad result %+v",res)}
	if got:=runtime.Capacity().UsedBytes;got!=uint64(len(keepData)){t.Fatalf("used=%d",got)}
	if _,_,err:=store.Open(context.Background(),"keep");err!=nil{t.Fatalf("kept shard missing: %v",err)}
	if _,_,err:=store.Open(context.Background(),"stale");!errors.Is(err,ErrShardNotFound){t.Fatalf("stale shard retained: %v",err)}
	if _,_,err:=store.Open(context.Background(),"corrupt");!errors.Is(err,ErrShardNotFound){t.Fatalf("corrupt shard retained: %v",err)}
	m:=rec.Metrics();if m.Successes!=1||m.MissingShards!=2||m.MissedProofWindows!=1||m.CapacityCorrections!=1{t.Fatalf("metrics %+v",m)}
}

func TestProviderReconcilerBackoff(t *testing.T){
	now:=time.Unix(2_000_000_000,0).UTC();a:=reconcileAssignment([]byte("x"),"agreement","commitment","node",now)
	reader:=reconcileReader{snaps:map[string]AssignmentSnapshot{a.AgreementID:{Assignment:a,WindowCount:1}},err:errors.New("rpc unavailable")}
	state:=&reconcileStateStore{snapshots:cloneSnapshots(reader.snaps)};p,err:=NewStorageProjection(StorageContracts{Agreement:"agreement-contract"},StorageEventTopics{},reader,state);if err!=nil{t.Fatal(err)}
	store,err:=OpenFileStore(t.TempDir());if err!=nil{t.Fatal(err)};runtime,err:=NewRuntime("node",1024,store,p,nil);if err!=nil{t.Fatal(err)}
	r,err:=NewProviderReconciler(runtime,p,time.Minute,time.Second,4*time.Second);if err!=nil{t.Fatal(err)}
	_,d,err:=r.RunOnce(context.Background(),now);if err==nil||d!=time.Second{t.Fatalf("first err=%v delay=%v",err,d)}
	_,d,err=r.RunOnce(context.Background(),now.Add(time.Second));if err==nil||d!=2*time.Second{t.Fatalf("second err=%v delay=%v",err,d)}
}

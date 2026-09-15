package storage

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"io"
	"sort"
	"strings"
	"sync"
	"time"
)

var ErrProviderReconcile = errors.New("storage provider reconciliation failed")

type ProviderReconcileResult struct {
	CanonicalRefreshed uint64 `json:"canonical_refreshed"`
	StaleRemoved       uint64 `json:"stale_removed"`
	CorruptRemoved     uint64 `json:"corrupt_removed"`
	MissingShards      uint64 `json:"missing_shards"`
	MissedProofWindows uint64 `json:"missed_proof_windows"`
	CapacityCorrected  bool   `json:"capacity_corrected"`
}

type ProviderReconcileMetrics struct {
	Runs                uint64
	Successes           uint64
	Failures            uint64
	CanonicalRefreshed  uint64
	StaleRemoved        uint64
	CorruptRemoved      uint64
	MissingShards       uint64
	MissedProofWindows  uint64
	CapacityCorrections uint64
	ConsecutiveFailures uint32
	LastRunAt           time.Time
	LastSuccessAt       time.Time
	LastError           string
}

type ProviderReconciler struct {
	Runtime    *Runtime
	Projection *StorageProjection
	Interval   time.Duration
	MinBackoff time.Duration
	MaxBackoff time.Duration
	mu         sync.RWMutex
	metrics    ProviderReconcileMetrics
}

func NewProviderReconciler(runtime *Runtime, projection *StorageProjection, interval, minBackoff, maxBackoff time.Duration) (*ProviderReconciler,error) {
	if runtime==nil||projection==nil||projection.Reader==nil||interval<=0||minBackoff<=0||maxBackoff<minBackoff{return nil,ErrProviderReconcile}
	return &ProviderReconciler{Runtime:runtime,Projection:projection,Interval:interval,MinBackoff:minBackoff,MaxBackoff:maxBackoff},nil
}

func (r *ProviderReconciler) Metrics() ProviderReconcileMetrics {
	r.mu.RLock();defer r.mu.RUnlock();return r.metrics
}

// RunOnce reconciles provider-local derived state against canonical chain state.
func (r *ProviderReconciler) RunOnce(ctx context.Context, now time.Time) (ProviderReconcileResult,time.Duration,error) {
	if r==nil||r.Runtime==nil||r.Projection==nil{return ProviderReconcileResult{},0,ErrProviderReconcile}
	now=now.UTC()
	r.mu.Lock();r.metrics.Runs++;r.metrics.LastRunAt=now;r.mu.Unlock()
	res,err:=r.reconcile(ctx,now)
	r.mu.Lock()
	r.metrics.CanonicalRefreshed+=res.CanonicalRefreshed
	r.metrics.StaleRemoved+=res.StaleRemoved
	r.metrics.CorruptRemoved+=res.CorruptRemoved
	r.metrics.MissingShards=res.MissingShards
	r.metrics.MissedProofWindows=res.MissedProofWindows
	if res.CapacityCorrected{r.metrics.CapacityCorrections++}
	if err!=nil{
		r.metrics.Failures++;r.metrics.ConsecutiveFailures++;r.metrics.LastError=err.Error();delay:=r.failureDelayLocked();r.mu.Unlock();return res,delay,err
	}
	r.metrics.Successes++;r.metrics.ConsecutiveFailures=0;r.metrics.LastError="";r.metrics.LastSuccessAt=now;r.mu.Unlock()
	return res,r.Interval,nil
}

func (r *ProviderReconciler) failureDelayLocked() time.Duration {
	d:=r.MinBackoff
	for i:=uint32(1);i<r.metrics.ConsecutiveFailures&&d<r.MaxBackoff;i++{if d>r.MaxBackoff/2{return r.MaxBackoff};d*=2}
	if d>r.MaxBackoff{return r.MaxBackoff};return d
}

func (r *ProviderReconciler) reconcile(ctx context.Context, now time.Time) (ProviderReconcileResult,error) {
	res:=ProviderReconcileResult{}
	snaps:=r.Projection.snapshotList()
	sort.Slice(snaps,func(i,j int)bool{return snaps[i].Assignment.AgreementID<snaps[j].Assignment.AgreementID})
	for _,local:=range snaps{
		if err:=ctx.Err();err!=nil{return res,err}
		canonical,err:=r.Projection.Reader.AssignmentByAgreement(ctx,local.Assignment.AgreementID)
		if err!=nil{
			if errors.Is(err,ErrInactiveAssignment){if err:=r.Projection.deactivate(ctx,local.Assignment.AgreementID);err!=nil{return res,err};res.CanonicalRefreshed++;continue}
			return res,err
		}
		if !equalHex(canonical.Assignment.AgreementID,local.Assignment.AgreementID){return res,ErrProviderReconcile}
		if wr,ok:=r.Projection.Reader.(CanonicalWindowReconciler);ok{
			settlement,next,missed,terminal,err:=wr.ReconcileWindows(ctx,canonical.Assignment.AgreementID,canonical.WindowCount,now)
			if err!=nil{return res,err}
			canonical.SettlementID=settlement;canonical.NextWindow=next;res.MissedProofWindows+=uint64(missed)
			if terminal{canonical.Assignment.Active=false}
		}else{
			canonical.SettlementID=local.SettlementID
			canonical.NextWindow=local.NextWindow
			if canonical.NextWindow>canonical.WindowCount{canonical.NextWindow=canonical.WindowCount}
		}
		if err:=r.Projection.put(ctx,canonical.Assignment.AgreementID,canonical);err!=nil{return res,err}
		res.CanonicalRefreshed++
	}

	active:=map[string]Assignment{}
	for _,snap:=range r.Projection.snapshotList(){
		a:=snap.Assignment
		if a.Active&&equalHex(a.NodeID,r.Runtime.nodeID)&&!now.Before(a.StartTime)&&!now.After(a.EndTime){active[strings.ToLower(a.CommitmentID)]=a}
	}
	records,err:=r.Runtime.store.List(ctx);if err!=nil{return res,err}
	present:=map[string]bool{}
	for _,rec:=range records{
		if err:=ctx.Err();err!=nil{return res,err}
		key:=strings.ToLower(rec.CommitmentID);a,ok:=active[key]
		if !ok||!equalHex(rec.AgreementID,a.AgreementID)||!equalHex(rec.CommitmentID,a.CommitmentID)||!equalHex(rec.ShardRoot,a.ShardRoot)||rec.SizeBytes!=a.SizeBytes{
			if err:=r.Runtime.store.Delete(ctx,rec.CommitmentID);err!=nil&&!errors.Is(err,ErrShardNotFound){return res,err};res.StaleRemoved++;continue
		}
		rc,_,err:=r.Runtime.store.Open(ctx,rec.CommitmentID);if err!=nil{if errors.Is(err,ErrShardNotFound){res.CorruptRemoved++;continue};return res,err}
		h:=sha256.New();n,copyErr:=io.Copy(h,contextReader{ctx:ctx,r:rc});closeErr:=rc.Close()
		if copyErr!=nil{return res,copyErr};if closeErr!=nil{return res,closeErr}
		if uint64(n)!=rec.SizeBytes||hex.EncodeToString(h.Sum(nil))!=strings.TrimPrefix(strings.ToLower(rec.ShardRoot),"0x"){
			if err:=r.Runtime.store.Delete(ctx,rec.CommitmentID);err!=nil&&!errors.Is(err,ErrShardNotFound){return res,err};res.CorruptRemoved++;continue
		}
		present[key]=true
	}
	for id:=range active{if !present[id]{res.MissingShards++}}
	finalRecords,err:=r.Runtime.store.List(ctx);if err!=nil{return res,err}
	changed,err:=r.Runtime.reconcileCapacity(finalRecords);if err!=nil{return res,err};res.CapacityCorrected=changed
	return res,nil
}

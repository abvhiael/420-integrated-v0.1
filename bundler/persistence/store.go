package persistence

import (
	"bufio"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/420integrated/420-integrated/bundler/lifecycle"
	"github.com/420integrated/420-integrated/bundler/mempool"
	"github.com/420integrated/420-integrated/bundler/simulation"
	"github.com/420integrated/420-integrated/bundler/userop"
)

type snapshot struct {
	Version int `json:"version"`
	SavedAt time.Time `json:"savedAt"`
	Mempool []mempool.Entry `json:"mempool"`
	Lifecycle lifecycle.RecoverySnapshot `json:"lifecycle"`
}

type AuditRecord struct {
	Version int `json:"version"`
	Sequence uint64 `json:"sequence"`
	Time time.Time `json:"time"`
	Type string `json:"type"`
	UserOpHash string `json:"userOpHash,omitempty"`
	TransactionHash string `json:"transactionHash,omitempty"`
	Detail string `json:"detail,omitempty"`
}

type Store struct {
	mu sync.Mutex
	dir string
	statePath string
	auditPath string
	pool *mempool.Pool
	lifecycle *lifecycle.Store
	sequence uint64
}

func Open(dir string,pool *mempool.Pool,life *lifecycle.Store,now time.Time)(*Store,error){
	if strings.TrimSpace(dir)==""{return nil,errors.New("persistence directory is required")}
	if pool==nil || life==nil{return nil,errors.New("mempool and lifecycle store are required")}
	if now.IsZero(){return nil,errors.New("open time is required")}
	if err:=os.MkdirAll(dir,0o700);err!=nil{return nil,fmt.Errorf("create persistence directory: %w",err)}
	s:=&Store{dir:dir,statePath:filepath.Join(dir,"state.json"),auditPath:filepath.Join(dir,"audit.jsonl"),pool:pool,lifecycle:life}
	if err:=s.load(now.UTC());err!=nil{return nil,err}
	if err:=s.scanAudit();err!=nil{return nil,err}
	return s,nil
}

func (s *Store) Add(op userop.PackedUserOperation,evidence simulation.Evidence,now time.Time)(mempool.AddResult,error){
	s.mu.Lock();defer s.mu.Unlock()
	result,err:=s.pool.Add(op,evidence,now)
	if err!=nil{return result,err}
	if err:=s.persistLocked(now);err!=nil{return mempool.AddResult{},err}
	kind:="mempool_admitted"
	if result.Duplicate{kind="mempool_duplicate"}
	if result.Replaced{kind="mempool_replaced"}
	if err:=s.auditLocked(now,kind,result.Hash,"","");err!=nil{return mempool.AddResult{},err}
	return result,nil
}

func (s *Store) Snapshot(now time.Time) []mempool.Entry { return s.pool.Snapshot(now) }
func (s *Store) Get(hash string,now time.Time)(mempool.Entry,bool){ return s.pool.Get(hash,now) }

func (s *Store) Remove(hash string) bool {
	s.mu.Lock();defer s.mu.Unlock()
	removed:=s.pool.Remove(hash)
	if !removed{return false}
	now:=time.Now().UTC()
	if err:=s.persistLocked(now);err!=nil{return false}
	if err:=s.auditLocked(now,"mempool_removed",strings.ToLower(hash),"","");err!=nil{return false}
	return true
}

func (s *Store) BeginSubmission(hash,entryPoint string,at time.Time) error {
	s.mu.Lock();defer s.mu.Unlock()
	if err:=s.lifecycle.BeginSubmission(hash,entryPoint,at);err!=nil{return err}
	if err:=s.persistLocked(at);err!=nil{return err}
	return s.auditLocked(at,"submission_started",strings.ToLower(hash),"","")
}

func (s *Store) AbortSubmission(hash string){
	s.mu.Lock();defer s.mu.Unlock()
	s.lifecycle.AbortSubmission(hash)
	now:=time.Now().UTC()
	_ = s.persistLocked(now)
	_ = s.auditLocked(now,"submission_aborted",strings.ToLower(hash),"","")
}

func (s *Store) HasSubmissionOrPending(hash string) bool { return s.lifecycle.HasSubmissionOrPending(hash) }

func (s *Store) RecordSubmission(hash,txHash,entryPoint string,at time.Time) error {
	s.mu.Lock();defer s.mu.Unlock()
	if err:=s.lifecycle.RecordSubmission(hash,txHash,entryPoint,at);err!=nil{return err}
	if err:=s.persistLocked(at);err!=nil{return err}
	return s.auditLocked(at,"submission_recorded",strings.ToLower(hash),strings.ToLower(txHash),"")
}

func (s *Store) LifecycleStore()*lifecycle.Store{return s.lifecycle}

func (s *Store) Flush(now time.Time) error {
	s.mu.Lock();defer s.mu.Unlock()
	return s.persistLocked(now)
}

func (s *Store) load(now time.Time) error {
	raw,err:=os.ReadFile(s.statePath)
	if errors.Is(err,os.ErrNotExist){return nil}
	if err!=nil{return fmt.Errorf("read state: %w",err)}
	if len(raw)>16<<20{return errors.New("persistence state exceeds 16 MiB")}
	var snap snapshot
	if err:=json.Unmarshal(raw,&snap);err!=nil{return errors.New("malformed persistence state")}
	if snap.Version!=1{return errors.New("unsupported persistence state version")}
	if err:=s.pool.Restore(snap.Mempool,now);err!=nil{return fmt.Errorf("restore mempool: %w",err)}
	if err:=s.lifecycle.RestoreRecovery(snap.Lifecycle);err!=nil{return fmt.Errorf("restore lifecycle: %w",err)}
	return nil
}

func (s *Store) persistLocked(now time.Time) error {
	if now.IsZero(){now=time.Now().UTC()}
	snap:=snapshot{Version:1,SavedAt:now.UTC(),Mempool:s.pool.Snapshot(now),Lifecycle:s.lifecycle.SnapshotRecovery()}
	raw,err:=json.Marshal(snap)
	if err!=nil{return err}
	tmp:=s.statePath+".tmp"
	f,err:=os.OpenFile(tmp,os.O_CREATE|os.O_WRONLY|os.O_TRUNC,0o600)
	if err!=nil{return err}
	ok:=false
	defer func(){if !ok{_ = os.Remove(tmp)}}()
	if _,err=f.Write(raw);err!=nil{f.Close();return err}
	if err=f.Sync();err!=nil{f.Close();return err}
	if err=f.Close();err!=nil{return err}
	if err=os.Rename(tmp,s.statePath);err!=nil{return err}
	df,err:=os.Open(s.dir)
	if err==nil{_ = df.Sync();_ = df.Close()}
	ok=true
	return nil
}

func (s *Store) auditLocked(at time.Time,kind,hash,tx,detail string) error {
	s.sequence++
	record:=AuditRecord{Version:1,Sequence:s.sequence,Time:at.UTC(),Type:kind,UserOpHash:hash,TransactionHash:tx,Detail:detail}
	raw,err:=json.Marshal(record)
	if err!=nil{return err}
	f,err:=os.OpenFile(s.auditPath,os.O_CREATE|os.O_WRONLY|os.O_APPEND,0o600)
	if err!=nil{return err}
	defer f.Close()
	if _,err=f.Write(append(raw,'\n'));err!=nil{return err}
	return f.Sync()
}

func (s *Store) scanAudit() error {
	f,err:=os.Open(s.auditPath)
	if errors.Is(err,os.ErrNotExist){return nil}
	if err!=nil{return err}
	defer f.Close()
	sc:=bufio.NewScanner(f)
	buf:=make([]byte,64<<10)
	sc.Buffer(buf,1<<20)
	var last uint64
	for sc.Scan(){
		var rec AuditRecord
		if err:=json.Unmarshal(sc.Bytes(),&rec);err!=nil{return errors.New("malformed audit trail")}
		if rec.Version!=1 || rec.Sequence!=last+1 || rec.Time.IsZero() || rec.Type==""{return errors.New("invalid audit trail sequence")}
		last=rec.Sequence
	}
	if err:=sc.Err();err!=nil{return err}
	s.sequence=last
	return nil
}

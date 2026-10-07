package reeferreview

import (
 "context"
 "errors"
 "sort"
 "sync"
)

type Memory struct {
 mu sync.RWMutex
 pubs map[string]Publication
 blobs map[string][]byte
 idem map[string]idemRecord
}
type idemRecord struct{ ID, Fingerprint string }

func NewMemory()*Memory{return &Memory{pubs:map[string]Publication{},blobs:map[string][]byte{},idem:map[string]idemRecord{}}}
func(m *Memory) Put(ctx context.Context,p Publication)error{m.mu.Lock();defer m.mu.Unlock();m.pubs[p.ID]=p;return nil}
func(m *Memory) Get(ctx context.Context,id string)(Publication,error){m.mu.RLock();defer m.mu.RUnlock();p,ok:=m.pubs[id];if !ok{return Publication{},ErrNotFound};return p,nil}
func(m *Memory) List(ctx context.Context,off,lim int)([]Publication,int,error){m.mu.RLock();defer m.mu.RUnlock();return nil,0,nil}
func(m *Memory) BindIdempotency(ctx context.Context,actor,key,fp string)(string,error){
 m.mu.Lock();defer m.mu.Unlock(); k:=actor+"\x00"+key
 if r,ok:=m.idem[k];ok{if r.Fingerprint!=fp{return "",ErrConflict};return r.ID,nil}
 id:=stableID(actor,key);m.idem[k]=idemRecord{ID:id,Fingerprint:fp};return id,nil
}
func(m *Memory) PutBlob(ctx context.Context,key string,b []byte)(string,error){m.mu.Lock();defer m.mu.Unlock();ref:="blob:"+key;m.blobs[ref]=append([]byte(nil),b...);return ref,nil}
func(m *Memory) GetBlob(ctx context.Context,ref string)([]byte,error){m.mu.RLock();defer m.mu.RUnlock();b,ok:=m.blobs[ref];if !ok{return nil,ErrNotFound};return append([]byte(nil),b...),nil}

type MemoryBlob struct{ M *Memory }
func(b MemoryBlob) Put(ctx context.Context,key string,v []byte)(string,error){return b.M.PutBlob(ctx,key,v)}
func(b MemoryBlob) Get(ctx context.Context,ref string)([]byte,error){return b.M.GetBlob(ctx,ref)}

func(m *Memory) ListPublic(offset,limit int)([]Publication,int,error){
 m.mu.RLock();defer m.mu.RUnlock()
 all:=make([]Publication,0,len(m.pubs))
 for _,p:=range m.pubs{if p.Status==StatusPublished&&p.Visibility==VisibilityPublic{all=append(all,p)}}
 sort.Slice(all,func(i,j int)bool{return all[i].CreatedAt.After(all[j].CreatedAt)})
 total:=len(all); if offset<0||offset>total{return nil,total,ErrInvalidInput}; end:=offset+limit;if end>total{end=total}
 return append([]Publication(nil),all[offset:end]...),total,nil
}
func(m *Memory) List(ctx context.Context,offset,limit int)([]Publication,int,error){return m.ListPublic(offset,limit)}

type AllowIdentity struct{}
func(AllowIdentity) Active(context.Context,string)(bool,error){return true,nil}
type DevAuthorizer struct{}
func(DevAuthorizer) CanPublish(ctx context.Context,a string,p Publication)(bool,error){return a!=""&&(a==p.Author||a=="publisher.420"),nil}
func(DevAuthorizer) CanModerate(ctx context.Context,a string,p Publication)(bool,error){return a=="moderator.420"||a=="publisher.420",nil}
type DevRights struct{}
func(DevRights) Assert(ctx context.Context,a,d string)(string,error){if a==""||d==""{return "",errors.New("missing rights input")};return "dev-rights:"+d,nil}
type NoopSearch struct{}
func(NoopSearch) Upsert(context.Context,Publication)error{return nil}
func(NoopSearch) Delete(context.Context,string)error{return nil}
type NoopNotifications struct{}
func(NoopNotifications) Published(context.Context,Publication)error{return nil}
type NoopMail struct{}
func(NoopMail) Published(context.Context,Publication)error{return nil}

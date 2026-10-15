package complianceauth

import (
 "context"
 "errors"
 "sync"
 "time"
)

var ErrPublicationStale = errors.New("compliance publication stale or unavailable")

// PublicationFence is the canonical state of one scoped policy publication.
type PublicationFence struct {
 Scope string
 Sequence uint64
 RevocationEpoch uint64
 PolicyDigest string
 DependencyDigest string
 ExpiresAt time.Time
}

// PublicationStore must provide a linearizable atomic compare-and-swap and
// strongly consistent reads to ALL serving instances. No eventual-consistency
// fallback is safe for authorization.
type PublicationStore interface {
 Load(context.Context,string)(PublicationFence,error)
 CompareAndSwap(context.Context,string,PublicationFence,PublicationFence)(bool,error)
}

func ValidPublicationFence(p PublicationFence,now time.Time)bool {
 return p.Scope!=""&&p.Sequence>0&&p.RevocationEpoch>0&&digestValid(p.PolicyDigest)&&digestValid(p.DependencyDigest)&&!p.ExpiresAt.IsZero()&&now.Before(p.ExpiresAt)
}

// AdvancePublication rejects rollback, equal-sequence mutations, epoch rollback,
// and unavailable storage. Any policy/dependency change requires a new sequence.
func AdvancePublication(ctx context.Context,store PublicationStore,old,next PublicationFence,now time.Time)error{
 if ctx==nil||ctx.Err()!=nil||store==nil||!ValidPublicationFence(old,now)||!ValidPublicationFence(next,now)||
 old.Scope!=next.Scope||next.Sequence<=old.Sequence||next.RevocationEpoch<old.RevocationEpoch {return ErrPublicationStale}
 current,err:=store.Load(ctx,next.Scope)
 if err!=nil||current!=old{return ErrPublicationStale}
 ok,err:=store.CompareAndSwap(ctx,next.Scope,old,next)
 if err!=nil||!ok{return ErrPublicationStale}
 return nil
}

// PublicationCache is deliberately a hint, never authorization authority.
// Each use rechecks the shared current fence and never serves on store failure.
type PublicationCache struct {
 mu sync.Mutex
 entry map[string]PublicationFence
}
func(c *PublicationCache) ReadCurrent(ctx context.Context,store PublicationStore,expected PublicationFence,now time.Time)(PublicationFence,error){
 if c==nil||store==nil||ctx==nil||ctx.Err()!=nil||!ValidPublicationFence(expected,now){return PublicationFence{},ErrPublicationStale}
 authoritative,err:=store.Load(ctx,expected.Scope)
 if err!=nil||!ValidPublicationFence(authoritative,now)||authoritative!=expected{return PublicationFence{},ErrPublicationStale}
 c.mu.Lock();defer c.mu.Unlock()
 if c.entry==nil{c.entry=map[string]PublicationFence{}}
 c.entry[expected.Scope]=authoritative
 return authoritative,nil
}
func(c *PublicationCache) Invalidate(scope string){
 if c==nil{return}
 c.mu.Lock();defer c.mu.Unlock();delete(c.entry,scope)
}
// MemoryPublicationStore is a test fixture only; it is NOT multi-instance durable.
type MemoryPublicationStore struct{
 mu sync.Mutex
 entries map[string]PublicationFence
}
func(s *MemoryPublicationStore) Load(ctx context.Context,scope string)(PublicationFence,error){
 if s==nil||ctx==nil||ctx.Err()!=nil{return PublicationFence{},ErrPublicationStale}
 s.mu.Lock();defer s.mu.Unlock()
 p,ok:=s.entries[scope];if !ok{return PublicationFence{},ErrPublicationStale}
 return p,nil
}
func(s *MemoryPublicationStore) CompareAndSwap(ctx context.Context,scope string,old,next PublicationFence)(bool,error){
 if s==nil||ctx==nil||ctx.Err()!=nil{return false,ErrPublicationStale}
 s.mu.Lock();defer s.mu.Unlock()
 if s.entries[scope]!=old{return false,nil}
 s.entries[scope]=next;return true,nil
}

package social

import (
 "crypto/sha256"
 "encoding/binary"
 "encoding/hex"
 "encoding/json"
)

// RuleRandom is replayable and domain separated. A caller persists Counter
// in its versioned rule state. No wall clock, global math/rand or network
// input is permitted inside a deterministic ruleset.
type RuleRandom struct{
 Seed [32]byte
 Domain string
 Counter uint64
}
func (r *RuleRandom)Uint64()(uint64,error){
 if r==nil||len(r.Domain)<1||len(r.Domain)>64||r.Counter==^uint64(0){return 0,ErrInvalid}
 var counter [8]byte
 binary.BigEndian.PutUint64(counter[:],r.Counter)
 b:=make([]byte,0,32+len(r.Domain)+8+19)
 b=append(b,[]byte("420-classic-rule-v1")...)
 b=append(b,r.Seed[:]...)
 b=append(b,byte(len(r.Domain)))
 b=append(b,[]byte(r.Domain)...)
 b=append(b,counter[:]...)
 digest:=sha256.Sum256(b);r.Counter++
 return binary.BigEndian.Uint64(digest[:8]),nil
}
func (r *RuleRandom)Intn(n uint64)(uint64,error){
 if n<1||n>1_000_000{return 0,ErrInvalid}
 // Reject the high incomplete range to avoid modular bias.
 threshold:=uint64(0)-n
 threshold%=n
 for i:=0;i<128;i++{
  x,e:=r.Uint64();if e!=nil{return 0,e}
  if x>=threshold{return x%n,nil}
 }
 return 0,ErrUnavailable
}
func CanonicalRuleSeed(state json.RawMessage)([32]byte,error){
 var out [32]byte
 var frame RuleFrame
 if !strictRuleJSON(state,&frame){return out,ErrInvalid}
 data,e:=hex.DecodeString(frame.Seed)
 if e!=nil||len(data)!=32{return out,ErrInvalid}
 copy(out[:],data)
 return out,nil
}

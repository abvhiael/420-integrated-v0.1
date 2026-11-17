package engine

import (
 "context"
 "encoding/hex"
 "fmt"
 "strconv"

 csys "github.com/420integrated/420-integrated/consensus/systemcall"
)

// CanonicalSequenceAnchor verifies a consensus-selected execution checkpoint against
// the paired, authenticated execution client's canonical block and gateway state.
// The expected hash MUST originate from independently verified consensus history,
// not an untrusted RPC response. EIP-1898 pins the read to that canonical hash.
func (c *Client) CanonicalSequenceAnchor(ctx context.Context, chain, number uint64, expected [32]byte) (csys.SequenceAnchor,error) {
 var zero csys.SequenceAnchor
 if chain==0 || expected==([32]byte{}) {return zero,csys.ErrInvalidSequenceAnchor}
 var chainHex string
 if err:=c.Call(ctx,"eth_chainId",[]any{},&chainHex);err!=nil{return zero,err}
 if chainHex!=hexQuantity(chain){return zero,fmt.Errorf("execution chain mismatch")}
 hash:=Hash32("0x"+hex.EncodeToString(expected[:]))
 type block struct {Hash Hash32; Number string}
 verify:=func()error{
  var b *block
  if err:=c.Call(ctx,"eth_getBlockByNumber",[]any{hexQuantity(number),false},&b);err!=nil{return err}
  if b==nil||b.Hash!=hash||b.Number!=hexQuantity(number){return fmt.Errorf("execution canonical checkpoint mismatch")}
  return nil
 }
 if err:=verify();err!=nil{return zero,err}
 // lastSequence() selector is derived from the frozen gateway ABI.
 var result string
 if err:=c.Call(ctx,"eth_call",[]any{map[string]string{"to":"0x000000000000000000000000000000000000043c","data":gatewaySequenceSelector},map[string]any{"blockHash":hash,"requireCanonical":true}},&result);err!=nil{return zero,err}
 if len(result)!=66||result[:2]!="0x"{return zero,fmt.Errorf("malformed gateway sequence")}
 b,err:=hex.DecodeString(result[2:]);if err!=nil{return zero,err}
 for _,v:=range b[:24]{if v!=0{return zero,fmt.Errorf("gateway sequence overflow")}}
 last,err:=strconv.ParseUint(result[50:],16,64);if err!=nil{return zero,err}
 if err:=verify();err!=nil{return zero,err}
 return csys.SequenceAnchor{ChainID:chain,ExecutionBlock:number,BlockHash:expected,LastSequence:last},nil
}

// RecoverVerifiedSequence is the explicit recovery path, including replacement
// parents. The caller must enforce consensus finality and ancestry before calling.
func(c *Client) RecoverVerifiedSequence(ctx context.Context,m csys.SequenceManager,chain,number uint64,hash [32]byte)(csys.SequenceAnchor,error){
 a,err:=c.CanonicalSequenceAnchor(ctx,chain,number,hash);if err!=nil{return a,err}
 if err=m.RecoverCanonicalParent(a);err!=nil{return csys.SequenceAnchor{},err}
 return a,nil
}

// CommitVerifiedSequence persists only after the independently consensus-selected
// child is canonical in execution, its gateway sequence matches the committed
// batch, and execution has returned VALID for that exact child.
func(c *Client) CommitVerifiedSequence(ctx context.Context,m csys.SequenceManager,parent csys.SequenceAnchor,child [32]byte,batch csys.Batch,status PayloadStatusV1)(csys.SequenceAnchor,error){
 var zero csys.SequenceAnchor
 hash:=Hash32("0x"+hex.EncodeToString(child[:]))
 if err:=requireValidExecution(status,hash);err!=nil{return zero,err}
 if _,err:=m.RequireCanonicalParent(parent);err!=nil{return zero,err}
 if parent.ExecutionBlock==^uint64(0)||batch.ExecutionBlock!=parent.ExecutionBlock+1||batch.ParentHash!=parent.BlockHash||batch.ChainID!=parent.ChainID||child==parent.BlockHash{return zero,csys.ErrSequenceCommitContextMismatch}
 if err:=batch.Validate(parent.LastSequence);err!=nil{return zero,err}
 // Recheck the canonical parent and child independently of the local journal.
 p,err:=c.CanonicalSequenceAnchor(ctx,parent.ChainID,parent.ExecutionBlock,parent.BlockHash);if err!=nil{return zero,err}
 if p!=parent{return zero,fmt.Errorf("execution parent sequence divergence")}
 a,err:=c.CanonicalSequenceAnchor(ctx,parent.ChainID,batch.ExecutionBlock,child);if err!=nil{return zero,err}
 last:=parent.LastSequence
 if len(batch.Calls)>0{last=batch.Calls[len(batch.Calls)-1].Sequence}
 if a.LastSequence!=last{return zero,fmt.Errorf("execution child sequence divergence")}
 return m.CommitCanonicalChild(parent,child,batch)
}

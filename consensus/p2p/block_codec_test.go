package p2p

import (
	"testing"

	csys "github.com/420integrated/420-integrated/consensus/systemcall"
	ctypes "github.com/420integrated/420-integrated/consensus/types"
)

func TestConsensusBlockCodecPreservesSystemCalls(t *testing.T) {
	var parent [32]byte
	parent[0] = 1
	var target [20]byte
	target[18],target[19]=0x04,0x23
	call:=csys.Call{Sequence:1,ExecutionBlock:2,ParentHash:parent,ChainID:420,Action:"420/SYSCALL/ROTATION_SNAPSHOT/V1",Target:target,Payload:[]byte{1,2,3,4}}
	batch:=csys.Batch{ExecutionBlock:2,ParentHash:parent,ChainID:420,Calls:[]csys.Call{call}}
	root:=batch.Root()
	in:=ctypes.ConsensusBlockEnvelope{Header:ctypes.ConsensusBlock{Slot:2,SystemCallBatchRoot:ctypes.Root(root)},Body:ctypes.ConsensusBlockBody{SystemCalls:[]csys.Call{call}}}
	raw,err:=EncodeConsensusBlock(in); if err!=nil { t.Fatal(err) }
	out,err:=DecodeConsensusBlock(raw); if err!=nil { t.Fatal(err) }
	if err:=out.ValidateSystemCallCommitment(420,2,parent,0); err!=nil { t.Fatal(err) }
	if len(out.Body.SystemCalls)!=1 || out.Body.SystemCalls[0].Action!=call.Action { t.Fatalf("calls=%+v",out.Body.SystemCalls) }
}

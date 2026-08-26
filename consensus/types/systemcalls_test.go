package types

import (
	"testing"

	csys "github.com/420integrated/420-integrated/consensus/systemcall"
)

func TestConsensusBlockCommitsSystemCallBatchRoot(t *testing.T) {
	var parent [32]byte
	parent[0] = 0x42
	var target [20]byte
	target[18], target[19] = 0x04, 0x23
	calls := []csys.Call{{
		Sequence:1, ExecutionBlock:10, ParentHash:parent, ChainID:420,
		Action:"420/SYSCALL/ROTATION_SNAPSHOT/V1", Target:target, Payload:[]byte{1,2,3,4},
	}}
	batch := csys.Batch{ExecutionBlock:10,ParentHash:parent,ChainID:420,Calls:calls}
	root := batch.Root()
	env := ConsensusBlockEnvelope{
		Header: ConsensusBlock{Slot:10,SystemCallBatchRoot:Root(root)},
		Body: ConsensusBlockBody{SystemCalls:calls},
	}
	if err:=env.ValidateSystemCallCommitment(420,10,parent,0); err!=nil { t.Fatal(err) }

	before := env.Header.HashTreeRoot()
	env.Header.SystemCallBatchRoot[0] ^= 1
	after := env.Header.HashTreeRoot()
	if before == after { t.Fatal("system-call root not committed by consensus block hash") }
	if err:=env.ValidateSystemCallCommitment(420,10,parent,0); err != ErrSystemCallBatchRoot { t.Fatalf("tampered root err=%v",err) }
}

func TestConsensusBlockRejectsTamperedSystemCallBody(t *testing.T) {
	var parent [32]byte
	parent[0] = 1
	var target [20]byte
	target[19] = 0x23
	call := csys.Call{Sequence:1,ExecutionBlock:2,ParentHash:parent,ChainID:420,Action:"420/SYSCALL/VALIDATOR_STATE/V1",Target:target,Payload:[]byte{1,2,3,4}}
	batch:=csys.Batch{ExecutionBlock:2,ParentHash:parent,ChainID:420,Calls:[]csys.Call{call}}
	root:=batch.Root()
	env:=ConsensusBlockEnvelope{Header:ConsensusBlock{SystemCallBatchRoot:Root(root)},Body:ConsensusBlockBody{SystemCalls:[]csys.Call{call}}}
	env.Body.SystemCalls[0].Payload[0] ^= 0xff
	if err:=env.ValidateSystemCallCommitment(420,2,parent,0); err != ErrSystemCallBatchRoot { t.Fatalf("tampered body err=%v",err) }
}

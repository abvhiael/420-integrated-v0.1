package engine

import (
	"encoding/hex"
	"testing"

	csys "github.com/420integrated/420-integrated/consensus/systemcall"
)

func testSystemBatch() csys.Batch {
	var parent [32]byte
	parent[0] = 0x42
	var target [20]byte
	target[18], target[19] = 0x04, 0x23
	return csys.Batch{
		ExecutionBlock: 11,
		ParentHash: parent,
		ChainID: 420,
		Calls: []csys.Call{{
			Sequence: 1, ExecutionBlock: 11, ParentHash: parent, ChainID: 420,
			Action: "420/SYSCALL/ROTATION_SNAPSHOT/V1", Target: target, Payload: []byte{1,2,3,4},
		}},
	}
}

func TestEncodeSystemCallBatchPreservesCommitment(t *testing.T) {
	b := testSystemBatch()
	wire := EncodeSystemCallBatch(b)
	root := b.Root()
	if wire.BatchRoot != Hash32("0x"+hex.EncodeToString(root[:])) { t.Fatal("root mismatch") }
	if wire.ExecutionBlock != "0xb" || wire.ChainID != "0x1a4" { t.Fatalf("quantities=%+v", wire) }
	if len(wire.Calls)!=1 || wire.Calls[0].Sequence!="0x1" || wire.Calls[0].Target!="0x0000000000000000000000000000000000000423" { t.Fatalf("call=%+v",wire.Calls) }
}

func TestVerifyPayloadSystemCallRoot(t *testing.T) {
	b := testSystemBatch()
	root := b.Root()
	parent := Hash32("0x"+hex.EncodeToString(b.ParentHash[:]))
	p := ExecutionPayloadV3{ParentHash:parent,ExtraData:"0x"+hex.EncodeToString(root[:])}
	if err:=VerifyPayloadSystemCallRoot(p,b); err!=nil { t.Fatal(err) }
	p.ExtraData="0x00"
	if err:=VerifyPayloadSystemCallRoot(p,b); err==nil { t.Fatal("bad root accepted") }
}

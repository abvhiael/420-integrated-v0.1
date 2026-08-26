package systemcall

import "testing"

func TestBatchRootDeterministicAndOrderSensitive(t *testing.T) {
	var parent [32]byte
	parent[0] = 0x42
	var target [20]byte
	target[18], target[19] = 0x04, 0x23
	one := Call{Sequence:1,ExecutionBlock:10,ParentHash:parent,ChainID:420,Action:"420/SYSCALL/VALIDATOR_STATE/V1",Target:target,Payload:[]byte{1,2,3,4}}
	two := Call{Sequence:2,ExecutionBlock:10,ParentHash:parent,ChainID:420,Action:"420/SYSCALL/ROTATION_SNAPSHOT/V1",Target:target,Payload:[]byte{5,6,7,8}}
	b := Batch{ExecutionBlock:10,ParentHash:parent,ChainID:420,Calls:[]Call{one,two}}
	if err := b.Validate(0); err != nil { t.Fatal(err) }
	r1 := b.Root()
	r2 := b.Root()
	if r1 != r2 { t.Fatal("root not deterministic") }
	b.Calls = []Call{two,one}
	if b.Root() == r1 { t.Fatal("root not order sensitive") }
}

func TestBatchRejectsGapAndContextMismatch(t *testing.T) {
	var parent [32]byte
	parent[0] = 1
	var target [20]byte
	c := Call{Sequence:2,ExecutionBlock:5,ParentHash:parent,ChainID:420,Action:"x",Target:target,Payload:[]byte{1}}
	b := Batch{ExecutionBlock:5,ParentHash:parent,ChainID:420,Calls:[]Call{c}}
	if b.Validate(0) != ErrSequence { t.Fatal("gap accepted") }
	c.Sequence = 1
	c.ExecutionBlock = 6
	b.Calls[0] = c
	if b.Validate(0) != ErrCallContext { t.Fatal("context mismatch accepted") }
}

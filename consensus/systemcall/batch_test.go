package systemcall

import "testing"

func validTestCall(sequence uint64) Call {
	var parent [32]byte
	parent[0] = 0x42
	var target [20]byte
	target[18], target[19] = 0x04, 0x23
	return Call{
		Sequence: sequence, ExecutionBlock: 10, ParentHash: parent, ChainID: 420,
		Action: "420/SYSCALL/VALIDATOR_STATE/V1", Target: target, Payload: []byte{1, 2, 3, 4},
	}
}

func TestBatchRootDeterministicAndOrderSensitive(t *testing.T) {
	one := validTestCall(1)
	two := validTestCall(2)
	two.Action = "420/SYSCALL/ROTATION_SNAPSHOT/V1"
	two.Payload = []byte{5, 6, 7, 8}
	b := Batch{ExecutionBlock: 10, ParentHash: one.ParentHash, ChainID: 420, Calls: []Call{one, two}}
	if err := b.Validate(0); err != nil { t.Fatal(err) }
	r1 := b.Root()
	r2 := b.Root()
	if r1 != r2 { t.Fatal("root not deterministic") }
	b.Calls = []Call{two, one}
	if b.Root() == r1 { t.Fatal("root not order sensitive") }
}

func TestBatchRejectsGapAndContextMismatch(t *testing.T) {
	c := validTestCall(2)
	b := Batch{ExecutionBlock: 10, ParentHash: c.ParentHash, ChainID: 420, Calls: []Call{c}}
	if b.Validate(0) != ErrSequence { t.Fatal("gap accepted") }
	c.Sequence = 1
	c.ExecutionBlock = 11
	b.Calls[0] = c
	if b.Validate(0) != ErrCallContext { t.Fatal("context mismatch accepted") }
}

func TestBatchRejectsTooManyCalls(t *testing.T) {
	first := validTestCall(1)
	b := Batch{ExecutionBlock: 10, ParentHash: first.ParentHash, ChainID: 420}
	for i := uint64(1); i <= MaxCallsPerBatch+1; i++ {
		b.Calls = append(b.Calls, validTestCall(i))
	}
	if b.Validate(0) != ErrBatchTooLarge { t.Fatal("oversized call count accepted") }
}

func TestBatchRejectsPayloadBudgetOverflow(t *testing.T) {
	c := validTestCall(1)
	c.Payload = make([]byte, MaxPayloadBytes+1)
	b := Batch{ExecutionBlock: 10, ParentHash: c.ParentHash, ChainID: 420, Calls: []Call{c}}
	if b.Validate(0) != ErrBatchTooLarge { t.Fatal("oversized payload accepted") }
}

func TestBatchRejectsInvalidActionAndShortPayload(t *testing.T) {
	c := validTestCall(1)
	c.Action = ""
	b := Batch{ExecutionBlock: 10, ParentHash: c.ParentHash, ChainID: 420, Calls: []Call{c}}
	if b.Validate(0) != ErrBatchTooLarge { t.Fatal("empty action accepted") }
	c = validTestCall(1)
	c.Payload = []byte{1, 2, 3}
	b.Calls[0] = c
	if b.Validate(0) != ErrBatchTooLarge { t.Fatal("short ABI payload accepted") }
}

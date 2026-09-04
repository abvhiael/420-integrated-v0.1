package systemcall

import "testing"

func TestValidateEnvelope(t *testing.T) {
	var parent [32]byte
	parent[31] = 1
	ctx := Context{LastSequence: 9, BlockNumber: 420, ParentHash: parent, ChainID: 420420}
	e := Envelope{
		Sequence:       10,
		ExecutionBlock: 420,
		ParentHash:     parent,
		ChainID:        420420,
		Action:         ActionValidatorState,
		Target:         ValidatorRegistry,
		Payload:        []byte{1, 2, 3, 4},
	}
	if err := e.Validate(ctx); err != nil {
		t.Fatalf("valid envelope rejected: %v", err)
	}
}

func TestValidateRejectsReplayWrongAncestryAndRoute(t *testing.T) {
	var parent [32]byte
	parent[0] = 0x42
	ctx := Context{LastSequence: 1, BlockNumber: 2, ParentHash: parent, ChainID: 420}
	base := Envelope{Sequence: 2, ExecutionBlock: 2, ParentHash: parent, ChainID: 420, Action: ActionReward, Target: RewardController, Payload: []byte{1, 2, 3, 4}}

	replay := base
	replay.Sequence = 1
	if replay.Validate(ctx) != ErrSequence {
		t.Fatal("replay not rejected")
	}

	wrongParent := base
	wrongParent.ParentHash[1] = 1
	if wrongParent.Validate(ctx) != ErrParentHash {
		t.Fatal("wrong parent not rejected")
	}

	wrongTarget := base
	wrongTarget.Target = ValidatorRegistry
	if wrongTarget.Validate(ctx) != ErrTarget {
		t.Fatal("wrong target not rejected")
	}

	unknown := base
	unknown.Action = "420/SYSCALL/UNKNOWN/V1"
	if unknown.Validate(ctx) != ErrAction {
		t.Fatal("unknown action not rejected")
	}
}

func TestSolidityCallHashPreimageLayout(t *testing.T) {
	var parent, domain, action, payload [32]byte
	parent[0] = 0xaa
	domain[0] = 0x11
	action[0] = 0x22
	payload[0] = 0x33
	e := Envelope{Sequence: 7, ExecutionBlock: 8, ParentHash: parent, ChainID: 9, Target: ValidatorRegistry}
	preimage, err := e.SolidityCallHashPreimage(domain, action, payload)
	if err != nil {
		t.Fatal(err)
	}
	if len(preimage) != 256 {
		t.Fatalf("preimage length = %d", len(preimage))
	}
	if preimage[0] != 0x11 || preimage[128] != 0xaa || preimage[160] != 0x22 || preimage[224] != 0x33 {
		t.Fatal("static ABI slots not encoded as expected")
	}
	if preimage[63] != 9 || preimage[95] != 7 || preimage[127] != 8 {
		t.Fatal("uint ABI slots not encoded as expected")
	}
	if preimage[222] != 0x04 || preimage[223] != 0x23 {
		t.Fatal("target address not right-aligned in ABI slot")
	}
}

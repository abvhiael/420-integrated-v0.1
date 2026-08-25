package ssz

import "testing"

func TestMerkleizeDeterministic(t *testing.T) {
	a := Uint64Root(420)
	b := Uint64Root(17640)
	if Merkleize([]Root{a, b}) != Merkleize([]Root{a, b}) {
		t.Fatal("non-deterministic root")
	}
	if Merkleize([]Root{a, b}) == Merkleize([]Root{b, a}) {
		t.Fatal("field order must affect root")
	}
}

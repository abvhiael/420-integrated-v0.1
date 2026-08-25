package attestation

import (
	ctypes "github.com/420integrated/420-integrated/consensus/types"
	"testing"
)

type agg struct{}

func (agg) Aggregate(s []ctypes.BLSSignature) (ctypes.BLSSignature, error) {
	var out ctypes.BLSSignature
	out[0] = byte(len(s))
	return out, nil
}

func TestCollectorThreshold(t *testing.T) {
	var block, parent ctypes.Root
	block[0] = 1
	parent[0] = 2
	data := ctypes.AttestationData{Slot: 9, BlockRoot: block, ParentRoot: parent}
	c := NewCollector(15, data)
	for i := 0; i < 10; i++ {
		if err := c.Add(ctypes.Attestation{Seat: uint16(i), Data: data}); err != nil {
			t.Fatal(err)
		}
	}
	if c.HasQuorum() {
		t.Fatal("10/15 must not have quorum")
	}
	if _, err := c.AssembleQC(1, ctypes.Root{}, agg{}); err == nil {
		t.Fatal("expected insufficient quorum")
	}
	if err := c.Add(ctypes.Attestation{Seat: 10, Data: data}); err != nil {
		t.Fatal(err)
	}
	if !c.HasQuorum() {
		t.Fatal("11/15 must have quorum")
	}
	qc, err := c.AssembleQC(1, ctypes.Root{}, agg{})
	if err != nil {
		t.Fatal(err)
	}
	if qc.AggregateSignature[0] != 11 {
		t.Fatalf("aggregate count=%d", qc.AggregateSignature[0])
	}
}

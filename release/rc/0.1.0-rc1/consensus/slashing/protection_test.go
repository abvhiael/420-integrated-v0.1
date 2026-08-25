package slashing

import (
	"errors"
	ctypes "github.com/420integrated/420-integrated/consensus/types"
	"testing"
)

func TestDoubleAttestationRejected(t *testing.T) {
	p := NewProtector()
	var a, b ctypes.Root
	a[31] = 1
	b[31] = 2
	if err := p.CheckAndRecordAttestation(42, 100, a); err != nil {
		t.Fatal(err)
	}
	if err := p.CheckAndRecordAttestation(42, 100, a); err != nil {
		t.Fatal(err)
	}
	if err := p.CheckAndRecordAttestation(42, 100, b); !errors.Is(err, ErrDoubleAttestation) {
		t.Fatalf("err=%v", err)
	}
}

func TestDoubleRecoveryRejected(t *testing.T) {
	p := NewProtector()
	var incident, a, b ctypes.Root
	incident[0] = 4
	a[0] = 1
	b[0] = 2
	if err := p.CheckAndRecordRecovery(7, incident, a); err != nil {
		t.Fatal(err)
	}
	if err := p.CheckAndRecordRecovery(7, incident, b); !errors.Is(err, ErrDoubleRecovery) {
		t.Fatalf("err=%v", err)
	}
}

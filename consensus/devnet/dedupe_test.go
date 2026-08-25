package devnet

import "testing"

func TestDedupe(t *testing.T) {
	d := NewDedupe()
	if !d.First("qc:1:a") {
		t.Fatal("first must pass")
	}
	if d.First("qc:1:a") {
		t.Fatal("duplicate must fail")
	}
	if !d.First("qc:1:b") {
		t.Fatal("different root must pass")
	}
}

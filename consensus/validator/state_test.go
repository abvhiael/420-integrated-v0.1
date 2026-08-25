package validator

import "testing"

func TestSeatTermInvariant(t *testing.T) {
	_, err := NewCommittee(0, []Seat{{ID: 0, OccupantID: 1, ActivatedAt: 7, ExitAt: 10}})
	if err != nil {
		t.Fatal(err)
	}
	_, err = NewCommittee(0, []Seat{{ID: 0, OccupantID: 1, ActivatedAt: 7, ExitAt: 11}})
	if err == nil {
		t.Fatal("expected seat term invariant failure")
	}
}

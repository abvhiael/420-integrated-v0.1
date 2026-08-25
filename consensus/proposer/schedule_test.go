package proposer

import (
	ctypes "github.com/420integrated/420-integrated/consensus/types"
	"testing"
)

func TestScheduleDeterministicAndDistinct(t *testing.T) {
	seats := make([]uint16, 15)
	for i := range seats {
		seats[i] = uint16(i)
	}
	var seed [32]byte
	copy(seed[:], []byte("420-schedule-test"))
	a, err := GenerateRotationSchedule(seats, seed, 0)
	if err != nil {
		t.Fatal(err)
	}
	b, err := GenerateRotationSchedule(seats, seed, 0)
	if err != nil {
		t.Fatal(err)
	}
	if len(a) != int(ctypes.SlotsPerRotation) {
		t.Fatalf("len=%d", len(a))
	}
	for i := range a {
		if a[i] != b[i] {
			t.Fatalf("schedule differs at %d", i)
		}
		if a[i].Primary == a[i].Fallback1 || a[i].Primary == a[i].Fallback2 || a[i].Fallback1 == a[i].Fallback2 {
			t.Fatalf("collision at slot %d: %+v", i, a[i])
		}
	}
}

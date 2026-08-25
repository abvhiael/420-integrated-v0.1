package committee15

import "testing"

func TestPrimaryPath(t *testing.T) {
	r, err := RunOneSlot(true, true)
	if err != nil {
		t.Fatal(err)
	}
	if r.UsedRank != 0 {
		t.Fatalf("rank=%d", r.UsedRank)
	}
	if r.Attestations != 11 || r.QCThreshold != 11 {
		t.Fatalf("%+v", r)
	}
	if r.FinalizedSlot != 1 {
		t.Fatalf("finalized=%d", r.FinalizedSlot)
	}
}

func TestFallback1Path(t *testing.T) {
	r, err := RunOneSlot(false, true)
	if err != nil {
		t.Fatal(err)
	}
	if r.UsedRank != 1 {
		t.Fatalf("rank=%d", r.UsedRank)
	}
	if r.UsedSeat == r.ScheduledPrimary {
		t.Fatal("fallback must differ from primary")
	}
}

func TestFallback2Path(t *testing.T) {
	r, err := RunOneSlot(false, false)
	if err != nil {
		t.Fatal(err)
	}
	if r.UsedRank != 2 {
		t.Fatalf("rank=%d", r.UsedRank)
	}
}

package clock

import (
	"testing"
	"time"

	protocol "github.com/420integrated/420-integrated/consensus/types"
)

func TestProtocolDimensions(t *testing.T) {
	if protocol.SlotsPerRotation != 17640 {
		t.Fatalf("SlotsPerRotation=%d, want 17640", protocol.SlotsPerRotation)
	}
}

func TestClock(t *testing.T) {
	genesis := time.Unix(1_800_000_000, 0).UTC()
	c := Clock{Genesis: genesis}

	slot, err := c.SlotAt(genesis.Add(420 * 12 * time.Second))
	if err != nil {
		t.Fatal(err)
	}
	if slot != 420 {
		t.Fatalf("slot=%d want 420", slot)
	}
	if Epoch(slot) != 1 {
		t.Fatalf("epoch=%d want 1", Epoch(slot))
	}
}

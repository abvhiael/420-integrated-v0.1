package core

import (
	"testing"

	"github.com/420integrated/420-integrated/indexer/model"
)

func TestFinalizedHeightNeverMovesBackward(t *testing.T) {
	s := newMemoryStore()
	i := New(420, "v1", s)
	if err := i.AcceptBlock(block(0, "0x00", "", model.FinalityFinalized)); err != nil { t.Fatal(err) }
	if err := i.AcceptBlock(block(1, "0x01", "0x00", model.FinalityFinalized)); err != nil { t.Fatal(err) }
	if err := i.AcceptBlock(block(2, "0x02", "0x01", model.FinalityHead)); err != nil { t.Fatal(err) }
	cp, _, _ := s.Checkpoint()
	if cp.FinalizedHeight != 1 { t.Fatalf("finalized height moved unexpectedly: %d", cp.FinalizedHeight) }
}

func TestDerivedHealthIsDescriptiveOnly(t *testing.T) {
	s := newMemoryStore()
	i := New(420, "v1", s)
	if err := i.AcceptBlock(block(0, "0x00", "", model.FinalityFinalized)); err != nil { t.Fatal(err) }
	h, err := i.Health("registry-decoder-v1")
	if err != nil { t.Fatal(err) }
	if h.ChainID != 420 || h.SchemaVersion != "v1" || h.DecoderSet != "registry-decoder-v1" {
		t.Fatalf("unexpected health metadata: %+v", h)
	}
}

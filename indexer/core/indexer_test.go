package core

import (
	"errors"
	"testing"

	"github.com/420integrated/420-integrated/indexer/model"
)

type fakeSource struct{ chain uint64 }
func (f fakeSource) ChainID() (uint64, error) { return f.chain, nil }

type memoryStore struct {
	cp     model.ChainCheckpoint
	hasCP  bool
	blocks map[uint64]model.BlockRecord
}

func newMemoryStore() *memoryStore { return &memoryStore{blocks: map[uint64]model.BlockRecord{}} }
func (m *memoryStore) Checkpoint() (model.ChainCheckpoint, bool, error) { return m.cp, m.hasCP, nil }
func (m *memoryStore) SaveCheckpoint(cp model.ChainCheckpoint) error { m.cp, m.hasCP = cp, true; return nil }
func (m *memoryStore) Block(n uint64) (model.BlockRecord, bool, error) { b, ok := m.blocks[n]; return b, ok, nil }
func (m *memoryStore) PutBlock(b model.BlockRecord) error { m.blocks[b.Number] = b; return nil }
func (m *memoryStore) DeleteBlocksAbove(n uint64) error {
	for height := range m.blocks {
		if height > n { delete(m.blocks, height) }
	}
	return nil
}

func block(n uint64, hash, parent string, finality model.Finality) model.BlockRecord {
	return model.BlockRecord{ChainID: 420, Number: n, Hash: hash, ParentHash: parent, Finality: finality, SchemaVersion: "v1"}
}

func TestRejectsWrongChainSource(t *testing.T) {
	i := New(420, "v1", newMemoryStore())
	if !errors.Is(i.ValidateSource(fakeSource{chain: 1}), ErrWrongChain) {
		t.Fatal("expected wrong-chain rejection")
	}
}

func TestTracksFinalityAndCheckpoint(t *testing.T) {
	s := newMemoryStore()
	i := New(420, "v1", s)
	if err := i.AcceptBlock(block(0, "0x00", "", model.FinalityFinalized)); err != nil { t.Fatal(err) }
	if err := i.AcceptBlock(block(1, "0x01", "0x00", model.FinalitySafe)); err != nil { t.Fatal(err) }
	if err := i.AcceptBlock(block(2, "0x02", "0x01", model.FinalityHead)); err != nil { t.Fatal(err) }

	h, err := i.Health("decoders-v1")
	if err != nil { t.Fatal(err) }
	if h.IndexedHeight != 2 || h.SafeHeight != 1 || h.FinalizedHeight != 0 {
		t.Fatalf("unexpected health: %+v", h)
	}
}

func TestNonFinalizedReorgRollsBackAndSignalsReplay(t *testing.T) {
	s := newMemoryStore()
	i := New(420, "v1", s)
	if err := i.AcceptBlock(block(0, "0x00", "", model.FinalityFinalized)); err != nil { t.Fatal(err) }
	if err := i.AcceptBlock(block(1, "0x01", "0x00", model.FinalitySafe)); err != nil { t.Fatal(err) }
	if err := i.AcceptBlock(block(2, "0x02a", "0x01", model.FinalityHead)); err != nil { t.Fatal(err) }
	if err := i.AcceptBlock(block(3, "0x03a", "0x02a", model.FinalityHead)); err != nil { t.Fatal(err) }

	err := i.AcceptBlock(block(3, "0x03b", "0x02b", model.FinalityHead))
	if !errors.Is(err, ErrParentMismatch) { t.Fatalf("expected replay signal, got %v", err) }
	if _, ok, _ := s.Block(3); ok { t.Fatal("expected non-finalized tip rollback") }
}

func TestFinalizedConflictFailsClosed(t *testing.T) {
	s := newMemoryStore()
	i := New(420, "v1", s)
	if err := i.AcceptBlock(block(0, "0x00", "", model.FinalityFinalized)); err != nil { t.Fatal(err) }
	if err := i.AcceptBlock(block(1, "0x01", "0x00", model.FinalityFinalized)); err != nil { t.Fatal(err) }
	if err := i.AcceptBlock(block(2, "0x02", "0x01", model.FinalityHead)); err != nil { t.Fatal(err) }

	err := i.AcceptBlock(block(2, "0x02b", "0x01b", model.FinalityHead))
	if !errors.Is(err, ErrFinalizedConflict) { t.Fatalf("expected finalized conflict, got %v", err) }
	h, _ := i.Health("decoders-v1")
	if h.State != "DEGRADED_FINALIZED_CONFLICT" { t.Fatalf("unexpected state %s", h.State) }
}

func TestRestartUsesPersistedCheckpoint(t *testing.T) {
	s := newMemoryStore()
	first := New(420, "v1", s)
	if err := first.AcceptBlock(block(0, "0x00", "", model.FinalityFinalized)); err != nil { t.Fatal(err) }
	if err := first.AcceptBlock(block(1, "0x01", "0x00", model.FinalityHead)); err != nil { t.Fatal(err) }

	restarted := New(420, "v1", s)
	if err := restarted.AcceptBlock(block(2, "0x02", "0x01", model.FinalityHead)); err != nil { t.Fatal(err) }
	cp, ok, err := s.Checkpoint()
	if err != nil || !ok { t.Fatal("checkpoint unavailable") }
	if cp.IndexedHeight != 2 || cp.IndexedHash != "0x02" { t.Fatalf("unexpected checkpoint %+v", cp) }
}

package ingest

import (
	"context"
	"errors"
	"path/filepath"
	"testing"

	"github.com/420integrated/420-integrated/indexer/core"
	"github.com/420integrated/420-integrated/indexer/model"
	indexerrpc "github.com/420integrated/420-integrated/indexer/rpc"
	"github.com/420integrated/420-integrated/indexer/store"
)

type fakeFinalitySource struct {
	safe      model.BlockRecord
	finalized model.BlockRecord
}

func (f fakeFinalitySource) ChainID() (uint64, error) { return 420, nil }
func (f fakeFinalitySource) BlockNumber(context.Context) (uint64, error) { return f.safe.Number, nil }
func (f fakeFinalitySource) BundleByNumber(context.Context, uint64, uint64, model.Finality, string) (indexerrpc.Bundle, error) {
	return indexerrpc.Bundle{}, errors.New("unused")
}
func (f fakeFinalitySource) SafeBlock(context.Context, uint64, string) (model.BlockRecord, error) { return f.safe, nil }
func (f fakeFinalitySource) FinalizedBlock(context.Context, uint64, string) (model.BlockRecord, error) { return f.finalized, nil }

func seedFinalityStore(t *testing.T) *store.FileStore {
	t.Helper()
	s, err := store.NewFileStore(filepath.Join(t.TempDir(), "indexer.json"))
	if err != nil { t.Fatal(err) }
	for n := uint64(0); n <= 5; n++ {
		if err := s.PutBlock(model.BlockRecord{ChainID: 420, Number: n, Hash: hashFor(n), Finality: model.FinalityHead, SchemaVersion: "420-indexer-v1"}); err != nil { t.Fatal(err) }
	}
	if err := s.SaveCheckpoint(model.ChainCheckpoint{ChainID: 420, IndexedHeight: 5, IndexedHash: hashFor(5), SchemaVersion: "420-indexer-v1"}); err != nil { t.Fatal(err) }
	return s
}

func hashFor(n uint64) string { return "0x" + string(rune('a'+n)) }

func TestPromoteFinalityMarksFinalizedAndSafeRanges(t *testing.T) {
	s := seedFinalityStore(t)
	source := fakeFinalitySource{
		finalized: model.BlockRecord{ChainID: 420, Number: 2, Hash: hashFor(2)},
		safe: model.BlockRecord{ChainID: 420, Number: 4, Hash: hashFor(4)},
	}
	e := New(420, "420-indexer-v1", source, s)
	if err := e.PromoteFinality(context.Background()); err != nil { t.Fatal(err) }

	for n := uint64(0); n <= 2; n++ {
		b, _, _ := s.Block(n)
		if b.Finality != model.FinalityFinalized { t.Fatalf("block %d finality=%s", n, b.Finality) }
	}
	for n := uint64(3); n <= 4; n++ {
		b, _, _ := s.Block(n)
		if b.Finality != model.FinalitySafe { t.Fatalf("block %d finality=%s", n, b.Finality) }
	}
	b, _, _ := s.Block(5)
	if b.Finality != model.FinalityHead { t.Fatalf("head block finality=%s", b.Finality) }
	cp, _, _ := s.Checkpoint()
	if cp.FinalizedHeight != 2 || cp.FinalizedHash != hashFor(2) || cp.SafeHeight != 4 || cp.SafeHash != hashFor(4) {
		t.Fatalf("unexpected checkpoint: %+v", cp)
	}
}

func TestPromoteFinalityRejectsFinalizedHashConflict(t *testing.T) {
	s := seedFinalityStore(t)
	before, _, _ := s.Checkpoint()
	source := fakeFinalitySource{
		finalized: model.BlockRecord{ChainID: 420, Number: 2, Hash: "0xwrong"},
		safe: model.BlockRecord{ChainID: 420, Number: 4, Hash: hashFor(4)},
	}
	e := New(420, "420-indexer-v1", source, s)
	if err := e.PromoteFinality(context.Background()); !errors.Is(err, core.ErrFinalizedConflict) { t.Fatalf("expected finalized conflict, got %v", err) }
	after, _, _ := s.Checkpoint()
	if after.FinalizedHeight != before.FinalizedHeight || after.SafeHeight != before.SafeHeight { t.Fatalf("checkpoint advanced on conflict: %+v", after) }
}

func TestPromoteFinalityRejectsInvalidOrdering(t *testing.T) {
	s := seedFinalityStore(t)
	source := fakeFinalitySource{
		finalized: model.BlockRecord{ChainID: 420, Number: 4, Hash: hashFor(4)},
		safe: model.BlockRecord{ChainID: 420, Number: 3, Hash: hashFor(3)},
	}
	e := New(420, "420-indexer-v1", source, s)
	if err := e.PromoteFinality(context.Background()); err == nil { t.Fatal("expected invalid finality ordering") }
}

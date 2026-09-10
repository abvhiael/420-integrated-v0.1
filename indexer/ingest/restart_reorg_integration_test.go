package ingest

import (
	"context"
	"fmt"
	"path/filepath"
	"testing"

	"github.com/420integrated/420-integrated/indexer/model"
	indexerrpc "github.com/420integrated/420-integrated/indexer/rpc"
	"github.com/420integrated/420-integrated/indexer/store"
)

type integrationSource struct {
	bundles   map[uint64]indexerrpc.Bundle
	head      uint64
	safe      uint64
	finalized uint64
}

func (s integrationSource) ChainID() (uint64, error) { return 420, nil }
func (s integrationSource) BlockNumber(context.Context) (uint64, error) { return s.head, nil }
func (s integrationSource) BundleByNumber(_ context.Context, _ uint64, n uint64, finality model.Finality, schema string) (indexerrpc.Bundle, error) {
	b, ok := s.bundles[n]
	if !ok { return indexerrpc.Bundle{}, fmt.Errorf("missing block %d", n) }
	b.Block.Finality = finality
	b.Block.SchemaVersion = schema
	return b, nil
}
func (s integrationSource) SafeBlock(_ context.Context, chainID uint64, schema string) (model.BlockRecord, error) {
	b := s.bundles[s.safe].Block
	b.ChainID, b.SchemaVersion = chainID, schema
	return b, nil
}
func (s integrationSource) FinalizedBlock(_ context.Context, chainID uint64, schema string) (model.BlockRecord, error) {
	b := s.bundles[s.finalized].Block
	b.ChainID, b.SchemaVersion = chainID, schema
	return b, nil
}

func bundle(n uint64, hash, parent string) indexerrpc.Bundle {
	return indexerrpc.Bundle{Block: model.BlockRecord{ChainID: 420, Number: n, Hash: hash, ParentHash: parent}}
}

func TestRestartThenRepairsNonFinalizedForkDeterministically(t *testing.T) {
	path := filepath.Join(t.TempDir(), "indexer.json")
	initial := integrationSource{bundles: map[uint64]indexerrpc.Bundle{
		0: bundle(0, "g", ""), 1: bundle(1, "a1", "g"), 2: bundle(2, "a2", "a1"), 3: bundle(3, "a3", "a2"),
	}, head: 3, safe: 2, finalized: 1}

	s, err := store.NewFileStore(path)
	if err != nil { t.Fatal(err) }
	if err := New(420, "420-indexer-v1", initial, s).CatchUp(context.Background()); err != nil { t.Fatal(err) }

	// Simulate process restart, then a remote non-finalized fork replacing blocks 3+.
	reopened, err := store.NewFileStore(path)
	if err != nil { t.Fatal(err) }
	forked := integrationSource{bundles: map[uint64]indexerrpc.Bundle{
		0: bundle(0, "g", ""), 1: bundle(1, "a1", "g"), 2: bundle(2, "a2", "a1"),
		3: bundle(3, "b3", "a2"), 4: bundle(4, "b4", "b3"),
	}, head: 4, safe: 3, finalized: 1}
	if err := New(420, "420-indexer-v1", forked, reopened).CatchUp(context.Background()); err != nil { t.Fatal(err) }

	b3, ok, err := reopened.Block(3)
	if err != nil || !ok { t.Fatalf("replacement block 3 missing: ok=%v err=%v", ok, err) }
	b4, ok, err := reopened.Block(4)
	if err != nil || !ok { t.Fatalf("replacement block 4 missing: ok=%v err=%v", ok, err) }
	if b3.Hash != "b3" || b4.Hash != "b4" { t.Fatalf("fork not repaired: b3=%s b4=%s", b3.Hash, b4.Hash) }
	cp, ok, err := reopened.Checkpoint()
	if err != nil || !ok { t.Fatalf("checkpoint missing: ok=%v err=%v", ok, err) }
	if cp.IndexedHeight != 4 || cp.IndexedHash != "b4" || cp.SafeHeight != 3 || cp.FinalizedHeight != 1 {
		t.Fatalf("unexpected repaired checkpoint: %+v", cp)
	}
}

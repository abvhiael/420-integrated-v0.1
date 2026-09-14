package ingest

import (
	"context"
	"fmt"

	"github.com/420integrated/420-integrated/indexer/core"
	"github.com/420integrated/420-integrated/indexer/model"
)

type finalitySource interface {
	SafeBlock(context.Context, uint64, string) (model.BlockRecord, error)
	FinalizedBlock(context.Context, uint64, string) (model.BlockRecord, error)
}

// PromoteFinality refreshes safe/finalized boundaries from the canonical RPC source.
// Boundary hashes are verified against indexed history before any promotion occurs.
func (e *Engine) PromoteFinality(ctx context.Context) error {
	source, ok := e.source.(finalitySource)
	if !ok { return nil }
	cp, hasCP, err := e.store.Checkpoint()
	if err != nil { return err }
	if !hasCP { return nil }

	finalized, err := source.FinalizedBlock(ctx, e.chainID, e.schemaVersion)
	if err != nil { return fmt.Errorf("read finalized tag: %w", err) }
	safe, err := source.SafeBlock(ctx, e.chainID, e.schemaVersion)
	if err != nil { return fmt.Errorf("read safe tag: %w", err) }
	if finalized.Number > safe.Number || safe.Number > cp.IndexedHeight {
		return fmt.Errorf("invalid finality ordering finalized=%d safe=%d indexed=%d", finalized.Number, safe.Number, cp.IndexedHeight)
	}

	localFinalized, ok, err := e.store.Block(finalized.Number)
	if err != nil { return err }
	if !ok || localFinalized.Hash != finalized.Hash { return core.ErrFinalizedConflict }
	localSafe, ok, err := e.store.Block(safe.Number)
	if err != nil { return err }
	if !ok || localSafe.Hash != safe.Hash {
		return fmt.Errorf("safe boundary mismatch at block %d", safe.Number)
	}

	for n := cp.FinalizedHeight; n <= finalized.Number; n++ {
		block, ok, err := e.store.Block(n)
		if err != nil { return err }
		if !ok { continue }
		if block.Finality != model.FinalityFinalized {
			block.Finality = model.FinalityFinalized
			if err := e.store.PutBlock(block); err != nil { return err }
		}
		if n == finalized.Number { break }
	}

	startSafe := finalized.Number + 1
	if cp.SafeHeight > startSafe { startSafe = cp.SafeHeight }
	for n := startSafe; n <= safe.Number; n++ {
		block, ok, err := e.store.Block(n)
		if err != nil { return err }
		if !ok { continue }
		if block.Finality != model.FinalitySafe {
			block.Finality = model.FinalitySafe
			if err := e.store.PutBlock(block); err != nil { return err }
		}
		if n == safe.Number { break }
	}

	cp.FinalizedHeight, cp.FinalizedHash = finalized.Number, finalized.Hash
	cp.SafeHeight, cp.SafeHash = safe.Number, safe.Hash
	return e.store.SaveCheckpoint(cp)
}

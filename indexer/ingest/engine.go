package ingest

import (
	"context"
	"errors"
	"fmt"

	"github.com/420integrated/420-integrated/indexer/core"
	"github.com/420integrated/420-integrated/indexer/model"
	"github.com/420integrated/420-integrated/indexer/reorg"
	indexerrpc "github.com/420integrated/420-integrated/indexer/rpc"
)

// Source is the concrete ingestion surface required from node420-compatible JSON-RPC.
type Source interface {
	core.Source
	BlockNumber(context.Context) (uint64, error)
	BundleByNumber(context.Context, uint64, uint64, model.Finality, string) (indexerrpc.Bundle, error)
}

// Store combines the core checkpoint/block store with durable canonical-source bundle persistence.
type Store interface {
	core.Store
	PutBundle(model.BlockRecord, []model.TransactionRecord, []model.ReceiptRecord, []model.LogRecord) error
}

type Engine struct {
	chainID       uint64
	schemaVersion string
	source        Source
	store         Store
	core          *core.Indexer
}

func New(chainID uint64, schemaVersion string, source Source, store Store) *Engine {
	return &Engine{chainID: chainID, schemaVersion: schemaVersion, source: source, store: store, core: core.New(chainID, schemaVersion, store)}
}

// CatchUp ingests sequential canonical blocks through the current RPC head.
// On an ancestry mismatch, GEN-11.1C deterministically finds the highest common ancestor,
// rolls back only non-finalized history, and replays the remote canonical branch.
// After ingestion or repair, safe/finalized tags are verified and promoted into durable state.
func (e *Engine) CatchUp(ctx context.Context) error {
	if err := e.core.ValidateSource(e.source); err != nil { return err }
	head, err := e.source.BlockNumber(ctx)
	if err != nil { return err }
	cp, hasCP, err := e.store.Checkpoint()
	if err != nil { return err }
	start := uint64(0)
	if hasCP { start = cp.IndexedHeight + 1 }
	for number := start; number <= head; number++ {
		if err := ctx.Err(); err != nil { return err }
		bundle, err := e.source.BundleByNumber(ctx, e.chainID, number, model.FinalityHead, e.schemaVersion)
		if err != nil { return fmt.Errorf("fetch block %d: %w", number, err) }
		if bundle.Block.Number != number { return fmt.Errorf("rpc returned block %d for requested %d", bundle.Block.Number, number) }
		if number > 0 {
			parent, ok, err := e.store.Block(number - 1)
			if err != nil { return err }
			if hasCP || number > start {
				if !ok || parent.Hash != bundle.Block.ParentHash {
					r := reorg.New(e.chainID, e.schemaVersion, e.source, e.store)
					if err := r.Repair(ctx, head); err != nil { return fmt.Errorf("repair reorg at block %d: %w", number, err) }
					return e.PromoteFinality(ctx)
				}
			}
		}
		// Persist the complete canonical-source bundle before checkpoint advancement.
		// If the process dies after this write, replay is idempotent because the checkpoint remains behind.
		if err := e.store.PutBundle(bundle.Block, bundle.Transactions, bundle.Receipts, bundle.Logs); err != nil {
			return fmt.Errorf("persist block %d bundle: %w", number, err)
		}
		if err := e.indexContracts(ctx, bundle.Block, bundle.Receipts); err != nil {
			return fmt.Errorf("persist block %d contract runtime projection: %w", number, err)
		}
		if err := e.core.AcceptBlock(bundle.Block); err != nil {
			if errors.Is(err, core.ErrParentMismatch) {
				r := reorg.New(e.chainID, e.schemaVersion, e.source, e.store)
				if repairErr := r.Repair(ctx, head); repairErr != nil { return fmt.Errorf("repair reorg after accept block %d: %w", number, repairErr) }
				return e.PromoteFinality(ctx)
			}
			return fmt.Errorf("accept block %d: %w", number, err)
		}
	}
	return e.PromoteFinality(ctx)
}

func (e *Engine) Core() *core.Indexer { return e.core }

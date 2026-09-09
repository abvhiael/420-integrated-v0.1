package ingest

import (
	"context"
	"errors"
	"fmt"

	"github.com/420integrated/420-integrated/indexer/core"
	"github.com/420integrated/420-integrated/indexer/model"
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
// GEN-11.1B intentionally stops on an ancestry mismatch; deterministic reorg discovery/replay is GEN-11.1C.
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
					return fmt.Errorf("%w at block %d", core.ErrParentMismatch, number)
				}
			}
		}
		// Persist the complete canonical-source bundle before checkpoint advancement.
		// If the process dies after this write, replay is idempotent because the checkpoint remains behind.
		if err := e.store.PutBundle(bundle.Block, bundle.Transactions, bundle.Receipts, bundle.Logs); err != nil {
			return fmt.Errorf("persist block %d bundle: %w", number, err)
		}
		if err := e.core.AcceptBlock(bundle.Block); err != nil {
			if errors.Is(err, core.ErrParentMismatch) { return err }
			return fmt.Errorf("accept block %d: %w", number, err)
		}
	}
	return nil
}

func (e *Engine) Core() *core.Indexer { return e.core }

package reorg

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/420integrated/420-integrated/indexer/model"
	indexerrpc "github.com/420integrated/420-integrated/indexer/rpc"
)

var (
	ErrNoCommonAncestor = errors.New("no common ancestor above finalized boundary")
	ErrRemoteFinalizedConflict = errors.New("remote chain conflicts with finalized history")
)

// Source supplies canonical bundles by height from a node420-compatible source.
type Source interface {
	BundleByNumber(context.Context, uint64, uint64, model.Finality, string) (indexerrpc.Bundle, error)
}

// Store is the rollback/replay surface required by GEN-11.1C.
type Store interface {
	Checkpoint() (model.ChainCheckpoint, bool, error)
	SaveCheckpoint(model.ChainCheckpoint) error
	Block(uint64) (model.BlockRecord, bool, error)
	PutBundle(model.BlockRecord, []model.TransactionRecord, []model.ReceiptRecord, []model.LogRecord) error
	DeleteBlocksAbove(uint64) error
}

type Engine struct {
	chainID uint64
	schemaVersion string
	source Source
	store Store
}

func New(chainID uint64, schemaVersion string, source Source, store Store) *Engine {
	return &Engine{chainID: chainID, schemaVersion: schemaVersion, source: source, store: store}
}

// FindCommonAncestor walks backward from the local indexed head to the finalized boundary.
// It returns the highest height whose local and remote hashes match.
func (e *Engine) FindCommonAncestor(ctx context.Context) (uint64, error) {
	cp, ok, err := e.store.Checkpoint()
	if err != nil { return 0, err }
	if !ok { return 0, ErrNoCommonAncestor }

	for h := cp.IndexedHeight; ; h-- {
		if err := ctx.Err(); err != nil { return 0, err }
		local, exists, err := e.store.Block(h)
		if err != nil { return 0, err }
		if !exists { return 0, fmt.Errorf("local block %d missing", h) }
		remote, err := e.source.BundleByNumber(ctx, e.chainID, h, model.FinalityHead, e.schemaVersion)
		if err != nil { return 0, fmt.Errorf("fetch remote block %d: %w", h, err) }
		if remote.Block.Hash == local.Hash { return h, nil }
		if h <= cp.FinalizedHeight {
			return 0, ErrRemoteFinalizedConflict
		}
	}
}

// Repair rolls back only non-finalized history and deterministically replays remote canonical history through head.
func (e *Engine) Repair(ctx context.Context, remoteHead uint64) error {
	cp, ok, err := e.store.Checkpoint()
	if err != nil { return err }
	if !ok { return ErrNoCommonAncestor }

	ancestor, err := e.FindCommonAncestor(ctx)
	if err != nil { return err }
	if err := RequireRollback(cp.FinalizedHeight, ancestor); err != nil { return err }

	if err := e.store.DeleteBlocksAbove(ancestor); err != nil { return fmt.Errorf("rollback above %d: %w", ancestor, err) }
	ancestorBlock, exists, err := e.store.Block(ancestor)
	if err != nil { return err }
	if !exists { return fmt.Errorf("ancestor block %d missing after rollback", ancestor) }

	cp.IndexedHeight = ancestor
	cp.IndexedHash = ancestorBlock.Hash
	if cp.SafeHeight > ancestor { cp.SafeHeight, cp.SafeHash = ancestor, ancestorBlock.Hash }
	cp.UpdatedAt = time.Now().UTC()
	if err := e.store.SaveCheckpoint(cp); err != nil { return fmt.Errorf("save rollback checkpoint: %w", err) }

	parentHash := ancestorBlock.Hash
	for h := ancestor + 1; h <= remoteHead; h++ {
		if err := ctx.Err(); err != nil { return err }
		bundle, err := e.source.BundleByNumber(ctx, e.chainID, h, model.FinalityHead, e.schemaVersion)
		if err != nil { return fmt.Errorf("replay fetch block %d: %w", h, err) }
		if bundle.Block.Number != h { return fmt.Errorf("remote returned block %d for requested %d", bundle.Block.Number, h) }
		if bundle.Block.ParentHash != parentHash { return fmt.Errorf("non-contiguous replay at block %d", h) }
		if err := e.store.PutBundle(bundle.Block, bundle.Transactions, bundle.Receipts, bundle.Logs); err != nil {
			return fmt.Errorf("replay persist block %d: %w", h, err)
		}
		if err := e.replayContracts(ctx, bundle.Block, bundle.Receipts); err != nil {
			return fmt.Errorf("replay contract runtime projection at block %d: %w", h, err)
		}
		cp.IndexedHeight, cp.IndexedHash = h, bundle.Block.Hash
		cp.UpdatedAt = time.Now().UTC()
		if err := e.store.SaveCheckpoint(cp); err != nil { return fmt.Errorf("replay checkpoint block %d: %w", h, err) }
		parentHash = bundle.Block.Hash
	}
	return nil
}

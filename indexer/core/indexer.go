package core

import (
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/420integrated/420-integrated/indexer/model"
)

var (
	ErrWrongChain        = errors.New("wrong chain")
	ErrFinalizedConflict = errors.New("finalized history conflict")
	ErrParentMismatch    = errors.New("parent hash mismatch")
)

// Source is the minimum canonical chain interface required by the indexer core.
type Source interface {
	ChainID() (uint64, error)
}

// Store is intentionally narrow. Persistent implementations may use SQL, KV, or another rebuildable store.
type Store interface {
	Checkpoint() (model.ChainCheckpoint, bool, error)
	SaveCheckpoint(model.ChainCheckpoint) error
	Block(number uint64) (model.BlockRecord, bool, error)
	PutBlock(model.BlockRecord) error
	DeleteBlocksAbove(number uint64) error
}

// Indexer owns no canonical authority. It coordinates a rebuildable projection over canonical sources.
type Indexer struct {
	mu            sync.Mutex
	requiredChain uint64
	schemaVersion string
	store         Store
	state         string
	lastIngestAt  time.Time
}

func New(requiredChain uint64, schemaVersion string, store Store) *Indexer {
	return &Indexer{requiredChain: requiredChain, schemaVersion: schemaVersion, store: store, state: "STARTING"}
}

func (i *Indexer) ValidateSource(source Source) error {
	chainID, err := source.ChainID()
	if err != nil {
		return err
	}
	if chainID != i.requiredChain {
		i.mu.Lock()
		i.state = "DEGRADED_WRONG_CHAIN"
		i.mu.Unlock()
		return fmt.Errorf("%w: required=%d got=%d", ErrWrongChain, i.requiredChain, chainID)
	}
	return nil
}

// AcceptBlock applies canonical ancestry rules. A non-finalized reorg rolls back to the incoming parent.
// A conflict at or below finalized height fails closed.
func (i *Indexer) AcceptBlock(block model.BlockRecord) error {
	i.mu.Lock()
	defer i.mu.Unlock()

	if block.ChainID != i.requiredChain {
		i.state = "DEGRADED_WRONG_CHAIN"
		return ErrWrongChain
	}

	cp, hasCP, err := i.store.Checkpoint()
	if err != nil {
		return err
	}

	if hasCP && block.Number > 0 {
		parent, ok, err := i.store.Block(block.Number - 1)
		if err != nil {
			return err
		}
		if !ok || parent.Hash != block.ParentHash {
			if block.Number-1 <= cp.FinalizedHeight {
				i.state = "DEGRADED_FINALIZED_CONFLICT"
				return ErrFinalizedConflict
			}
			if err := i.store.DeleteBlocksAbove(block.Number - 2); err != nil {
				return err
			}
			return ErrParentMismatch
		}
	}

	if err := i.store.PutBlock(block); err != nil {
		return err
	}

	if !hasCP {
		cp = model.ChainCheckpoint{ChainID: i.requiredChain, SchemaVersion: i.schemaVersion}
	}
	cp.IndexedHeight = block.Number
	cp.IndexedHash = block.Hash
	if block.Finality == model.FinalitySafe && block.Number >= cp.SafeHeight {
		cp.SafeHeight, cp.SafeHash = block.Number, block.Hash
	}
	if block.Finality == model.FinalityFinalized && block.Number >= cp.FinalizedHeight {
		cp.FinalizedHeight, cp.FinalizedHash = block.Number, block.Hash
		if cp.SafeHeight < block.Number {
			cp.SafeHeight, cp.SafeHash = block.Number, block.Hash
		}
	}
	cp.UpdatedAt = time.Now().UTC()
	cp.SchemaVersion = i.schemaVersion
	if err := i.store.SaveCheckpoint(cp); err != nil {
		return err
	}
	i.lastIngestAt = cp.UpdatedAt
	i.state = "HEALTHY"
	return nil
}

func (i *Indexer) Health(decoderSet string) (model.Health, error) {
	i.mu.Lock()
	defer i.mu.Unlock()
	cp, _, err := i.store.Checkpoint()
	if err != nil {
		return model.Health{}, err
	}
	return model.Health{
		ChainID:         i.requiredChain,
		IndexedHeight:   cp.IndexedHeight,
		SafeHeight:      cp.SafeHeight,
		FinalizedHeight: cp.FinalizedHeight,
		SchemaVersion:   i.schemaVersion,
		DecoderSet:      decoderSet,
		State:           i.state,
		LastIngestAt:    i.lastIngestAt,
	}, nil
}

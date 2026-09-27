package store

import (
	"errors"
	"fmt"
	"strings"

	"github.com/420integrated/420-integrated/indexer/model"
)

var (
	ErrFinalizedMutation = errors.New("finalized history mutation rejected")
	ErrInvalidCanonicalRecord = errors.New("invalid canonical block record")
)

// CanonicalBlockKey is the durable identity of a canonical-source block.
// Height is intentionally not part of identity because height can be replaced
// above finality during a reorg; chain ID plus block hash cannot.
func CanonicalBlockKey(chainID uint64, hash string) (string, error) {
	hash = strings.ToLower(strings.TrimSpace(hash))
	if chainID == 0 || hash == "" {
		return "", ErrInvalidCanonicalRecord
	}
	return fmt.Sprintf("%d:%s", chainID, hash), nil
}

func validateBlockRecord(block model.BlockRecord) error {
	if _, err := CanonicalBlockKey(block.ChainID, block.Hash); err != nil {
		return err
	}
	return nil
}

func rejectFinalizedOverwrite(existing model.BlockRecord, incoming model.BlockRecord) error {
	if existing.Finality == model.FinalityFinalized && !strings.EqualFold(existing.Hash, incoming.Hash) {
		return fmt.Errorf("%w: height=%d existing=%s incoming=%s", ErrFinalizedMutation, existing.Number, existing.Hash, incoming.Hash)
	}
	return nil
}

func rejectRollbackBelowFinality(cp *model.ChainCheckpoint, number uint64) error {
	if cp != nil && number < cp.FinalizedHeight {
		return fmt.Errorf("%w: rollback=%d finalized=%d", ErrFinalizedMutation, number, cp.FinalizedHeight)
	}
	return nil
}

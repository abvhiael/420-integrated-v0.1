package reorg

import "errors"

var ErrFinalizedBoundary = errors.New("reorg crosses finalized boundary")

// CanRollback returns whether a rollback target stays strictly above finalized history.
func CanRollback(finalizedHeight, targetHeight uint64) bool {
	return targetHeight >= finalizedHeight
}

// RequireRollback enforces the fail-closed finalized-history boundary.
func RequireRollback(finalizedHeight, targetHeight uint64) error {
	if !CanRollback(finalizedHeight, targetHeight) {
		return ErrFinalizedBoundary
	}
	return nil
}

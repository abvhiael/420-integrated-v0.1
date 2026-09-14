package reorg

import (
	"errors"
	"testing"
)

func TestRollbackAtFinalizedBoundaryAllowed(t *testing.T) {
	if err := RequireRollback(100, 100); err != nil { t.Fatal(err) }
}

func TestRollbackBelowFinalizedBoundaryRejected(t *testing.T) {
	if err := RequireRollback(100, 99); !errors.Is(err, ErrFinalizedBoundary) {
		t.Fatalf("expected finalized boundary rejection, got %v", err)
	}
}

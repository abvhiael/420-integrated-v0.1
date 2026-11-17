//go:build !stake_signing_faults

package slashing

import (
	"errors"
	"testing"
)

func TestProductionHistoryIgnoresQualificationInterruption(t *testing.T) {
	t.Setenv("STAKE_SIGNING_STOP_AT", "history-write")
	path, id := historyFixture(t)
	initHistory(t, path, id)
	p := openHistory(t, path, id)
	if err := p.CheckAndRecordProposal(id.ValidatorID, 1, historyRoot(9)); err != nil {
		t.Fatal(err)
	}
	if err := p.CheckAndRecordProposal(id.ValidatorID, 1, historyRoot(10)); !errors.Is(err, ErrDoubleProposal) {
		t.Fatalf("production protection changed: %v", err)
	}
}

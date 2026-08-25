package finality

import (
	"fmt"

	ctypes "github.com/420integrated/420-integrated/consensus/types"
)

type Status struct {
	Head      ctypes.Checkpoint
	Safe      ctypes.Checkpoint
	Finalized ctypes.Checkpoint
}

type Tracker struct {
	status    Status
	certified map[ctypes.Root]ctypes.QuorumCertificate
	parent    map[ctypes.Root]ctypes.Root
	slot      map[ctypes.Root]uint64
}

func NewTracker(genesis ctypes.Checkpoint) *Tracker {
	return &Tracker{
		status:    Status{Head: genesis, Safe: genesis, Finalized: genesis},
		certified: make(map[ctypes.Root]ctypes.QuorumCertificate),
		parent:    make(map[ctypes.Root]ctypes.Root),
		slot:      make(map[ctypes.Root]uint64),
	}
}

func (t *Tracker) Status() Status { return t.status }

func NewTrackerFromStatus(status Status) *Tracker {
	return &Tracker{
		status:    status,
		certified: make(map[ctypes.Root]ctypes.QuorumCertificate),
		parent:    make(map[ctypes.Root]ctypes.Root),
		slot:      make(map[ctypes.Root]uint64),
	}
}

func (t *Tracker) AddCertified(qc ctypes.QuorumCertificate) error {
	if qc.Slot < t.status.Finalized.Slot {
		return fmt.Errorf("QC slot %d below finalized slot %d", qc.Slot, t.status.Finalized.Slot)
	}
	t.certified[qc.BlockRoot] = qc
	t.parent[qc.BlockRoot] = qc.ParentRoot
	t.slot[qc.BlockRoot] = qc.Slot

	if qc.Slot >= t.status.Head.Slot {
		t.status.Head = ctypes.Checkpoint{Slot: qc.Slot, Root: qc.BlockRoot}
	}
	if qc.Slot >= t.status.Safe.Slot {
		t.status.Safe = ctypes.Checkpoint{Slot: qc.Slot, Root: qc.BlockRoot}
	}

	// One-block chained finality: when certified child C names certified parent P,
	// P becomes finalized, provided it advances finality.
	if parentQC, ok := t.certified[qc.ParentRoot]; ok {
		if parentQC.Slot > t.status.Finalized.Slot {
			t.status.Finalized = ctypes.Checkpoint{Slot: parentQC.Slot, Root: parentQC.BlockRoot}
		}
	}
	return nil
}

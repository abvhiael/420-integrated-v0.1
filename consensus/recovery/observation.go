package recovery

import (
	"bytes"
	"fmt"
	sys "github.com/420integrated/420-integrated/consensus/systemcall"
	ct "github.com/420integrated/420-integrated/consensus/types"
	"os"
	"path/filepath"
)

// CertifiedSnapshot is a read-only, reverified accounting input. Canonical omits
// orphaned selections; it cannot update settlement, fork choice or execution.
type CertifiedSnapshot struct {
	Trust     Trust
	Head      ct.Checkpoint
	Finalized ct.Checkpoint
	Anchor    sys.SequenceAnchor
	Canonical []Record
}

func ReadCertifiedSnapshot(t Trust, dir string) (CertifiedSnapshot, error) {
	var out CertifiedSnapshot
	sig, err := ProductionSignatures()
	if err != nil {
		return out, err
	}
	if err = t.validate(sig); err != nil {
		return out, err
	}
	hp, cp := filepath.Join(dir, "history.json"), filepath.Join(dir, "checkpoint.json")
	hraw, err := os.ReadFile(hp)
	if err != nil {
		return out, err
	}
	craw, err := os.ReadFile(cp)
	if err != nil {
		return out, err
	}
	var h history
	var c checkpoint
	if err = Decode(hraw, &h); err != nil {
		return out, err
	}
	if err = Decode(craw, &c); err != nil {
		return out, err
	}
	if h.Schema != "420-certified-settlement-history-v1" || h.TrustHash != hashJSON(t) || h.Checksum != historyChecksum(h) || c.Schema != "420-settlement-checkpoint-v1" || c.TrustHash != h.TrustHash || c.Checksum != checkpointChecksum(c) {
		return out, fmt.Errorf("accounting consensus integrity/trust mismatch")
	}
	if h.Pending != nil {
		return out, fmt.Errorf("unsettled consensus intent prevents reconciliation")
	}
	v := newView(t)
	for _, record := range h.Entries {
		if _, _, err = v.add(t, sig, record); err != nil {
			return out, err
		}
	}
	status := v.tracker.Status()
	if c.Head != status.Head || c.Finalized != status.Finalized || v.anchors[c.Head.Root] != c.Settlement {
		return out, fmt.Errorf("consensus settlement checkpoint/history skew")
	}
	path, err := v.path(t, c.Head.Root)
	if err != nil {
		return out, err
	}
	hafter, err := os.ReadFile(hp)
	if err != nil {
		return out, err
	}
	cafter, err := os.ReadFile(cp)
	if err != nil {
		return out, err
	}
	if !bytes.Equal(hraw, hafter) || !bytes.Equal(craw, cafter) {
		return out, fmt.Errorf("consensus snapshot changed during reconciliation")
	}
	return CertifiedSnapshot{Trust: t, Head: c.Head, Finalized: c.Finalized, Anchor: c.Settlement, Canonical: path}, nil
}

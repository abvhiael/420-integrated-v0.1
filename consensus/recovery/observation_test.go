//go:build blst

package recovery

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

func TestReadOnlyAccountingSnapshotCanonicalReplacementAndFinality(t *testing.T) {
	trust, keys := fixture(t)
	sig, _ := ProductionSignatures()
	a := certified(t, trust, keys, nil, 0, 1, 10)
	b := certified(t, trust, keys, &a, 1, 2, 11)
	replacement := certified(t, trust, keys, &a, 1, 3, 12)
	v := newView(trust)
	h := history{Schema: "420-certified-settlement-history-v1", TrustHash: hashJSON(trust), Entries: []Record{a, b, replacement}}
	for _, r := range h.Entries {
		if _, _, err := v.add(trust, sig, r); err != nil {
			t.Fatal(err)
		}
	}
	status := v.tracker.Status()
	c := checkpoint{Schema: "420-settlement-checkpoint-v1", TrustHash: h.TrustHash, Head: status.Head, Finalized: status.Finalized, Settlement: v.anchors[status.Head.Root]}
	dir := t.TempDir()
	write := func() {
		h.Checksum = historyChecksum(h)
		c.Checksum = checkpointChecksum(c)
		for name, value := range map[string]any{"history.json": h, "checkpoint.json": c} {
			raw, _ := json.Marshal(value)
			if err := os.WriteFile(filepath.Join(dir, name), raw, 0600); err != nil {
				t.Fatal(err)
			}
		}
	}
	write()
	for i := 0; i < 3; i++ {
		s, err := ReadCertifiedSnapshot(trust, dir)
		if err != nil || len(s.Canonical) != 2 || s.Canonical[1].Certificate.BlockRoot != replacement.Certificate.BlockRoot {
			t.Fatalf("restart %d: %+v %v", i, s, err)
		}
	}
	h.Pending = &b
	write()
	if _, err := ReadCertifiedSnapshot(trust, dir); err == nil {
		t.Fatal("pending settlement accepted")
	}
	h.Pending = nil
	h.Entries = append(h.Entries, certified(t, trust, keys, nil, 0, 4, 13))
	write()
	if _, err := ReadCertifiedSnapshot(trust, dir); err == nil {
		t.Fatal("cross-finalized history accepted")
	}
	h.Entries = h.Entries[:3]
	c.Settlement.LastSequence++
	write()
	if _, err := ReadCertifiedSnapshot(trust, dir); err == nil {
		t.Fatal("skewed checkpoint accepted")
	}
}

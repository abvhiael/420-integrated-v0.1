package systemcall

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// A legacy file has no integrity evidence. Loading/building must fail without
// changing it; only an explicit independently verified anchor may replace it.
func TestLegacySequenceRequiresExplicitRecovery(t *testing.T) {
	path := filepath.Join(t.TempDir(), "sequence.json")
	s := FileSequenceStore{Path: path}
	m := SequenceManager{Store: s}
	a := SequenceAnchor{ChainID: 420, ExecutionBlock: 100, BlockHash: [32]byte{1}, LastSequence: 9}
	legacy := []byte(`{"schema":"420-stake-systemcall-sequence-v1","chainId":420,"executionBlock":100,"blockHash":"0x0100000000000000000000000000000000000000000000000000000000000000","lastSequence":9}`)
	if err := os.WriteFile(path, legacy, 0600); err != nil {
		t.Fatal(err)
	}
	if _, err := m.BuildNext(a, FinalizedStakeOutcomes{}); err == nil {
		t.Fatal("legacy journal authorized derivation")
	}
	unchanged, err := os.ReadFile(path)
	if err != nil || string(unchanged) != string(legacy) {
		t.Fatal("implicit legacy migration")
	}
	if err := m.RecoverCanonicalParent(a); err != nil {
		t.Fatal(err)
	}
	got, ok, err := s.Load()
	if err != nil || !ok || got != a {
		t.Fatalf("explicit recovery: %v %v %v", got, ok, err)
	}
	raw, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	var disk sequenceFile
	if err := json.Unmarshal(raw, &disk); err != nil {
		t.Fatal(err)
	}
	if disk.Schema != "420-stake-systemcall-sequence-v2" || disk.Checksum == "" {
		t.Fatal("recovery did not write V2 integrity")
	}
}

func TestSequenceJournalRequiresUniqueNonNullFields(t *testing.T) {
	s := FileSequenceStore{Path: filepath.Join(t.TempDir(), "sequence.json")}
	a := SequenceAnchor{ChainID: 420, BlockHash: [32]byte{1}}
	if err := s.Store(a); err != nil {
		t.Fatal(err)
	}
	raw, err := os.ReadFile(s.Path)
	if err != nil {
		t.Fatal(err)
	}
	for name, bad := range map[string]string{
		"duplicate":    strings.Replace(string(raw), "{", `{"lastSequence":0,`, 1),
		"missing-zero": strings.Replace(string(raw), `"lastSequence": 0,`, "", 1),
		"null-zero":    strings.Replace(string(raw), `"lastSequence": 0`, `"lastSequence": null`, 1),
	} {
		t.Run(name, func(t *testing.T) {
			if err := os.WriteFile(s.Path, []byte(bad), 0600); err != nil {
				t.Fatal(err)
			}
			if _, _, err := s.Load(); err == nil {
				t.Fatal("malformed journal accepted with valid struct checksum")
			}
		})
	}
}

func TestSequenceJournalFaults(t *testing.T) {
	path := filepath.Join(t.TempDir(), "seq.json")
	s := FileSequenceStore{Path: path}
	m := SequenceManager{Store: s}
	a := SequenceAnchor{ChainID: 420, ExecutionBlock: 100, BlockHash: [32]byte{1}, LastSequence: 9}
	if e := s.Store(a); e != nil {
		t.Fatal(e)
	}
	raw, e := os.ReadFile(path)
	if e != nil {
		t.Fatal(e)
	}
	for name, bad := range map[string]string{"truncated": "{", "corrupted": strings.Replace(string(raw), "\"lastSequence\": 9", "\"lastSequence\": 8", 1), "unknown": strings.Replace(string(raw), "{", "{\"extra\":true,", 1), "trailing": string(raw) + "{}", "legacy": strings.Replace(string(raw), "sequence-v2", "sequence-v1", 1)} {
		t.Run(name, func(t *testing.T) {
			if e := os.WriteFile(path, []byte(bad), 0600); e != nil {
				t.Fatal(e)
			}
			if _, e := m.RequireCanonicalParent(a); e == nil {
				t.Fatal("invalid journal accepted")
			}
		})
	}
	if e = os.Remove(path); e != nil {
		t.Fatal(e)
	}
	if _, e = m.RequireCanonicalParent(a); e == nil {
		t.Fatal("missing journal accepted")
	}
	if e = s.Store(a); e != nil {
		t.Fatal(e)
	}
	// An obstructed destination must be reported as a failed write.
	bad := FileSequenceStore{Path: filepath.Dir(path)}
	if e = bad.Store(a); e == nil {
		t.Fatal("write failure ignored")
	}
	if got, ok, e := s.Load(); e != nil || !ok || got != a {
		t.Fatalf("original state changed: %v %v %v", got, ok, e)
	}
}

package slashing

import (
	"errors"
	"os"
	"path/filepath"
	"sync"
	"testing"

	ctypes "github.com/420integrated/420-integrated/consensus/types"
)

func historyRoot(n byte) (r ctypes.Root) { r[0] = n; return }
func historyFixture(t *testing.T) (string, HistoryIdentity) {
	t.Helper()
	dir, err := filepath.EvalSymlinks(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	if err = os.Chmod(dir, 0700); err != nil {
		t.Fatal(err)
	}
	id := HistoryIdentity{ChainID: 420, Genesis: historyRoot(1), ValidatorID: 42}
	id.PublicKey[0] = 1
	return filepath.Join(dir, "history.json"), id
}
func openHistory(t *testing.T, path string, id HistoryIdentity) *Protector {
	t.Helper()
	p, e := OpenProtector(path, id)
	if e != nil {
		t.Fatal(e)
	}
	t.Cleanup(func() { p.Close() })
	return p
}
func initHistory(t *testing.T, path string, id HistoryIdentity) {
	t.Helper()
	if e := InitializeHistory(path, id); e != nil {
		t.Fatal(e)
	}
}
func historyVote(source, target, slot uint64, root byte) ctypes.AttestationData {
	return ctypes.AttestationData{Slot: slot, BlockRoot: historyRoot(root), ParentRoot: historyRoot(2), Source: ctypes.Checkpoint{Slot: source, Root: historyRoot(3)}, Target: ctypes.Checkpoint{Slot: target, Root: historyRoot(root)}}
}
func wantHistoryError(t *testing.T, got, want error) {
	t.Helper()
	if !errors.Is(got, want) {
		t.Fatalf("got %v, want %v", got, want)
	}
}

func TestDurableHistoryRestartConflicts(t *testing.T) {
	path, id := historyFixture(t)
	if p, e := OpenProtector(path, id); e == nil {
		p.Close()
		t.Fatal("missing history opened")
	}
	initHistory(t, path, id)
	p := openHistory(t, path, id)
	a, b, incident := historyRoot(4), historyRoot(5), historyRoot(6)
	vote := historyVote(2, 8, 9, 7)
	for _, e := range []error{p.CheckAndRecordProposal(42, 10, a), p.CheckAndRecordRecovery(42, incident, a), p.CheckAndRecordVote(42, vote)} {
		if e != nil {
			t.Fatal(e)
		}
	}
	if e := p.Close(); e != nil {
		t.Fatal(e)
	}
	wantHistoryError(t, p.CheckAndRecordProposal(42, 10, a), ErrHistoryUnavailable)
	p = openHistory(t, path, id)
	for _, e := range []error{p.CheckAndRecordProposal(42, 10, a), p.CheckAndRecordRecovery(42, incident, a), p.CheckAndRecordVote(42, vote)} {
		if e != nil {
			t.Fatal(e)
		}
	}
	wantHistoryError(t, p.CheckAndRecordProposal(42, 10, b), ErrDoubleProposal)
	wantHistoryError(t, p.CheckAndRecordRecovery(42, incident, b), ErrDoubleRecovery)
	wantHistoryError(t, p.CheckAndRecordVote(42, historyVote(2, 8, 10, 8)), ErrDoubleAttestation)
	wantHistoryError(t, p.CheckAndRecordVote(42, historyVote(2, 7, 9, 8)), ErrDoubleAttestation)
	wantHistoryError(t, p.CheckAndRecordVote(42, historyVote(3, 7, 10, 8)), ErrSurroundVote)
	wantHistoryError(t, p.CheckAndRecordVote(42, historyVote(1, 10, 11, 8)), ErrSurroundVote)
	wantHistoryError(t, p.CheckAndRecordAttestation(42, 9, a), ErrInvalidDuty)
	wantHistoryError(t, p.CheckAndRecordProposal(41, 10, a), ErrInvalidDuty)
	wantHistoryError(t, p.CheckAndRecordRecovery(42, ctypes.Root{}, a), ErrInvalidDuty)
	wantHistoryError(t, p.CheckAndRecordVote(42, historyVote(8, 2, 10, 8)), ErrInvalidDuty)
	if e := p.CheckAndRecordVote(42, historyVote(8, 12, 13, 9)); e != nil {
		t.Fatal(e)
	}
}
func TestDurableHistoryExclusiveLockAndIdentity(t *testing.T) {
	path, id := historyFixture(t)
	initHistory(t, path, id)
	p := openHistory(t, path, id)
	if q, e := OpenProtector(path, id); e == nil {
		q.Close()
		t.Fatal("concurrent signer opened")
	}
	if e := InitializeHistory(path, id); e == nil {
		t.Fatal("existing history reset")
	}
	p.Close()
	if e := InitializeHistory(path, id); e == nil {
		t.Fatal("existing history reset after close")
	}
	for _, different := range []HistoryIdentity{
		{ChainID: 421, Genesis: id.Genesis, ValidatorID: id.ValidatorID, PublicKey: id.PublicKey},
		{ChainID: 420, Genesis: historyRoot(2), ValidatorID: id.ValidatorID, PublicKey: id.PublicKey},
		{ChainID: 420, Genesis: id.Genesis, ValidatorID: 43, PublicKey: id.PublicKey},
		{ChainID: 420, Genesis: id.Genesis, ValidatorID: id.ValidatorID, PublicKey: ctypes.BLSPubkey{2}},
	} {
		if q, e := OpenProtector(path, different); e == nil {
			q.Close()
			t.Fatal("wrong identity accepted")
		}
	}
}
func TestDurableHistoryMissingCorruptAndStale(t *testing.T) {
	for _, fault := range []string{"missing", "corrupt", "stale"} {
		t.Run(fault, func(t *testing.T) {
			path, id := historyFixture(t)
			initHistory(t, path, id)
			old, e := os.ReadFile(path)
			if e != nil {
				t.Fatal(e)
			}
			p := openHistory(t, path, id)
			r := historyRoot(4)
			if e = p.CheckAndRecordProposal(42, 10, r); e != nil {
				t.Fatal(e)
			}
			switch fault {
			case "missing":
				e = os.Remove(path)
			case "corrupt":
				e = os.WriteFile(path, []byte("broken"), 0600)
			case "stale":
				e = os.WriteFile(path, old, 0600)
			}
			if e != nil {
				t.Fatal(e)
			}
			wantHistoryError(t, p.CheckAndRecordProposal(42, 10, r), ErrHistoryUnavailable)
			wantHistoryError(t, p.CheckAndRecordProposal(42, 11, r), ErrHistoryUnavailable)
			p.Close()
			// A valid offline rollback cannot be detected by a file checksum alone.
			if fault != "stale" {
				if q, e := OpenProtector(path, id); e == nil {
					q.Close()
					t.Fatal("invalid history reopened")
				}
			}
		})
	}
}
func TestDurableHistoryConcurrentConflicts(t *testing.T) {
	path, id := historyFixture(t)
	initHistory(t, path, id)
	p := openHistory(t, path, id)
	var wg sync.WaitGroup
	results := make(chan error, 16)
	for i := 1; i <= 16; i++ {
		wg.Add(1)
		go func(n byte) { defer wg.Done(); results <- p.CheckAndRecordProposal(42, 100, historyRoot(n)) }(byte(i))
	}
	wg.Wait()
	close(results)
	ok, conflicts := 0, 0
	for e := range results {
		if e == nil {
			ok++
		} else if errors.Is(e, ErrDoubleProposal) {
			conflicts++
		} else {
			t.Fatal(e)
		}
	}
	if ok != 1 || conflicts != 15 {
		t.Fatalf("accepted=%d conflicts=%d", ok, conflicts)
	}
}

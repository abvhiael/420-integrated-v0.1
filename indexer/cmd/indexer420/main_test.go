package main

import (
	"errors"
	"path/filepath"
	"testing"
	"time"

	"github.com/420integrated/420-integrated/consensus/storage"
	ctypes "github.com/420integrated/420-integrated/consensus/types"
	indexerrpc "github.com/420integrated/420-integrated/indexer/rpc"
)

func TestParsePollIntervalDefaults(t *testing.T) {
	got, err := parsePollInterval("")
	if err != nil { t.Fatal(err) }
	if got != 12*time.Second { t.Fatalf("unexpected default %s", got) }
}

func TestParsePollIntervalAcceptsDeploymentValue(t *testing.T) {
	got, err := parsePollInterval("15s")
	if err != nil { t.Fatal(err) }
	if got != 15*time.Second { t.Fatalf("unexpected interval %s", got) }
}

func TestParsePollIntervalRejectsMalformedOrTooFast(t *testing.T) {
	for _, raw := range []string{"banana", "500ms"} {
		if _, err := parsePollInterval(raw); err == nil { t.Fatalf("expected rejection for %q", raw) }
	}
}


func TestNewConsensusProviderRejectsMissingPath(t *testing.T) {
	if _, err := newConsensusProvider(""); err == nil { t.Fatal("expected missing consensus path rejection") }
}

func TestNewConsensusProviderRejectsUnavailableState(t *testing.T) {
	if _, err := newConsensusProvider(filepath.Join(t.TempDir(), "missing-consensus.json")); err == nil {
		t.Fatal("expected unavailable consensus state rejection")
	}
}

func TestNewConsensusProviderAcceptsQualifiedState(t *testing.T) {
	path := filepath.Join(t.TempDir(), "consensus.json")
	store := storage.NewFileStore(path)
	var head, safe, finalized ctypes.Root
	head[31], safe[31], finalized[31] = 3, 2, 1
	seats := make([]uint16, 15)
	for i := range seats { seats[i] = uint16(i) }
	if err := store.Save(storage.Status{
		Head: ctypes.Checkpoint{Slot: 841, Root: head},
		Safe: ctypes.Checkpoint{Slot: 840, Root: safe},
		Finalized: ctypes.Checkpoint{Slot: 839, Root: finalized},
		NextSlot: 842,
		ActiveSeats: seats,
		ScheduledProposer: storage.ProposerStatus{Slot:842, Primary:1, Fallback1:2, Fallback2:3},
		LatestQC: storage.QCStatus{Slot:841, BlockRoot:"0xabc", ParentRoot:"0xdef", Signers:11},
	}); err != nil { t.Fatal(err) }
	p, err := newConsensusProvider(path)
	if err != nil { t.Fatal(err) }
	status, err := p.Consensus()
	if err != nil { t.Fatal(err) }
	if status.ChainID != 420 || status.ActiveValidatorCount != 15 || !status.LatestQC.Certified {
		t.Fatalf("unexpected consensus qualification: %+v", status)
	}
}


func TestParseMaxHeadAgeDefaultsAndValidates(t *testing.T) {
	got,err:=parseMaxHeadAge("")
	if err!=nil { t.Fatal(err) }
	if got!=2*time.Minute { t.Fatalf("unexpected default %s",got) }
	got,err=parseMaxHeadAge("90s")
	if err!=nil || got!=90*time.Second { t.Fatalf("unexpected configured max age %s err=%v",got,err) }
	for _,raw:=range []string{"banana","500ms"} {
		if _,err:=parseMaxHeadAge(raw);err==nil{t.Fatalf("expected max-head-age rejection for %q",raw)}
	}
}

func TestRuntimeRPCIssueClassification(t *testing.T) {
	cases:=[]struct{err error; want string}{
		{indexerrpc.ErrWrongChain,"RPC_WRONG_CHAIN"},
		{indexerrpc.ErrGenesisMismatch,"RPC_GENESIS_MISMATCH"},
		{indexerrpc.ErrFinalityOrdering,"RPC_FINALITY_DIVERGENCE"},
		{indexerrpc.ErrStaleSource,"RPC_SOURCE_STALE"},
		{errors.New("transport unavailable"),"RPC_SOURCE_INVALID"},
	}
	for _,tc:=range cases {
		if got:=runtimeRPCIssue(tc.err);got!=tc.want{t.Fatalf("issue(%v)=%s want %s",tc.err,got,tc.want)}
	}
}

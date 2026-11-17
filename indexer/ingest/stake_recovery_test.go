package ingest

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"reflect"
	"testing"

	"github.com/420integrated/420-integrated/indexer/api"
	"github.com/420integrated/420-integrated/indexer/model"
	indexerrpc "github.com/420integrated/420-integrated/indexer/rpc"
	"github.com/420integrated/420-integrated/indexer/store"
)

func stakeBundle(n uint64, hash, parent string) indexerrpc.Bundle {
	b := bundle(n, hash, parent)
	b.Logs = []model.LogRecord{{ChainID: 420, BlockNumber: n, BlockHash: hash, TransactionHash: "tx-" + hash, LogIndex: 0, Address: api.StakeValidatorRegistryAddress, Topics: []string{"0x937c9d231e224d3713ab9670dfc9ce2004c29f78fd2bb43187fe0b8e748eb97a", "0x00000000000000000000000000000000000000000000000000000000000000aa"}, Data: "0x"}}
	return b
}
func stakeSource() integrationSource {
	return integrationSource{bundles: map[uint64]indexerrpc.Bundle{0: bundle(0, "g", ""), 1: stakeBundle(1, "a1", "g"), 2: stakeBundle(2, "a2", "a1"), 3: stakeBundle(3, "a3", "a2")}, head: 3, safe: 2, finalized: 1}
}
func openStakeStore(t *testing.T, path string) *store.FileStore {
	t.Helper()
	s, err := store.NewFileStore(path)
	if err != nil {
		t.Fatal(err)
	}
	return s
}
func catchStake(t *testing.T, source integrationSource, s *store.FileStore) {
	t.Helper()
	if err := New(420, "420-indexer-v1", source, s).CatchUp(context.Background()); err != nil {
		t.Fatal(err)
	}
}

func TestStakeRestartReplacementMatchesCleanRebuild(t *testing.T) {
	path := filepath.Join(t.TempDir(), "stake.json")
	source := stakeSource()
	s := openStakeStore(t, path)
	catchStake(t, source, s)
	// Equal-height replacement must retract the original lifecycle event.
	source.bundles[3] = stakeBundle(3, "b3", "a2")
	for i := 0; i < 3; i++ {
		s = openStakeStore(t, path)
		catchStake(t, source, s)
	}
	clean := openStakeStore(t, filepath.Join(t.TempDir(), "clean.json"))
	catchStake(t, source, clean)
	got, err := s.LogsByAddresses(api.StakeValidatorRegistryAddress)
	if err != nil {
		t.Fatal(err)
	}
	want, _ := clean.LogsByAddresses(api.StakeValidatorRegistryAddress)
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("recovered Stake history differs: got=%+v want=%+v", got, want)
	}
	if len(got) != 3 || got[0].BlockHash != "b3" {
		t.Fatalf("orphan or duplicate Stake event: %+v", got)
	}
	gotPage, err := api.NewStoreBackend(s, nil).StakeActivity("", "", 50)
	if err != nil {
		t.Fatal(err)
	}
	wantPage, err := api.NewStoreBackend(clean, nil).StakeActivity("", "", 50)
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(gotPage, wantPage) || gotPage.CanonicalAuthority {
		t.Fatal("rebuilt API projection diverged or claimed settlement authority")
	}
	// A failed finalized-history replacement cannot mutate the previous projection.
	before, _ := os.ReadFile(path)
	source.bundles[1] = stakeBundle(1, "evil1", "g")
	source.bundles[2] = stakeBundle(2, "evil2", "evil1")
	source.bundles[3] = stakeBundle(3, "evil3", "evil2")
	if err := New(420, "420-indexer-v1", source, s).CatchUp(context.Background()); err == nil {
		t.Fatal("accepted finalized fork")
	}
	after, _ := os.ReadFile(path)
	if !reflect.DeepEqual(before, after) {
		t.Fatal("rejected finalized fork changed durable state")
	}
}

// Child exits abruptly after persisting a bundle, before its checkpoint. This
// exercises actual process restart and the same production FileStore format.
func TestStakeInterruptedProcess(t *testing.T) {
	if path := os.Getenv("STAKE_INDEXER_CRASH_PATH"); path != "" {
		s := openStakeStore(t, path)
		stale := stakeBundle(2, "orphan2", "a1")
		stale.Logs = append(stale.Logs, stale.Logs[0])
		stale.Logs[1].LogIndex = 1
		if err := s.PutBundle(stale.Block, nil, nil, stale.Logs); err != nil {
			t.Fatal(err)
		}
		os.Exit(23)
	}
	path := filepath.Join(t.TempDir(), "stake.json")
	source := stakeSource()
	source.head = 1
	source.safe = 1
	source.finalized = 0
	s := openStakeStore(t, path)
	catchStake(t, source, s)
	child := exec.Command(os.Args[0], "-test.run=^TestStakeInterruptedProcess$")
	child.Env = append(os.Environ(), "STAKE_INDEXER_CRASH_PATH="+path)
	err := child.Run()
	exit, ok := err.(*exec.ExitError)
	if !ok || exit.ExitCode() != 23 {
		t.Fatalf("unexpected child termination: %v", err)
	}
	s = openStakeStore(t, path)
	cp, _, _ := s.Checkpoint()
	if cp.IndexedHeight != 1 {
		t.Fatal("interrupted ingestion advanced checkpoint")
	}
	source.head = 3
	source.safe = 2
	source.finalized = 1
	for i := 0; i < 3; i++ {
		s = openStakeStore(t, path)
		catchStake(t, source, s)
	}
	logs, _ := s.LogsByBlock(2)
	if len(logs) != 1 || logs[0].BlockHash != "a2" {
		t.Fatalf("orphan logs survived retry: %+v", logs)
	}
}

func TestStakeFinalityRegressionAndReorgDepth(t *testing.T) {
	s := openStakeStore(t, filepath.Join(t.TempDir(), "stake.json"))
	source := stakeSource()
	catchStake(t, source, s)
	source.finalized = 0
	if err := New(420, "v1", source, s).CatchUp(context.Background()); err == nil {
		t.Fatal("accepted finality regression")
	}
	source = stakeSource()
	source.head = 66
	source.safe = 1
	for n := uint64(4); n <= 66; n++ {
		source.bundles[n] = bundle(n, fmt.Sprintf("a%d", n), source.bundles[n-1].Block.Hash)
	}
	catchStake(t, source, s)
	for n := uint64(2); n <= 66; n++ {
		source.bundles[n] = bundle(n, fmt.Sprintf("b%d", n), source.bundles[n-1].Block.Hash)
	}
	before, _, _ := s.Checkpoint()
	if err := New(420, "v1", source, s).CatchUp(context.Background()); err == nil {
		t.Fatal("accepted reorg deeper than 64 blocks")
	}
	after, _, _ := s.Checkpoint()
	if before != after {
		t.Fatal("deep fork mutated checkpoint")
	}
}

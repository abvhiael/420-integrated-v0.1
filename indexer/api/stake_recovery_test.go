package api

import (
	"github.com/420integrated/420-integrated/indexer/model"
	"github.com/420integrated/420-integrated/indexer/store"
	"path/filepath"
	"strings"
	"testing"
)

func TestStakeRecoveryKeepsEventContractProvenance(t *testing.T) {
	s, err := store.NewFileStore(filepath.Join(t.TempDir(), "stake.json"))
	if err != nil {
		t.Fatal(err)
	}
	// A valid RewardApplied topic emitted at the registry is not a reward event.
	putStakeBundle420(t, s, 1, "a1", model.FinalityHead, model.LogRecord{TransactionHash: "tx1", Address: StakeValidatorRegistryAddress, Topics: []string{"0xae18fd01a17597538ecc00e53160b731f191d8172d52086d7ad0ca16a76816ef", testValidatorID, indexedAddressTopic420(testOwner)}})
	if err := s.SaveCheckpoint(model.ChainCheckpoint{ChainID: 420, IndexedHeight: 1, IndexedHash: "a1"}); err != nil {
		t.Fatal(err)
	}
	page, err := NewStoreBackend(s, nil).StakeActivity("", "", 20)
	if err != nil {
		t.Fatal(err)
	}
	if len(page.Records) != 0 || page.CanonicalAuthority {
		t.Fatal("substituted contract contributed lifecycle evidence")
	}
	if indexedAddress("0x"+strings.Repeat("1", 24)+strings.TrimPrefix(testOwner, "0x")) != "" {
		t.Fatal("accepted malformed indexed address padding")
	}
}

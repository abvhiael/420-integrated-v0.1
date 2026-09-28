package service

import (
	"context"
	"testing"
	"time"

	indexerapi "github.com/420integrated/420-integrated/indexer/api"
	"github.com/420integrated/420-integrated/indexer/model"
)

func TestAddressViewRejectsLimitAboveContractMaximum(t *testing.T) {
	addr := "0x1111111111111111111111111111111111111111"
	idx := &addressCapableFake{fakeIndexer: &fakeIndexer{}, page: indexerapi.AddressTransactionPage{
		Address: addr, Meta: indexerapi.PageMeta{ChainID: 420},
	}}
	svc, _ := New(idx, 420, time.Minute)
	if _, err := svc.Address(context.Background(), addr, 251); err == nil {
		t.Fatal("expected address history limit rejection")
	}
}

func TestAddressViewRejectsCanonicalAuthorityClaim(t *testing.T) {
	addr := "0x1111111111111111111111111111111111111111"
	idx := &addressCapableFake{fakeIndexer: &fakeIndexer{}, page: indexerapi.AddressTransactionPage{
		Address: addr, Meta: indexerapi.PageMeta{ChainID: 420}, CanonicalAuthority: true,
	}}
	svc, _ := New(idx, 420, time.Minute)
	if _, err := svc.Address(context.Background(), addr, 50); err == nil {
		t.Fatal("expected canonical-authority claim rejection")
	}
}

func TestAddressViewRejectsWrongChainAndUnrelatedTransaction(t *testing.T) {
	addr := "0x1111111111111111111111111111111111111111"
	idx := &addressCapableFake{fakeIndexer: &fakeIndexer{}, page: indexerapi.AddressTransactionPage{
		Address: addr,
		Meta: indexerapi.PageMeta{ChainID: 420, SnapshotHeight: 12},
		Transactions: []model.TransactionRecord{{
			ChainID: 420, BlockNumber: 12, Hash: "0xtx",
			From: "0x2222222222222222222222222222222222222222",
			To:   "0x3333333333333333333333333333333333333333",
		}},
	}}
	svc, _ := New(idx, 420, time.Minute)
	if _, err := svc.Address(context.Background(), addr, 50); err == nil {
		t.Fatal("expected unrelated transaction rejection")
	}
	idx.page.Transactions = nil
	idx.page.Meta.ChainID = 1
	if _, err := svc.Address(context.Background(), addr, 50); err == nil {
		t.Fatal("expected wrong-chain page rejection")
	}
}

func TestAssetActivityRejectsHiddenFilterAndAuthorityClaims(t *testing.T) {
	idx := &assetCapableFake{fakeIndexer: &fakeIndexer{}, page: indexerapi.AssetTransferPage{
		Meta: indexerapi.PageMeta{ChainID: 420, SnapshotHeight: 12},
		AssetKey: "erc20:0x1111111111111111111111111111111111111111",
	}}
	svc, _ := New(idx, 420, time.Minute)
	if _, err := svc.AssetActivity(context.Background(), "", "", 50); err == nil {
		t.Fatal("expected hidden asset filter rejection")
	}
	idx.page.AssetKey = ""
	idx.page.CanonicalAuthority = true
	if _, err := svc.AssetActivity(context.Background(), "", "", 50); err == nil {
		t.Fatal("expected canonical-authority claim rejection")
	}
}

func TestAssetActivityRejectsInvalidAmountAndLimit(t *testing.T) {
	idx := &assetCapableFake{fakeIndexer: &fakeIndexer{}, page: indexerapi.AssetTransferPage{
		Meta: indexerapi.PageMeta{ChainID: 420, SnapshotHeight: 12},
		Transfers: []model.AssetTransferRecord{{
			ChainID: 420, BlockNumber: 12, TransactionHash: "0xtx", LogIndex: -1,
			AssetKey: "native:420", AssetKind: "native", Amount: "-1",
		}},
	}}
	svc, _ := New(idx, 420, time.Minute)
	if _, err := svc.AssetActivity(context.Background(), "", "", 50); err == nil {
		t.Fatal("expected negative amount rejection")
	}
	if _, err := svc.AssetActivity(context.Background(), "", "", 251); err == nil {
		t.Fatal("expected asset activity limit rejection")
	}
}

func TestContractDetailRejectsMalformedRuntimeCodeAndIncompleteProvenance(t *testing.T) {
	addr := "0x1111111111111111111111111111111111111111"
	idx := contractFakeIndexer{fakeIndexer: &fakeIndexer{}, contract: model.ContractRecord{
		ChainID: 420, Address: addr, DeploymentTxHash: "0xtx", DeploymentHash: "0xblock",
		RuntimeCode: "0xabc",
	}}
	svc, _ := New(idx, 420, time.Minute)
	if _, err := svc.ContractDetail(context.Background(), addr); err == nil {
		t.Fatal("expected malformed runtime code rejection")
	}
	idx.contract.RuntimeCode = "0x6000"
	idx.contract.DeploymentTxHash = ""
	if _, err := svc.ContractDetail(context.Background(), addr); err == nil {
		t.Fatal("expected incomplete deployment provenance rejection")
	}
}

func TestContractDetailRejectsWrongChain(t *testing.T) {
	addr := "0x1111111111111111111111111111111111111111"
	idx := contractFakeIndexer{fakeIndexer: &fakeIndexer{}, contract: model.ContractRecord{
		ChainID: 1, Address: addr, DeploymentTxHash: "0xtx", DeploymentHash: "0xblock", RuntimeCode: "0x6000",
	}}
	svc, _ := New(idx, 420, time.Minute)
	if _, err := svc.ContractDetail(context.Background(), addr); err == nil {
		t.Fatal("expected wrong-chain contract rejection")
	}
}

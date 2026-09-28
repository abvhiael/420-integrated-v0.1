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

func TestEXP23ContractDeploymentCrossViewProvenance(t *testing.T) {
	addr := "0x1111111111111111111111111111111111111111"
	idx := contractFakeIndexer{
		fakeIndexer: &fakeIndexer{
			tx: model.TransactionRecord{ChainID: 420, BlockNumber: 7, BlockHash: "0xblock", Hash: "0xtx", Index: 1, From: "0x2222222222222222222222222222222222222222"},
			receipt: model.ReceiptRecord{ChainID: 420, BlockNumber: 7, BlockHash: "0xblock", TransactionHash: "0xtx", TransactionIndex: 1, Status: 1, GasUsed: 1, EffectiveGasPriceWei: "1", ActualFeeWei: "1", ContractAddress: addr},
			block: model.BlockRecord{ChainID: 420, Number: 7, Hash: "0xblock", Finality: model.FinalityFinalized},
		},
		contract: model.ContractRecord{ChainID: 420, Address: addr, DeploymentTxHash: "0xtx", DeploymentBlock: 7, DeploymentHash: "0xblock", RuntimeCode: "0x6000", CodeHash: "0xcode"},
	}
	svc, _ := New(idx, 420, time.Minute)
	txView, err := svc.TransactionDetail(context.Background(), "0xtx")
	if err != nil { t.Fatal(err) }
	contractView, err := svc.ContractDetail(context.Background(), addr)
	if err != nil { t.Fatal(err) }
	if txView.Receipt.ContractAddress != contractView.Contract.Address ||
		txView.Transaction.Hash != contractView.Contract.DeploymentTxHash ||
		txView.Transaction.BlockNumber != contractView.Contract.DeploymentBlock ||
		txView.Transaction.BlockHash != contractView.Contract.DeploymentHash {
		t.Fatalf("deployment provenance does not cross-link: tx=%+v contract=%+v", txView, contractView)
	}
}

func TestEXP23AssetKindsPreserveTokenIdentity(t *testing.T) {
	addr := "0x1111111111111111111111111111111111111111"
	contract := "0x2222222222222222222222222222222222222222"
	kinds := []model.AssetTransferRecord{
		{ChainID: 420, BlockNumber: 12, TransactionHash: "0x20", LogIndex: 0, AssetKey: "erc20:" + contract, AssetKind: "erc20", ContractAddress: contract, From: addr, Amount: "420"},
		{ChainID: 420, BlockNumber: 12, TransactionHash: "0x721", LogIndex: 1, AssetKey: "erc721:" + contract + ":7", AssetKind: "erc721", ContractAddress: contract, TokenID: "7", From: addr, Amount: "1"},
		{ChainID: 420, BlockNumber: 12, TransactionHash: "0x1155", LogIndex: 2, AssetKey: "erc1155:" + contract + ":9", AssetKind: "erc1155", ContractAddress: contract, TokenID: "9", From: addr, Amount: "42"},
	}
	for _, transfer := range kinds {
		idx := &assetCapableFake{fakeIndexer: &fakeIndexer{}, page: indexerapi.AssetTransferPage{
			Meta: indexerapi.PageMeta{ChainID: 420, SnapshotHeight: 12},
			AssetKey: transfer.AssetKey,
			Address: addr,
			Transfers: []model.AssetTransferRecord{transfer},
		}}
		svc, _ := New(idx, 420, time.Minute)
		view, err := svc.AssetActivity(context.Background(), transfer.AssetKey, addr, 50)
		if err != nil { t.Fatalf("%s: %v", transfer.AssetKind, err) }
		if len(view.Transfers) != 1 || view.Transfers[0].AssetKind != transfer.AssetKind ||
			view.Transfers[0].TokenID != transfer.TokenID || view.Transfers[0].ContractAddress != transfer.ContractAddress {
			t.Fatalf("%s identity lost: %+v", transfer.AssetKind, view.Transfers)
		}
	}
}

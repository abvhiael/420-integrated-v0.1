package service

import (
	"context"
	"errors"
	"testing"
	"time"

	indexerapi "github.com/420integrated/420-integrated/indexer/api"
	"github.com/420integrated/420-integrated/indexer/model"
)

type addressCapableFake struct {
	*fakeIndexer
	page indexerapi.AddressTransactionPage
}

func (f *addressCapableFake) AddressTransactions(context.Context, string, uint32) (indexerapi.AddressTransactionPage, error) {
	return f.page, nil
}

func TestAddressViewValidatesSnapshotAndMembership(t *testing.T) {
	addr := "0x1111111111111111111111111111111111111111"
	idx := &addressCapableFake{
		fakeIndexer: &fakeIndexer{},
		page: indexerapi.AddressTransactionPage{
			Address: addr,
			Meta: indexerapi.PageMeta{ChainID: 420, SnapshotHeight: 12, SnapshotHash: "0x12"},
			Transactions: []model.TransactionRecord{{ChainID: 420, BlockNumber: 12, Hash: "0xtx", From: addr, To: "0x2222222222222222222222222222222222222222"}},
		},
	}
	svc, err := New(idx, 420, time.Minute)
	if err != nil { t.Fatal(err) }
	view, err := svc.Address(context.Background(), addr, 50)
	if err != nil { t.Fatal(err) }
	if view.TxCount != 1 || view.Meta.SnapshotHeight != 12 { t.Fatalf("unexpected address view: %+v", view) }

	idx.page.Transactions[0].BlockNumber = 13
	if _, err := svc.Address(context.Background(), addr, 50); err == nil { t.Fatal("expected beyond-snapshot transaction rejection") }
}

func TestAddressViewRejectsInvalidAddress(t *testing.T) {
	svc, _ := New(&fakeIndexer{}, 420, time.Minute)
	if _, err := svc.Address(context.Background(), "0xnope", 50); !errors.Is(err, ErrInvalidAddress) {
		t.Fatalf("expected invalid address error, got %v", err)
	}
}

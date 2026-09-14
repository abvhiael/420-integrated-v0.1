package service

import (
	"context"
	"testing"
	"time"

	indexerapi "github.com/420integrated/420-integrated/indexer/api"
	"github.com/420integrated/420-integrated/indexer/model"
)

func TestTransactionDetailIncludesReceiptLogsAndFinality(t *testing.T) {
	idx := &fakeIndexer{
		health: indexerapi.HealthResponse{Health: model.Health{ChainID: 420, State: "READY", LastIngestAt: time.Now()}},
		tx: model.TransactionRecord{ChainID: 420, BlockNumber: 9, BlockHash: "0xblock", Hash: "0xtx", Index: 2, From: "0xfrom", To: "0xto"},
		receipt: model.ReceiptRecord{ChainID: 420, BlockNumber: 9, BlockHash: "0xblock", TransactionHash: "0xtx", TransactionIndex: 2, Status: 1, GasUsed: 42000},
		block: model.BlockRecord{ChainID: 420, Number: 9, Hash: "0xblock", Finality: model.FinalitySafe},
		logs: []model.LogRecord{
			{ChainID: 420, BlockNumber: 9, BlockHash: "0xblock", TransactionHash: "0xtx", TransactionIndex: 2, LogIndex: 0, Address: "0xcontract"},
			{ChainID: 420, BlockNumber: 9, BlockHash: "0xblock", TransactionHash: "0xother", TransactionIndex: 3, LogIndex: 1},
		},
	}
	svc, _ := New(idx, 420, time.Minute)
	detail, err := svc.TransactionDetail(context.Background(), "0xtx")
	if err != nil { t.Fatal(err) }
	if detail.Transaction.Hash != "0xtx" || detail.Receipt.StatusLabel != "SUCCESS" { t.Fatalf("unexpected detail: %+v", detail) }
	if detail.Finality != model.FinalitySafe { t.Fatalf("finality=%s", detail.Finality) }
	if detail.LogCount != 1 || len(detail.Logs) != 1 || detail.Logs[0].Address != "0xcontract" { t.Fatalf("unexpected logs: %+v", detail.Logs) }
}

func TestTransactionDetailLabelsRevertedReceipt(t *testing.T) {
	idx := &fakeIndexer{
		tx: model.TransactionRecord{ChainID: 420, BlockNumber: 1, BlockHash: "0xb", Hash: "0xt", Index: 0},
		receipt: model.ReceiptRecord{ChainID: 420, BlockNumber: 1, BlockHash: "0xb", TransactionHash: "0xt", TransactionIndex: 0, Status: 0},
		block: model.BlockRecord{ChainID: 420, Number: 1, Hash: "0xb", Finality: model.FinalityFinalized},
	}
	svc, _ := New(idx, 420, time.Minute)
	detail, err := svc.TransactionDetail(context.Background(), "0xt")
	if err != nil { t.Fatal(err) }
	if detail.Receipt.StatusLabel != "REVERTED" { t.Fatalf("status label=%s", detail.Receipt.StatusLabel) }
}

func TestTransactionDetailRejectsReceiptIndexMismatch(t *testing.T) {
	idx := &fakeIndexer{
		tx: model.TransactionRecord{ChainID: 420, BlockNumber: 5, BlockHash: "0xb", Hash: "0xt", Index: 1},
		receipt: model.ReceiptRecord{ChainID: 420, BlockNumber: 5, BlockHash: "0xb", TransactionHash: "0xt", TransactionIndex: 2},
	}
	svc, _ := New(idx, 420, time.Minute)
	if _, err := svc.TransactionDetail(context.Background(), "0xt"); err == nil { t.Fatal("expected receipt index mismatch to fail closed") }
}

func TestTransactionDetailRejectsBlockMismatch(t *testing.T) {
	idx := &fakeIndexer{
		tx: model.TransactionRecord{ChainID: 420, BlockNumber: 5, BlockHash: "0xb", Hash: "0xt", Index: 1},
		receipt: model.ReceiptRecord{ChainID: 420, BlockNumber: 5, BlockHash: "0xb", TransactionHash: "0xt", TransactionIndex: 1},
		block: model.BlockRecord{ChainID: 420, Number: 5, Hash: "0xother"},
	}
	svc, _ := New(idx, 420, time.Minute)
	if _, err := svc.TransactionDetail(context.Background(), "0xt"); err == nil { t.Fatal("expected block provenance mismatch to fail closed") }
}

func TestTransactionDetailRejectsLogProvenanceMismatch(t *testing.T) {
	idx := &fakeIndexer{
		tx: model.TransactionRecord{ChainID: 420, BlockNumber: 5, BlockHash: "0xb", Hash: "0xt", Index: 1},
		receipt: model.ReceiptRecord{ChainID: 420, BlockNumber: 5, BlockHash: "0xb", TransactionHash: "0xt", TransactionIndex: 1},
		block: model.BlockRecord{ChainID: 420, Number: 5, Hash: "0xb"},
		logs: []model.LogRecord{{ChainID: 420, BlockNumber: 5, BlockHash: "0xb", TransactionHash: "0xt", TransactionIndex: 9}},
	}
	svc, _ := New(idx, 420, time.Minute)
	if _, err := svc.TransactionDetail(context.Background(), "0xt"); err == nil { t.Fatal("expected log provenance mismatch to fail closed") }
}

func TestReceiptDetailMirrorsTransactionDetail(t *testing.T) {
	idx := &fakeIndexer{
		tx: model.TransactionRecord{ChainID: 420, BlockNumber: 2, BlockHash: "0xb", Hash: "0xt", Index: 0},
		receipt: model.ReceiptRecord{ChainID: 420, BlockNumber: 2, BlockHash: "0xb", TransactionHash: "0xt", TransactionIndex: 0, Status: 1},
		block: model.BlockRecord{ChainID: 420, Number: 2, Hash: "0xb", Finality: model.FinalityHead},
	}
	svc, _ := New(idx, 420, time.Minute)
	detail, err := svc.ReceiptDetail(context.Background(), "0xt")
	if err != nil { t.Fatal(err) }
	if detail.Receipt.TransactionHash != "0xt" || detail.Transaction.Hash != "0xt" || detail.Finality != model.FinalityHead { t.Fatalf("unexpected receipt detail: %+v", detail) }
}

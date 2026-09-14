package service

import (
	"context"
	"errors"
	"strings"

	"github.com/420integrated/420-integrated/indexer/model"
)

// TransactionSummary is the stable Explorer presentation model for a
// transaction. Every field is sourced from 420Indexer canonical projections.
type TransactionSummary struct {
	ChainID     uint64 `json:"chainId"`
	BlockNumber uint64 `json:"blockNumber"`
	BlockHash   string `json:"blockHash"`
	Hash        string `json:"hash"`
	Index       uint64 `json:"index"`
	From        string `json:"from"`
	To          string `json:"to,omitempty"`
}

// ReceiptSummary exposes indexed execution outcome data without treating the
// Explorer or Indexer projection as settlement authority.
type ReceiptSummary struct {
	ChainID          uint64 `json:"chainId"`
	BlockNumber      uint64 `json:"blockNumber"`
	BlockHash        string `json:"blockHash"`
	TransactionHash  string `json:"transactionHash"`
	TransactionIndex uint64 `json:"transactionIndex"`
	Status           uint64 `json:"status"`
	StatusLabel      string `json:"statusLabel"`
	GasUsed          uint64 `json:"gasUsed"`
	ContractAddress  string `json:"contractAddress,omitempty"`
}

// TransactionDetailView combines the transaction, execution receipt and only
// those logs whose provenance matches the transaction. Finality is inherited
// from the indexed block containing the transaction.
type TransactionDetailView struct {
	Transaction TransactionSummary `json:"transaction"`
	Receipt     ReceiptSummary     `json:"receipt"`
	Logs        []model.LogRecord  `json:"logs"`
	LogCount    int                `json:"logCount"`
	Finality    model.Finality     `json:"finality"`
}

// ReceiptDetailView is a receipt-first representation for clients that begin
// from a receipt lookup while retaining the associated transaction and logs.
type ReceiptDetailView struct {
	Receipt     ReceiptSummary     `json:"receipt"`
	Transaction TransactionSummary `json:"transaction"`
	Logs        []model.LogRecord  `json:"logs"`
	LogCount    int                `json:"logCount"`
	Finality    model.Finality     `json:"finality"`
}

func transactionSummary(tx model.TransactionRecord) TransactionSummary {
	return TransactionSummary{
		ChainID:     tx.ChainID,
		BlockNumber: tx.BlockNumber,
		BlockHash:   tx.BlockHash,
		Hash:        tx.Hash,
		Index:       tx.Index,
		From:        tx.From,
		To:          tx.To,
	}
}

func receiptSummary(receipt model.ReceiptRecord) ReceiptSummary {
	label := "UNKNOWN"
	switch receipt.Status {
	case 0:
		label = "REVERTED"
	case 1:
		label = "SUCCESS"
	}
	return ReceiptSummary{
		ChainID:          receipt.ChainID,
		BlockNumber:      receipt.BlockNumber,
		BlockHash:        receipt.BlockHash,
		TransactionHash:  receipt.TransactionHash,
		TransactionIndex: receipt.TransactionIndex,
		Status:           receipt.Status,
		StatusLabel:      label,
		GasUsed:          receipt.GasUsed,
		ContractAddress:  receipt.ContractAddress,
	}
}

// TransactionDetail composes an Explorer transaction resource exclusively
// from shared 420Indexer reads and fails closed on inconsistent provenance.
func (s *Service) TransactionDetail(ctx context.Context, hash string) (TransactionDetailView, error) {
	base, err := s.Transaction(ctx, hash)
	if err != nil {
		return TransactionDetailView{}, err
	}
	tx := base.Transaction
	receipt := base.Receipt
	if tx.Hash == "" || tx.BlockHash == "" {
		return TransactionDetailView{}, errors.New("420Indexer returned transaction without canonical provenance")
	}
	if receipt.TransactionIndex != tx.Index {
		return TransactionDetailView{}, errors.New("420Indexer returned receipt index inconsistent with transaction")
	}

	block, err := s.indexer.Block(ctx, tx.BlockNumber)
	if err != nil {
		return TransactionDetailView{}, err
	}
	if err := s.requireRecordChain(block.ChainID); err != nil {
		return TransactionDetailView{}, err
	}
	if block.Hash != tx.BlockHash {
		return TransactionDetailView{}, errors.New("420Indexer returned transaction block provenance inconsistent with block")
	}

	blockLogs, err := s.indexer.BlockLogs(ctx, tx.BlockNumber)
	if err != nil {
		return TransactionDetailView{}, err
	}
	logs := make([]model.LogRecord, 0)
	for _, log := range blockLogs {
		if !strings.EqualFold(log.TransactionHash, tx.Hash) {
			continue
		}
		if err := s.requireRecordChain(log.ChainID); err != nil {
			return TransactionDetailView{}, err
		}
		if log.BlockNumber != tx.BlockNumber || log.BlockHash != tx.BlockHash || log.TransactionIndex != tx.Index {
			return TransactionDetailView{}, errors.New("420Indexer returned transaction log provenance inconsistent with transaction")
		}
		logs = append(logs, log)
	}

	return TransactionDetailView{
		Transaction: transactionSummary(tx),
		Receipt:     receiptSummary(receipt),
		Logs:        logs,
		LogCount:    len(logs),
		Finality:    block.Finality,
	}, nil
}

func (s *Service) ReceiptDetail(ctx context.Context, hash string) (ReceiptDetailView, error) {
	detail, err := s.TransactionDetail(ctx, hash)
	if err != nil {
		return ReceiptDetailView{}, err
	}
	return ReceiptDetailView{
		Receipt:     detail.Receipt,
		Transaction: detail.Transaction,
		Logs:        detail.Logs,
		LogCount:    detail.LogCount,
		Finality:    detail.Finality,
	}, nil
}

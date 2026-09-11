package reorg

import (
	"context"
	"strings"

	"github.com/420integrated/420-integrated/indexer/model"
)

type contractRecordSource interface {
	ContractRecordAt(context.Context, uint64, string, string, uint64, string, string) (model.ContractRecord, error)
}

type contractRecordStore interface {
	PutContract(model.ContractRecord) error
}

func (e *Engine) replayContracts(ctx context.Context, block model.BlockRecord, receipts []model.ReceiptRecord) error {
	source, sourceOK := e.source.(contractRecordSource)
	store, storeOK := e.store.(contractRecordStore)
	if !sourceOK || !storeOK { return nil }
	for _, receipt := range receipts {
		address := strings.TrimSpace(receipt.ContractAddress)
		if address == "" || receipt.Status != 1 { continue }
		record, err := source.ContractRecordAt(ctx, e.chainID, address, receipt.TransactionHash, block.Number, block.Hash, e.schemaVersion)
		if err != nil { return err }
		if err := store.PutContract(record); err != nil { return err }
	}
	return nil
}

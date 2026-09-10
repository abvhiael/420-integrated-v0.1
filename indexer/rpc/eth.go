package rpc

import (
	"context"
	"fmt"

	"github.com/420integrated/420-integrated/indexer/model"
)

type rpcBlock struct {
	Number       string           `json:"number"`
	Hash         string           `json:"hash"`
	ParentHash   string           `json:"parentHash"`
	Timestamp    string           `json:"timestamp"`
	Transactions []rpcTransaction `json:"transactions"`
}

type rpcTransaction struct {
	Hash             string `json:"hash"`
	TransactionIndex string `json:"transactionIndex"`
	From             string `json:"from"`
	To               string `json:"to"`
}

type rpcReceipt struct {
	TransactionHash  string   `json:"transactionHash"`
	TransactionIndex string   `json:"transactionIndex"`
	BlockHash        string   `json:"blockHash"`
	BlockNumber      string   `json:"blockNumber"`
	Status           string   `json:"status"`
	GasUsed          string   `json:"gasUsed"`
	ContractAddress  string   `json:"contractAddress"`
	Logs             []rpcLog `json:"logs"`
}

type rpcLog struct {
	Address          string   `json:"address"`
	Topics           []string `json:"topics"`
	Data             string   `json:"data"`
	BlockNumber      string   `json:"blockNumber"`
	BlockHash        string   `json:"blockHash"`
	TransactionHash  string   `json:"transactionHash"`
	TransactionIndex string   `json:"transactionIndex"`
	LogIndex         string   `json:"logIndex"`
}

type Bundle struct {
	Block        model.BlockRecord
	Transactions []model.TransactionRecord
	Receipts     []model.ReceiptRecord
	Logs         []model.LogRecord
}

func (c *Client) BundleByNumber(ctx context.Context, chainID uint64, number uint64, finality model.Finality, schemaVersion string) (Bundle, error) {
	var raw rpcBlock
	if err := c.call(ctx, "eth_getBlockByNumber", []interface{}{fmt.Sprintf("0x%x", number), true}, &raw); err != nil { return Bundle{}, err }
	if raw.Hash == "" { return Bundle{}, fmt.Errorf("block %d unavailable", number) }
	rn, err := parseHexUint64(raw.Number); if err != nil { return Bundle{}, err }
	ts, err := parseHexUint64(raw.Timestamp); if err != nil { return Bundle{}, err }
	bundle := Bundle{Block: model.BlockRecord{ChainID: chainID, Number: rn, Hash: raw.Hash, ParentHash: raw.ParentHash, Timestamp: ts, Finality: finality, SchemaVersion: schemaVersion}}
	for _, tx := range raw.Transactions {
		ti, err := parseHexUint64(tx.TransactionIndex); if err != nil { return Bundle{}, err }
		bundle.Transactions = append(bundle.Transactions, model.TransactionRecord{ChainID: chainID, BlockNumber: rn, BlockHash: raw.Hash, Hash: tx.Hash, Index: ti, From: tx.From, To: tx.To})
		var receipt rpcReceipt
		if err := c.call(ctx, "eth_getTransactionReceipt", []interface{}{tx.Hash}, &receipt); err != nil { return Bundle{}, err }
		bi, err := parseHexUint64(receipt.BlockNumber); if err != nil { return Bundle{}, err }
		ri, err := parseHexUint64(receipt.TransactionIndex); if err != nil { return Bundle{}, err }
		status, err := parseHexUint64(receipt.Status); if err != nil { return Bundle{}, err }
		gas, err := parseHexUint64(receipt.GasUsed); if err != nil { return Bundle{}, err }
		bundle.Receipts = append(bundle.Receipts, model.ReceiptRecord{ChainID: chainID, BlockNumber: bi, BlockHash: receipt.BlockHash, TransactionHash: receipt.TransactionHash, TransactionIndex: ri, Status: status, GasUsed: gas, ContractAddress: receipt.ContractAddress})
		for _, lg := range receipt.Logs {
			lbn, err := parseHexUint64(lg.BlockNumber); if err != nil { return Bundle{}, err }
			lti, err := parseHexUint64(lg.TransactionIndex); if err != nil { return Bundle{}, err }
			li, err := parseHexUint64(lg.LogIndex); if err != nil { return Bundle{}, err }
			bundle.Logs = append(bundle.Logs, model.LogRecord{ChainID: chainID, BlockNumber: lbn, BlockHash: lg.BlockHash, TransactionHash: lg.TransactionHash, TransactionIndex: lti, LogIndex: li, Address: lg.Address, Topics: lg.Topics, Data: lg.Data})
		}
	}
	return bundle, nil
}

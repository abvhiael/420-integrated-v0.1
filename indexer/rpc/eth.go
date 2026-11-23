package rpc

import (
	"context"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"math/big"
	"strings"

	"github.com/420integrated/420-integrated/indexer/model"
)

type rpcBlock struct {
	ExtraData    string           `json:"extraData"`
	Number       string           `json:"number"`
	Hash         string           `json:"hash"`
	ParentHash   string           `json:"parentHash"`
	Timestamp    string           `json:"timestamp"`
	Transactions []json.RawMessage `json:"transactions"`
}

type rpcTransaction struct {
	Hash             string `json:"hash"`
	BlockHash        string `json:"blockHash"`
	BlockNumber      string `json:"blockNumber"`
	TransactionIndex string `json:"transactionIndex"`
	From             string `json:"from"`
	To               string `json:"to"`
	Value            string `json:"value"`
	Input            string `json:"input"`
}

type rpcReceipt struct {
	TransactionHash   string   `json:"transactionHash"`
	TransactionIndex  string   `json:"transactionIndex"`
	BlockHash         string   `json:"blockHash"`
	BlockNumber       string   `json:"blockNumber"`
	Status            string   `json:"status"`
	GasUsed           string   `json:"gasUsed"`
	EffectiveGasPrice string   `json:"effectiveGasPrice"`
	ContractAddress   string   `json:"contractAddress"`
	Logs              []rpcLog `json:"logs"`
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

func hexQuantityDecimal(v string) (string, error) {
	v = strings.TrimPrefix(strings.ToLower(v), "0x")
	if v == "" {
		return "0", nil
	}
	n, ok := new(big.Int).SetString(v, 16)
	if !ok {
		return "", fmt.Errorf("invalid hex quantity")
	}
	return n.String(), nil
}

func receiptFeeWei(gasUsed uint64, effectiveGasPrice string) (string, string, error) {
	if strings.TrimSpace(effectiveGasPrice) == "" {
		return "", "", fmt.Errorf("receipt effectiveGasPrice missing")
	}
	priceWei, err := hexQuantityDecimal(effectiveGasPrice)
	if err != nil {
		return "", "", fmt.Errorf("invalid receipt effectiveGasPrice: %w", err)
	}
	price, ok := new(big.Int).SetString(priceWei, 10)
	if !ok || price.Sign() < 0 {
		return "", "", fmt.Errorf("invalid receipt effectiveGasPrice")
	}
	fee := new(big.Int).Mul(new(big.Int).SetUint64(gasUsed), price)
	return priceWei, fee.String(), nil
}

func (c *Client) BundleByNumber(ctx context.Context, chainID uint64, number uint64, finality model.Finality, schemaVersion string) (Bundle, error) {
	var raw rpcBlock
	if err := c.executionCall(ctx, "eth_getBlockByNumber", []interface{}{fmt.Sprintf("0x%x", number), true}, &raw); err != nil {
		return Bundle{}, err
	}
	if raw.Hash == "" {
		return Bundle{}, fmt.Errorf("block %d unavailable", number)
	}
	rn, err := parseHexUint64(raw.Number)
	if err != nil {
		return Bundle{}, err
	}
	if rn != number {
		return Bundle{}, fmt.Errorf("requested block height mismatch")
	}
	ts, err := parseHexUint64(raw.Timestamp)
	if err != nil {
		return Bundle{}, err
	}
	bundle := Bundle{Block: model.BlockRecord{ChainID: chainID, Number: rn, Hash: raw.Hash, ParentHash: raw.ParentHash, Timestamp: ts, Finality: finality, SchemaVersion: schemaVersion}}
	for position, wire := range raw.Transactions {
		var tx rpcTransaction
		if len(wire) == 0 {
			return Bundle{}, fmt.Errorf("block %d contains empty transaction", number)
		}
		if wire[0] == '"' {
			// Some authenticated Engine implementations return transaction hashes
			// even when eth_getBlockByNumber(..., true) requests expanded objects.
			// Resolve that hash through the SAME authenticated execution endpoint;
			// do not treat missing or conflicting payloads as canonical records.
			var txHash string
			if err := json.Unmarshal(wire, &txHash); err != nil {
				return Bundle{}, fmt.Errorf("decode block transaction hash: %w", err)
			}
			if len(txHash) != 66 || !strings.HasPrefix(txHash, "0x") {
				return Bundle{}, fmt.Errorf("invalid block transaction hash at index %d", position)
			}
			if _, err := hex.DecodeString(txHash[2:]); err != nil {
				return Bundle{}, fmt.Errorf("invalid block transaction hash hex: %w", err)
			}
			if err := c.executionCall(ctx, "eth_getTransactionByHash", []interface{}{txHash}, &tx); err != nil {
				return Bundle{}, fmt.Errorf("fetch canonical transaction %s: %w", txHash, err)
			}
			if !strings.EqualFold(tx.Hash, txHash) {
				return Bundle{}, fmt.Errorf("transaction hash lookup disagrees with block listing")
			}
		} else if wire[0] == '{' {
			if err := json.Unmarshal(wire, &tx); err != nil {
				return Bundle{}, fmt.Errorf("decode expanded block transaction: %w", err)
			}
		} else {
			return Bundle{}, fmt.Errorf("unrecognized block transaction wire type")
		}
		if tx.Hash == "" || tx.From == "" || tx.TransactionIndex == "" {
			return Bundle{}, fmt.Errorf("missing required transaction identity")
		}
		if tx.BlockHash != "" && !strings.EqualFold(tx.BlockHash, raw.Hash) {
			return Bundle{}, fmt.Errorf("transaction lookup has wrong canonical block hash")
		}
		if tx.BlockNumber != "" {
			blockHeight, err := parseHexUint64(tx.BlockNumber)
			if err != nil || blockHeight != rn {
				return Bundle{}, fmt.Errorf("transaction lookup has wrong canonical height")
			}
		}
		ti, err := parseHexUint64(tx.TransactionIndex)
		if err != nil {
			return Bundle{}, err
		}
		if ti != uint64(position) {
			return Bundle{}, fmt.Errorf("transaction index does not match block ordering")
		}
		valueWei, err := hexQuantityDecimal(tx.Value)
		if err != nil {
			return Bundle{}, err
		}
		bundle.Transactions = append(bundle.Transactions, model.TransactionRecord{ChainID: chainID, BlockNumber: rn, BlockHash: raw.Hash, Hash: tx.Hash, Index: ti, From: tx.From, To: tx.To, ValueWei: valueWei, Input: tx.Input})
		var receipt rpcReceipt
		if err := c.executionCall(ctx, "eth_getTransactionReceipt", []interface{}{tx.Hash}, &receipt); err != nil {
			return Bundle{}, err
		}
		bi, err := parseHexUint64(receipt.BlockNumber)
		if err != nil {
			return Bundle{}, err
		}
		ri, err := parseHexUint64(receipt.TransactionIndex)
		if err != nil {
			return Bundle{}, err
		}
		if bi != rn || receipt.BlockHash != raw.Hash || receipt.TransactionHash != tx.Hash || ri != ti {
			return Bundle{}, fmt.Errorf("receipt provenance mismatch")
		}
		status, err := parseHexUint64(receipt.Status)
		if err != nil {
			return Bundle{}, err
		}
		gas, err := parseHexUint64(receipt.GasUsed)
		if err != nil {
			return Bundle{}, err
		}
		effectiveGasPriceWei, actualFeeWei, err := receiptFeeWei(gas, receipt.EffectiveGasPrice)
		if err != nil {
			return Bundle{}, err
		}
		bundle.Receipts = append(bundle.Receipts, model.ReceiptRecord{ChainID: chainID, BlockNumber: bi, BlockHash: receipt.BlockHash, TransactionHash: receipt.TransactionHash, TransactionIndex: ri, Status: status, GasUsed: gas, EffectiveGasPriceWei: effectiveGasPriceWei, ActualFeeWei: actualFeeWei, ContractAddress: receipt.ContractAddress})
		for _, lg := range receipt.Logs {
			lbn, err := parseHexUint64(lg.BlockNumber)
			if err != nil {
				return Bundle{}, err
			}
			lti, err := parseHexUint64(lg.TransactionIndex)
			if err != nil {
				return Bundle{}, err
			}
			li, err := parseHexUint64(lg.LogIndex)
			if err != nil {
				return Bundle{}, err
			}
			if lbn != rn || lg.BlockHash != raw.Hash || lg.TransactionHash != tx.Hash || lti != ti {
				return Bundle{}, fmt.Errorf("receipt log provenance mismatch")
			}
			bundle.Logs = append(bundle.Logs, model.LogRecord{ChainID: chainID, BlockNumber: lbn, BlockHash: lg.BlockHash, TransactionHash: lg.TransactionHash, TransactionIndex: lti, LogIndex: li, Address: lg.Address, Topics: lg.Topics, Data: lg.Data})
		}
	}
	if err := c.appendNativeLogs(ctx, raw, &bundle); err != nil {
		return Bundle{}, err
	}
	return bundle, nil
}

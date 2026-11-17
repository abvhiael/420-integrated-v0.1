package rpc

import (
	"context"
	"fmt"
	eng "github.com/420integrated/420-integrated/consensus/engine"
	"github.com/420integrated/420-integrated/indexer/model"
)

// WithNativeLogs pairs ordinary RPC ingestion with the authenticated native
// archive. All bundle headers and ordinary receipts then use the same
// authenticated endpoint; public RPC cannot forge accounting event evidence.
// Native calls have no ordinary transaction receipt.
func (c *Client) WithNativeLogs(native *eng.Client) *Client { c.native = native; return c }
func (c *Client) appendNativeLogs(ctx context.Context, raw rpcBlock, bundle *Bundle) error {
	if c.native == nil || bundle.Block.Number == 0 {
		return nil
	}
	logs, err := c.native.CanonicalNativeLogs(ctx, bundle.Block.Number, eng.Hash32(raw.Hash), eng.Hash32(raw.ExtraData))
	if err != nil {
		return err
	}
	for _, log := range logs {
		index, err := parseHexUint64(log.LogIndex)
		if err != nil {
			return err
		}
		txIndex, err := parseHexUint64(log.TransactionIndex)
		if err != nil {
			return err
		}
		bundle.Logs = append(bundle.Logs, model.LogRecord{ChainID: bundle.Block.ChainID, BlockNumber: bundle.Block.Number, BlockHash: raw.Hash, TransactionHash: log.TransactionHash, TransactionIndex: txIndex, LogIndex: index, Address: log.Address, Topics: log.Topics, Data: log.Data, DecoderVersion: "native-systemcall-v1"})
	}
	// Detect a reorganization during the paired reads.
	var head rpcBlock
	if err = c.executionCall(ctx, "eth_getBlockByNumber", []any{raw.Number, false}, &head); err != nil {
		return err
	}
	if head.Hash != raw.Hash {
		return fmt.Errorf("canonical native ingestion changed")
	}
	return nil
}

func (c *Client) executionCall(ctx context.Context, method string, params any, result any) error {
	if c.native != nil {
		return c.native.Call(ctx, method, params, result)
	}
	return c.call(ctx, method, params, result)
}

package rpc

import (
	"context"
	"fmt"

	"github.com/420integrated/420-integrated/indexer/model"
)

type rpcHeader struct {
	Number     string `json:"number"`
	Hash       string `json:"hash"`
	ParentHash string `json:"parentHash"`
	Timestamp  string `json:"timestamp"`
}

// BlockByTag reads a canonical execution-layer block tag such as safe or finalized.
// It intentionally requests headers only; transaction data remains on the normal ingest path.
func (c *Client) BlockByTag(ctx context.Context, chainID uint64, tag string, finality model.Finality, schemaVersion string) (model.BlockRecord, error) {
	var raw rpcHeader
	if err := c.call(ctx, "eth_getBlockByNumber", []interface{}{tag, false}, &raw); err != nil { return model.BlockRecord{}, err }
	if raw.Hash == "" { return model.BlockRecord{}, fmt.Errorf("block tag %s unavailable", tag) }
	n, err := parseHexUint64(raw.Number); if err != nil { return model.BlockRecord{}, err }
	ts, err := parseHexUint64(raw.Timestamp); if err != nil { return model.BlockRecord{}, err }
	return model.BlockRecord{
		ChainID: chainID, Number: n, Hash: raw.Hash, ParentHash: raw.ParentHash,
		Timestamp: ts, Finality: finality, SchemaVersion: schemaVersion,
	}, nil
}

func (c *Client) SafeBlock(ctx context.Context, chainID uint64, schemaVersion string) (model.BlockRecord, error) {
	return c.BlockByTag(ctx, chainID, "safe", model.FinalitySafe, schemaVersion)
}

func (c *Client) FinalizedBlock(ctx context.Context, chainID uint64, schemaVersion string) (model.BlockRecord, error) {
	return c.BlockByTag(ctx, chainID, "finalized", model.FinalityFinalized, schemaVersion)
}

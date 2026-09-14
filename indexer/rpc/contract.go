package rpc

import (
	"context"
	"fmt"

	"github.com/420integrated/420-integrated/indexer/model"
)

type rpcAccountProof struct {
	CodeHash string `json:"codeHash"`
}

// ContractRecordAt captures runtime code and execution-layer code hash at a
// specific canonical block so the Indexer can persist a rebuildable contract
// projection instead of serving live RPC data to Explorer.
func (c *Client) ContractRecordAt(ctx context.Context, chainID uint64, address, deploymentTxHash string, blockNumber uint64, blockHash, schemaVersion string) (model.ContractRecord, error) {
	blockTag := fmt.Sprintf("0x%x", blockNumber)
	var code string
	if err := c.call(ctx, "eth_getCode", []interface{}{address, blockTag}, &code); err != nil {
		return model.ContractRecord{}, err
	}
	var proof rpcAccountProof
	if err := c.call(ctx, "eth_getProof", []interface{}{address, []string{}, blockTag}, &proof); err != nil {
		return model.ContractRecord{}, err
	}
	return model.ContractRecord{
		ChainID: chainID, Address: address, DeploymentTxHash: deploymentTxHash,
		DeploymentBlock: blockNumber, DeploymentHash: blockHash,
		RuntimeCode: code, CodeHash: proof.CodeHash, SchemaVersion: schemaVersion,
	}, nil
}

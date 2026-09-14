package model

// AssetTransferRecord is a rebuildable projection of native and token value
// movement observed in canonical-source transactions and logs.
type AssetTransferRecord struct {
	ChainID          uint64 `json:"chainId"`
	BlockNumber      uint64 `json:"blockNumber"`
	BlockHash        string `json:"blockHash"`
	TransactionHash  string `json:"transactionHash"`
	TransactionIndex uint64 `json:"transactionIndex"`
	LogIndex         int64  `json:"logIndex"`
	AssetKey         string `json:"assetKey"`
	AssetKind        string `json:"assetKind"`
	ContractAddress  string `json:"contractAddress,omitempty"`
	TokenID          string `json:"tokenId,omitempty"`
	From             string `json:"from"`
	To               string `json:"to"`
	Amount           string `json:"amount"`
}

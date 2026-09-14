package model

// ContractRecord is a rebuildable runtime-code projection captured from the
// canonical execution source at the contract deployment block.
type ContractRecord struct {
	ChainID          uint64 `json:"chainId"`
	Address          string `json:"address"`
	DeploymentTxHash string `json:"deploymentTxHash"`
	DeploymentBlock  uint64 `json:"deploymentBlock"`
	DeploymentHash   string `json:"deploymentHash"`
	RuntimeCode      string `json:"runtimeCode"`
	CodeHash         string `json:"codeHash"`
	SchemaVersion    string `json:"schemaVersion"`
}

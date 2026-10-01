package model

// StakeActivityRecord is a derived, rebuildable projection of canonical
// ValidatorRegistry/RewardController logs. It never becomes staking authority.
type StakeActivityRecord struct {
	ChainID          uint64   `json:"chainId"`
	BlockNumber      uint64   `json:"blockNumber"`
	BlockHash        string   `json:"blockHash"`
	TransactionHash  string   `json:"transactionHash"`
	TransactionIndex uint64   `json:"transactionIndex"`
	LogIndex         uint64   `json:"logIndex"`
	ContractAddress  string   `json:"contractAddress"`
	EventName        string   `json:"eventName"`
	ValidatorID      string   `json:"validatorId,omitempty"`
	Addresses        []string `json:"addresses,omitempty"`
	Finality         Finality `json:"finality"`
	Topics           []string `json:"topics"`
	Data             string   `json:"data"`
}

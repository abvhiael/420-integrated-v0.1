package rpc

import "github.com/420integrated/420-integrated/indexer/model"

// Source defines the canonical JSON-RPC capabilities required by 420Indexer.
// Concrete transports may use HTTP, WebSocket, local IPC, or another node420-compatible channel.
type Source interface {
	ChainID() (uint64, error)
	BlockByNumber(number uint64) (model.BlockRecord, error)
	Head() (model.BlockRecord, error)
	Safe() (model.BlockRecord, error)
	Finalized() (model.BlockRecord, error)
}

// Validation captures source consistency without granting the source authority over indexed state.
type Validation struct {
	RequiredChainID uint64 `json:"requiredChainId"`
	ObservedChainID uint64 `json:"observedChainId"`
	HeadHeight      uint64 `json:"headHeight"`
	SafeHeight      uint64 `json:"safeHeight"`
	FinalizedHeight uint64 `json:"finalizedHeight"`
	Healthy         bool   `json:"healthy"`
}

func Validate(source Source, requiredChainID uint64) (Validation, error) {
	chainID, err := source.ChainID()
	if err != nil { return Validation{}, err }
	v := Validation{RequiredChainID: requiredChainID, ObservedChainID: chainID}
	if chainID != requiredChainID { return v, nil }
	head, err := source.Head(); if err != nil { return v, err }
	safe, err := source.Safe(); if err != nil { return v, err }
	finalized, err := source.Finalized(); if err != nil { return v, err }
	v.HeadHeight, v.SafeHeight, v.FinalizedHeight = head.Number, safe.Number, finalized.Number
	v.Healthy = finalized.Number <= safe.Number && safe.Number <= head.Number
	return v, nil
}

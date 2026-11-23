package main

import (
	"github.com/420integrated/420-integrated/indexer/consensusview"
	"github.com/420integrated/420-integrated/indexer/model"
	"os"
)

type runtimeConsensusProvider interface {
	ValidateIngestion() error
	Consensus() (model.ConsensusStatus, error)
	ProducerForBlock(string) (model.BlockProducer, bool, error)
}

func newRuntimeConsensusProvider(status string) (runtimeConsensusProvider, error) {
	dir, trust, pin := os.Getenv("INDEXER_CERTIFIED_DIR"), os.Getenv("INDEXER_SETTLEMENT_TRUST"), os.Getenv("INDEXER_SETTLEMENT_TRUST_SHA256")
	if dir != "" || trust != "" || pin != "" {
		return consensusview.NewCertified(dir, trust, pin, status)
	}
	return newConsensusProvider(status)
}

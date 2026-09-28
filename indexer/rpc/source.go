package rpc

import (
	"errors"
	"fmt"
	"time"

	"github.com/420integrated/420-integrated/indexer/model"
)

var (
	ErrWrongChain       = errors.New("rpc source is on the wrong chain")
	ErrGenesisMismatch  = errors.New("rpc source genesis block mismatch")
	ErrFinalityOrdering = errors.New("rpc source finality ordering invalid")
	ErrStaleSource      = errors.New("rpc source head is stale")
	ErrSourceIdentity   = errors.New("rpc source identity inconsistent")
)

type Source interface {
	ChainID() (uint64, error)
	BlockByNumber(number uint64) (model.BlockRecord, error)
	Head() (model.BlockRecord, error)
	Safe() (model.BlockRecord, error)
	Finalized() (model.BlockRecord, error)
}

type Requirements struct {
	RequiredChainID     uint64
	ExpectedGenesisHash string
	MaxHeadAge          time.Duration
	Now                 time.Time
}

type Validation struct {
	RequiredChainID     uint64
	ObservedChainID     uint64
	ExpectedGenesisHash string
	ObservedGenesisHash string
	HeadHeight          uint64
	SafeHeight          uint64
	FinalizedHeight     uint64
	HeadHash            string
	SafeHash            string
	FinalizedHash       string
	HeadTimestamp       uint64
	Healthy             bool
}

func Validate(source Source, req Requirements) (Validation, error) {
	if req.RequiredChainID == 0 {
		return Validation{}, fmt.Errorf("%w: required chain id is zero", ErrSourceIdentity)
	}
	chainID, err := source.ChainID()
	if err != nil {
		return Validation{}, fmt.Errorf("%w: chain id: %v", ErrSourceIdentity, err)
	}
	v := Validation{RequiredChainID: req.RequiredChainID, ObservedChainID: chainID, ExpectedGenesisHash: req.ExpectedGenesisHash}
	if chainID != req.RequiredChainID {
		return v, fmt.Errorf("%w: required=%d observed=%d", ErrWrongChain, req.RequiredChainID, chainID)
	}

	genesis, err := source.BlockByNumber(0)
	if err != nil {
		return v, fmt.Errorf("%w: genesis block: %v", ErrSourceIdentity, err)
	}
	v.ObservedGenesisHash = genesis.Hash
	if genesis.ChainID != 0 && genesis.ChainID != req.RequiredChainID {
		return v, fmt.Errorf("%w: genesis chain=%d required=%d", ErrSourceIdentity, genesis.ChainID, req.RequiredChainID)
	}
	if genesis.Number != 0 || genesis.Hash == "" {
		return v, fmt.Errorf("%w: invalid genesis record", ErrSourceIdentity)
	}
	if req.ExpectedGenesisHash != "" && genesis.Hash != req.ExpectedGenesisHash {
		return v, fmt.Errorf("%w: expected=%s observed=%s", ErrGenesisMismatch, req.ExpectedGenesisHash, genesis.Hash)
	}

	head, err := source.Head()
	if err != nil { return v, fmt.Errorf("%w: head: %v", ErrSourceIdentity, err) }
	safe, err := source.Safe()
	if err != nil { return v, fmt.Errorf("%w: safe: %v", ErrSourceIdentity, err) }
	finalized, err := source.Finalized()
	if err != nil { return v, fmt.Errorf("%w: finalized: %v", ErrSourceIdentity, err) }

	for name, block := range map[string]model.BlockRecord{"head": head, "safe": safe, "finalized": finalized} {
		if block.ChainID != 0 && block.ChainID != req.RequiredChainID {
			return v, fmt.Errorf("%w: %s chain=%d required=%d", ErrSourceIdentity, name, block.ChainID, req.RequiredChainID)
		}
		if block.Hash == "" {
			return v, fmt.Errorf("%w: %s hash missing", ErrSourceIdentity, name)
		}
	}

	v.HeadHeight, v.SafeHeight, v.FinalizedHeight = head.Number, safe.Number, finalized.Number
	v.HeadHash, v.SafeHash, v.FinalizedHash = head.Hash, safe.Hash, finalized.Hash
	v.HeadTimestamp = head.Timestamp
	if !(finalized.Number <= safe.Number && safe.Number <= head.Number) {
		return v, fmt.Errorf("%w: finalized=%d safe=%d head=%d", ErrFinalityOrdering, finalized.Number, safe.Number, head.Number)
	}

	if req.MaxHeadAge > 0 {
		now := req.Now
		if now.IsZero() { now = time.Now().UTC() }
		if head.Timestamp == 0 || time.Unix(int64(head.Timestamp), 0).Before(now.Add(-req.MaxHeadAge)) {
			return v, fmt.Errorf("%w: timestamp=%d maxAge=%s", ErrStaleSource, head.Timestamp, req.MaxHeadAge)
		}
	}

	v.Healthy = true
	return v, nil
}

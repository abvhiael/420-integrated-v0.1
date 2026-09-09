package model

import "time"

// Finality identifies the indexer's view of a block relative to chain finality.
type Finality string

const (
	FinalityHead      Finality = "HEAD"
	FinalitySafe      Finality = "SAFE"
	FinalityFinalized Finality = "FINALIZED"
)

// ChainCheckpoint is the persisted ingestion boundary used for deterministic resume.
type ChainCheckpoint struct {
	ChainID         uint64    `json:"chainId"`
	IndexedHeight   uint64    `json:"indexedHeight"`
	IndexedHash     string    `json:"indexedHash"`
	SafeHeight      uint64    `json:"safeHeight"`
	SafeHash        string    `json:"safeHash"`
	FinalizedHeight uint64    `json:"finalizedHeight"`
	FinalizedHash   string    `json:"finalizedHash"`
	SchemaVersion   string    `json:"schemaVersion"`
	UpdatedAt       time.Time `json:"updatedAt"`
}

// BlockRecord is a canonical-source block record. Derived projections must retain a reference to it.
type BlockRecord struct {
	ChainID      uint64   `json:"chainId"`
	Number       uint64   `json:"number"`
	Hash         string   `json:"hash"`
	ParentHash   string   `json:"parentHash"`
	Timestamp    uint64   `json:"timestamp"`
	Finality     Finality `json:"finality"`
	SchemaVersion string  `json:"schemaVersion"`
}

// TransactionRecord preserves transaction provenance.
type TransactionRecord struct {
	ChainID    uint64 `json:"chainId"`
	BlockNumber uint64 `json:"blockNumber"`
	BlockHash  string `json:"blockHash"`
	Hash       string `json:"hash"`
	Index      uint64 `json:"index"`
	From       string `json:"from"`
	To         string `json:"to,omitempty"`
}

// LogRecord preserves the complete chain/log location required for deterministic identity.
type LogRecord struct {
	ChainID          uint64   `json:"chainId"`
	BlockNumber      uint64   `json:"blockNumber"`
	BlockHash        string   `json:"blockHash"`
	TransactionHash  string   `json:"transactionHash"`
	TransactionIndex uint64   `json:"transactionIndex"`
	LogIndex         uint64   `json:"logIndex"`
	Address          string   `json:"address"`
	Topics           []string `json:"topics"`
	Data             string   `json:"data"`
	DecoderVersion   string   `json:"decoderVersion,omitempty"`
}

// Health is intentionally descriptive only; it never represents canonical chain state.
type Health struct {
	ChainID         uint64    `json:"chainId"`
	IndexedHeight   uint64    `json:"indexedHeight"`
	SafeHeight      uint64    `json:"safeHeight"`
	FinalizedHeight uint64    `json:"finalizedHeight"`
	SchemaVersion   string    `json:"schemaVersion"`
	DecoderSet      string    `json:"decoderSet"`
	State           string    `json:"state"`
	LastIngestAt    time.Time `json:"lastIngestAt"`
}

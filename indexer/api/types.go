package api

import "github.com/420integrated/420-integrated/indexer/model"

// PageMeta makes snapshot/finality provenance explicit for every paginated downstream read.
type PageMeta struct {
	ChainID         uint64 `json:"chainId"`
	SnapshotHeight  uint64 `json:"snapshotHeight"`
	SnapshotHash    string `json:"snapshotHash"`
	SafeHeight      uint64 `json:"safeHeight"`
	FinalizedHeight uint64 `json:"finalizedHeight"`
	SchemaVersion   string `json:"schemaVersion"`
	NextCursor      string `json:"nextCursor,omitempty"`
}

type BlockPage struct {
	Meta   PageMeta            `json:"meta"`
	Blocks []model.BlockRecord `json:"blocks"`
}

type HealthResponse struct {
	Health model.Health `json:"health"`
	CanonicalAuthority bool `json:"canonicalAuthority"`
}

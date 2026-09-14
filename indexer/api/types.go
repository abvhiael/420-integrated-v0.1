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

type AssetTransferPage struct {
	Meta               PageMeta                    `json:"meta"`
	AssetKey           string                      `json:"assetKey,omitempty"`
	Address            string                      `json:"address,omitempty"`
	Transfers          []model.AssetTransferRecord `json:"transfers"`
	CanonicalAuthority bool                        `json:"canonicalAuthority"`
}

type HealthResponse struct {
	Health model.Health `json:"health"`
	CanonicalAuthority bool `json:"canonicalAuthority"`
}

// ReadResponse wraps single-record and bounded collection reads with an explicit authority marker.
type ReadResponse[T any] struct {
	Data               T    `json:"data"`
	CanonicalAuthority bool `json:"canonicalAuthority"`
}

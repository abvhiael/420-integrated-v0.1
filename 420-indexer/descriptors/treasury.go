// Package descriptors embeds the same artifact-verified Treasury ABI manifest
// consumed by the TypeScript Indexer. No deployment addresses are embedded.
package descriptors

import _ "embed"

//go:embed treasury420-v1.json
var TreasuryV1 string

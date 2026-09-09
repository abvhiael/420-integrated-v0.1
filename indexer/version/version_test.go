package version

import "testing"

func TestSchemaPinned(t *testing.T) {
	if Schema != "420-indexer-v1" { t.Fatalf("unexpected schema %s", Schema) }
}

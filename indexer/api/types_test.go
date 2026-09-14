package api

import (
	"testing"

	"github.com/420integrated/420-integrated/indexer/model"
)

func TestHealthResponseNeverClaimsCanonicalAuthority(t *testing.T) {
	r := HealthResponse{Health: model.Health{ChainID: 420}, CanonicalAuthority: false}
	if r.CanonicalAuthority { t.Fatal("indexer API must remain non-authoritative") }
}

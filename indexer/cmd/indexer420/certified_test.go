package main

import (
	"testing"
)

func TestPartialCertifiedConfigurationCannotFallBackToLegacy(t *testing.T) {
	for _, key := range []string{"INDEXER_CERTIFIED_DIR", "INDEXER_SETTLEMENT_TRUST", "INDEXER_SETTLEMENT_TRUST_SHA256"} {
		t.Run(key, func(t *testing.T) {
			for _, k := range []string{"INDEXER_CERTIFIED_DIR", "INDEXER_SETTLEMENT_TRUST", "INDEXER_SETTLEMENT_TRUST_SHA256"} {
				t.Setenv(k, "")
			}
			t.Setenv(key, "partial")
			if _, err := newRuntimeConsensusProvider(""); err == nil {
				t.Fatal("partial certified configuration silently fell back")
			}
		})
	}
}

package runtime

import (
	"testing"
	"time"
)

func TestConfigRejectsSSRFTargets(t *testing.T) {
	for _, raw := range []string{
		"http://127.0.0.1:8420",
		"http://10.0.0.8",
		"http://169.254.169.254/latest/meta-data",
		"http://localhost:8420",
		"https://user:pass@indexer.example",
	} {
		cfg := testConfig()
		cfg.IndexerURL = raw
		if err := cfg.Validate(); err == nil { t.Fatalf("expected SSRF target rejection for %q", raw) }
	}
}

func TestHTTPIndexerProbeRejectsUnsafeBaseURL(t *testing.T) {
	if _, err := NewHTTPIndexerProbe("http://127.0.0.1:8420", time.Second); err == nil { t.Fatal("loopback probe URL accepted") }
}

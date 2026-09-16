package methodology

import (
	"testing"

	"github.com/420integrated/420-integrated/analytics/model"
)

func TestRegistryIsDeterministicAndCompleteForGenesisMetrics(t *testing.T) {
	entries := Entries()
	if len(entries) != 18 {
		t.Fatalf("expected 18 registered methodologies, got %d", len(entries))
	}
	for i, entry := range entries {
		if entry.MetricID == "" || entry.Methodology.ID == "" || entry.Methodology.Version == "" || entry.Methodology.Description == "" {
			t.Fatalf("entry %d incomplete: %+v", i, entry)
		}
		if i > 0 && entries[i-1].MetricID >= entry.MetricID {
			t.Fatalf("entries are not strictly sorted: %q then %q", entries[i-1].MetricID, entry.MetricID)
		}
		resolved, err := Resolve(entry.MetricID)
		if err != nil {
			t.Fatalf("resolve %s: %v", entry.MetricID, err)
		}
		if resolved != entry.Methodology {
			t.Fatalf("resolved methodology mismatch for %s", entry.MetricID)
		}
	}
}

func TestResolveRejectsUnknownMetric(t *testing.T) {
	if _, err := Resolve("forecast.not_registered"); err == nil {
		t.Fatal("expected unknown methodology to fail closed")
	}
}

func TestValidateRejectsMethodologyDrift(t *testing.T) {
	method, err := Resolve("network.indexed_height")
	if err != nil {
		t.Fatal(err)
	}
	if err := Validate("network.indexed_height", method); err != nil {
		t.Fatalf("registered methodology rejected: %v", err)
	}
	method.Description = "changed without version bump"
	if err := Validate("network.indexed_height", method); err == nil {
		t.Fatal("expected methodology drift to be rejected")
	}
	if err := Validate("network.indexed_height", model.Methodology{ID: "indexed-height", Version: "v2", Description: "new"}); err == nil {
		t.Fatal("expected unregistered methodology version to be rejected")
	}
}

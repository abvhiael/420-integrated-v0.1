package main

import (
	"testing"
	"time"
)

func TestParsePollIntervalDefaults(t *testing.T) {
	got, err := parsePollInterval("")
	if err != nil { t.Fatal(err) }
	if got != 12*time.Second { t.Fatalf("unexpected default %s", got) }
}

func TestParsePollIntervalAcceptsDeploymentValue(t *testing.T) {
	got, err := parsePollInterval("15s")
	if err != nil { t.Fatal(err) }
	if got != 15*time.Second { t.Fatalf("unexpected interval %s", got) }
}

func TestParsePollIntervalRejectsMalformedOrTooFast(t *testing.T) {
	for _, raw := range []string{"banana", "500ms"} {
		if _, err := parsePollInterval(raw); err == nil { t.Fatalf("expected rejection for %q", raw) }
	}
}

package hardening

import (
	"errors"
	"strings"
	"testing"
	"time"
)

func TestValidateMetadataRejectsPrivateFields(t *testing.T) {
	for _, key := range []string{"privateIdentity", "encrypted_message", "rawAttentionTelemetry", "install_history", "launchHistory", "private_key"} {
		err := ValidateMetadata(Metadata{Presentation: map[string]string{key: "secret"}})
		if !errors.Is(err, ErrPrivateData) { t.Fatalf("key %q: got %v want ErrPrivateData", key, err) }
	}
}

func TestValidateMetadataEnforcesGenesisBounds(t *testing.T) {
	if err := ValidateMetadata(Metadata{Description: strings.Repeat("x", MaxDescriptionBytes+1)}); !errors.Is(err, ErrOversizedMetadata) {
		t.Fatalf("oversized description: %v", err)
	}
	shots := make([]string, MaxScreenshots+1)
	for i := range shots { shots[i] = "https://cdn.example.test/shot.png" }
	if err := ValidateMetadata(Metadata{Screenshots: shots}); !errors.Is(err, ErrOversizedMetadata) {
		t.Fatalf("oversized screenshot list: %v", err)
	}
}

func TestValidatePublicURLRejectsHostileSchemesAndLocalTargets(t *testing.T) {
	bad := []string{
		"javascript:alert(1)",
		"http://example.test/app",
		"https://localhost/admin",
		"https://127.0.0.1/internal",
		"https://service.local/private",
		"https://user:pass@example.test/app",
	}
	for _, raw := range bad {
		if err := ValidatePublicURL(raw); !errors.Is(err, ErrUnsafeURL) { t.Fatalf("%q accepted: %v", raw, err) }
	}
	if err := ValidatePublicURL("https://example.test/app"); err != nil { t.Fatalf("public https rejected: %v", err) }
}

func TestAssessDependenciesBlocksCanonicalClaimsWithoutRegistryOrRPC(t *testing.T) {
	got := AssessDependencies(Dependencies{Registry: false, RPC: true, Search: true, Verify: true, Store: true})
	if got.Mode != ModeBlocked || got.CanServeCanonical || !got.CanBrowse { t.Fatalf("unexpected assessment: %#v", got) }
	if !strings.Contains(got.Disclaimer, "must not present stale") { t.Fatalf("missing stale-state warning: %q", got.Disclaimer) }
}

func TestAssessDependenciesDegradesOptionalServices(t *testing.T) {
	got := AssessDependencies(Dependencies{Registry: true, RPC: true, Search: false, Verify: false, Store: true})
	if got.Mode != ModeDegraded || !got.CanServeCanonical || got.CanVerify || !got.CanBrowse { t.Fatalf("unexpected assessment: %#v", got) }
	if len(got.Unavailable) != 2 || got.Unavailable[0] != "search" || got.Unavailable[1] != "verify" { t.Fatalf("unexpected unavailable list: %v", got.Unavailable) }
}

func TestLimiterDoesNotRequireWalletIdentity(t *testing.T) {
	l := NewLimiter(2, time.Minute)
	now := time.Unix(100, 0)
	if !l.Allow("198.51.100.7", now) || !l.Allow("198.51.100.7", now.Add(time.Second)) { t.Fatal("expected first two requests") }
	if l.Allow("198.51.100.7", now.Add(2*time.Second)) { t.Fatal("expected limit") }
	if !l.Allow("198.51.100.7", now.Add(61*time.Second)) { t.Fatal("expected reset") }
	if l.Allow("", now) { t.Fatal("empty abuse-control key must fail closed") }
}

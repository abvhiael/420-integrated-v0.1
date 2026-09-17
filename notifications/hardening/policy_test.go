package hardening

import "testing"

func TestDeliveryEndpointKeyIsOpaqueAndDeterministic(t *testing.T) {
	key1, err := DeliveryEndpointKey("GENESIS-PUSH", "wallet:0xabc|token:secret-device-token")
	if err != nil { t.Fatal(err) }
	key2, err := DeliveryEndpointKey("genesis-push", "wallet:0xabc|token:secret-device-token")
	if err != nil { t.Fatal(err) }
	if key1 != key2 { t.Fatal("expected deterministic normalized provider key") }
	if key1 == "" || key1 == "genesis-push:wallet:0xabc|token:secret-device-token" { t.Fatal("endpoint key must be opaque") }
}

func TestValidateSourceRejectsPrivateClasses(t *testing.T) {
	blocked := []string{
		"420/service/messenger/private/thread/1",
		"420/service/commons/private/group/1",
		"420/service/resource/encrypted/object/1",
		"420/service/identity/private/profile",
		"420/service/attention/raw/session",
	}
	for _, source := range blocked {
		if err := ValidateSource(source); err == nil { t.Fatalf("expected private source rejection: %s", source) }
	}
	if err := ValidateSource("420/service/pay/v1"); err != nil { t.Fatal(err) }
}

func TestSanitizeMetadataRejectsHostilePresentationData(t *testing.T) {
	if _, err := SanitizeMetadata("ok\nspoof", 64); err == nil { t.Fatal("expected control-character rejection") }
	if _, err := SanitizeMetadata("012345", 5); err == nil { t.Fatal("expected oversized metadata rejection") }
	if got, err := SanitizeMetadata("  invoice paid  ", 64); err != nil || got != "invoice paid" { t.Fatalf("sanitize=%q err=%v", got, err) }
}

func TestDegradedModeNeverClaimsCanonicalAuthority(t *testing.T) {
	for _, tc := range []struct{ provider, indexer bool }{{true,true},{false,true},{true,false},{false,false}} {
		h := EvaluateHealth(tc.provider, tc.indexer)
		if h.Canonical { t.Fatal("notification health must never be canonical") }
		want := ModeNormal
		if !tc.provider || !tc.indexer { want = ModeDegraded }
		if h.Mode != want { t.Fatalf("mode=%s want=%s", h.Mode, want) }
	}
}

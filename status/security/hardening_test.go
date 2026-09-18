package security

import (
	"net"
	"strings"
	"testing"

	"github.com/420integrated/420-integrated/status/evidence"
)

func TestValidateProbeURLRejectsPrivateAndCredentialedTargets(t *testing.T) {
	bad := []string{
		"http://127.0.0.1:8420",
		"http://10.0.0.4/status",
		"http://169.254.169.254/latest/meta-data",
		"http://localhost:8420",
		"https://user:pass@example.com",
		"file:///etc/passwd",
	}
	for _, raw := range bad {
		if err := ValidateProbeURL(raw); err == nil { t.Fatalf("expected probe target rejection for %q", raw) }
	}
	if err := ValidateProbeURL("https://indexer.example"); err != nil { t.Fatalf("public probe target rejected: %v", err) }
}

func TestPublicIPRejectsSpecialPurposeAddresses(t *testing.T) {
	for _, raw := range []string{"127.0.0.1", "10.0.0.1", "169.254.1.2", "::1", "fe80::1"} {
		if PublicIP(net.ParseIP(raw)) { t.Fatalf("expected %s to be rejected", raw) }
	}
	if !PublicIP(net.ParseIP("8.8.8.8")) { t.Fatal("expected public IP to be accepted") }
}

func TestMetadataBoundsFailClosed(t *testing.T) {
	if err := ValidateIdentifier("source id", "probe-a"); err != nil { t.Fatal(err) }
	if err := ValidateIdentifier("source id", "probe a"); err == nil { t.Fatal("spaces must be rejected in source identity") }
	if err := ValidateIdentifier("source id", strings.Repeat("x", MaxIdentifierBytes+1)); err == nil { t.Fatal("oversized source identity accepted") }
	refs := make([]evidence.Reference, MaxReferences+1)
	for i := range refs { refs[i] = evidence.Reference{Kind:"tx", Value:"0x1"} }
	if err := ValidateReferences(refs); err == nil { t.Fatal("oversized reference set accepted") }
	if err := ValidatePublicText("summary", strings.Repeat("x", MaxPublicTextBytes+1)); err == nil { t.Fatal("oversized public text accepted") }
}

package security

import "testing"

func validProvenance() Provenance {
	return Provenance{
		ChainID: "420",
		BlockNumber: "42",
		BlockHash: "0xabc",
		TransactionHash: "0xdef",
		LogIndex: 1,
		SourceID: "420Pay",
		OriginURL: "https://explorer.420/tx/0xdef",
	}
}

func TestValidateProvenanceRequiresCanonicalSourceFields(t *testing.T) {
	p := validProvenance()
	if err := ValidateProvenance(p); err != nil { t.Fatal(err) }

	p.TransactionHash = ""
	if err := ValidateProvenance(p); err == nil { t.Fatal("expected missing transaction hash rejection") }
}

func TestValidateLinkRejectsHostileSchemesAndUserinfo(t *testing.T) {
	bad := []string{
		"javascript:alert(1)",
		"data:text/html,<script>alert(1)</script>",
		"ftp://example.com/file",
		"https://user:pass@example.com/path",
	}
	for _, raw := range bad {
		if _, err := ValidateLink(raw); err == nil { t.Fatalf("expected rejection for %q", raw) }
	}
}

func TestValidateLinkAllowsCanonicalAndAppHandoffs(t *testing.T) {
	good := []string{
		"https://explorer.420/tx/0xabc",
		"wallet420://review?tx=0xabc",
		"420://app/pay/invoice/123",
	}
	for _, raw := range good {
		if _, err := ValidateLink(raw); err != nil { t.Fatalf("%q: %v", raw, err) }
	}
}

func TestHandoffCannotCarryWalletAuthority(t *testing.T) {
	h := Handoff{URL: "wallet420://review?tx=0xabc", RequiresWallet: true}
	if err := ValidateHandoff(h); err != nil { t.Fatal(err) }

	h.CanSign = true
	if err := ValidateHandoff(h); err == nil { t.Fatal("expected signing authority rejection") }
}

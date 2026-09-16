package security

import (
	"errors"
	"testing"
)

func TestBuildPreservesEvidenceProvenanceAndWarnings(t *testing.T) {
	p, err := Build("420/service/example/v1", 2, []Evidence{
		{Kind: KindVerification, Source: "420Verify", Reference: "verify:0xabc", Status: "FULL_MATCH", Severity: SeverityInfo, ObservedAt: 10},
		{Kind: KindAudit, Source: "Independent Auditor", Reference: "audit:sha256:123", Status: "published", Severity: SeverityInfo, ObservedAt: 12},
		{Kind: KindDeprecation, Source: "420Registry", Reference: "registry:block:99", Status: "deprecated", Severity: SeverityWarning, ObservedAt: 20},
		{Kind: KindMalicious, Source: "420Trust", Reference: "trust:case:7", Status: "malicious-behavior-warning", Severity: SeverityCritical, ObservedAt: 21},
	})
	if err != nil { t.Fatal(err) }
	if len(p.Evidence) != 4 { t.Fatalf("expected 4 evidence records, got %d", len(p.Evidence)) }
	if len(p.Warnings) != 2 { t.Fatalf("expected deprecation and malicious warnings, got %d", len(p.Warnings)) }
	if p.Evidence[0].Source != "420Trust" { t.Fatalf("newest evidence should sort first, got %q", p.Evidence[0].Source) }
	if p.Disclaimer == "" { t.Fatal("security disclaimer required") }
}

func TestVerificationCannotClaimSafety(t *testing.T) {
	_, err := Build("420/service/example/v1", 1, []Evidence{{Kind: KindVerification, Source: "420Verify", Reference: "verify:1", Status: "FULL_MATCH safe", Severity: SeverityInfo, ObservedAt: 1}})
	if !errors.Is(err, ErrUnsafeClaim) { t.Fatalf("expected unsafe-claim rejection, got %v", err) }
}

func TestAuditCannotClaimEndorsement(t *testing.T) {
	_, err := Build("420/service/example/v1", 1, []Evidence{{Kind: KindAudit, Source: "auditor", Reference: "audit:1", Status: "endorsed", Severity: SeverityInfo, ObservedAt: 1}})
	if !errors.Is(err, ErrUnsafeClaim) { t.Fatalf("expected endorsement rejection, got %v", err) }
}

func TestEvidenceRequiresSourceReferenceAndTimestamp(t *testing.T) {
	cases := []Evidence{
		{Kind: KindVerification, Reference: "r", Status: "FULL_MATCH", Severity: SeverityInfo, ObservedAt: 1},
		{Kind: KindVerification, Source: "420Verify", Status: "FULL_MATCH", Severity: SeverityInfo, ObservedAt: 1},
		{Kind: KindVerification, Source: "420Verify", Reference: "r", Status: "FULL_MATCH", Severity: SeverityInfo},
	}
	for _, tc := range cases {
		if !errors.Is(Validate(tc), ErrInvalidEvidence) { t.Fatalf("expected invalid evidence for %#v", tc) }
	}
}

func TestMalformedSeverityFailsClosed(t *testing.T) {
	err := Validate(Evidence{Kind: KindTrust, Source: "420Trust", Reference: "trust:1", Status: "signal", Severity: "LOW", ObservedAt: 1})
	if !errors.Is(err, ErrInvalidEvidence) { t.Fatalf("expected invalid severity, got %v", err) }
}

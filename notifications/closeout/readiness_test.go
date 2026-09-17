package closeout

import "testing"

func qualifiedEvidence() Evidence {
	return Evidence{
		InvariantSuitePassed: true,
		ReplayDeterminismPassed: true,
		DeduplicationPassed: true,
		RestartRecoveryPassed: true,
		FailureInjectionPassed: true,
		ProviderIsolationPassed: true,
		PrivacySecurityPassed: true,
		GenesisFrontendPassed: true,
	}
}

func TestGenesisReportValidatesQualifiedEvidence(t *testing.T) {
	r := GenesisReport(qualifiedEvidence())
	if err := r.Validate(); err != nil { t.Fatal(err) }
	if r.Phase != "NOTIFY-10" { t.Fatalf("phase=%q", r.Phase) }
	if len(r.Invariants) != 14 { t.Fatalf("invariants=%d", len(r.Invariants)) }
}

func TestGenesisReportRejectsIncompleteEvidence(t *testing.T) {
	e := qualifiedEvidence()
	e.ProviderIsolationPassed = false
	if err := GenesisReport(e).Validate(); err == nil { t.Fatal("expected incomplete evidence rejection") }
}

func TestGenesisReportRejectsCanonicalAuthorityClaim(t *testing.T) {
	e := qualifiedEvidence()
	e.CanonicalAuthorityClaimed = true
	if err := GenesisReport(e).Validate(); err == nil { t.Fatal("expected canonical authority rejection") }
}

package storage

import (
	"errors"
	"strings"
	"testing"
	"time"
)

func validTestnetEvidenceFixture() ProductionTestnetEvidence {
	checks := make([]ProductionTestnetCheck, 0, len(requiredProductionTestnetChecks))
	for _, name := range requiredProductionTestnetChecks {
		checks = append(checks, ProductionTestnetCheck{Name: name, Passed: true, Evidence: name + "-ok"})
	}
	drills := make([]ProductionTestnetFaultDrill, 0, len(requiredProductionFaultDrills))
	for _, name := range requiredProductionFaultDrills {
		drills = append(drills, ProductionTestnetFaultDrill{Name: name, Recovered: true, RecoveryDuration: time.Minute, Evidence: name + "-ok"})
	}
	return ProductionTestnetEvidence{
		CapturedAt:          time.Date(2026, 9, 16, 18, 0, 0, 0, time.UTC),
		CommitSHA:           strings.Repeat("a", 40),
		ConfigFingerprint:   strings.Repeat("b", 64),
		TopologyFingerprint: strings.Repeat("c", 64),
		APIVersion:          DeveloperAPIVersion,
		TopologySchema:      ProductionConfigSchemaVersion,
		Checks:              checks,
		FaultDrills:         drills,
		SLO: ProductionSLOEvidence{AvailabilityBasisPoints: 9990, IntegrityBasisPoints: 10000, RecoveryDuration: 5 * time.Minute, AvailabilityMet: true, IntegrityMet: true, RecoveryMet: true, Met: true},
		LaunchBlockers: []ProductionLaunchBlocker{{Code: "known_noncritical", Critical: false, Resolved: false, Evidence: "tracked"}},
	}
}

func TestProductionTestnetEvidenceBindsDeploymentAndFingerprint(t *testing.T) {
	evidence, err := BuildProductionTestnetEvidence(validTestnetEvidenceFixture())
	if err != nil { t.Fatal(err) }
	if evidence.Fingerprint == "" { t.Fatal("missing evidence fingerprint") }
	if err := ValidateProductionTestnetEvidence(evidence, evidence.CommitSHA, evidence.ConfigFingerprint, evidence.TopologyFingerprint); err != nil { t.Fatal(err) }

	tampered := evidence
	tampered.Checks[0].Evidence = "tampered"
	if err := ValidateProductionTestnetEvidence(tampered, evidence.CommitSHA, evidence.ConfigFingerprint, evidence.TopologyFingerprint); !errors.Is(err, ErrProductionTestnetEvidence) {
		t.Fatalf("expected tamper rejection, got %v", err)
	}
}

func TestProductionTestnetEvidenceFailsClosedOnMissingRequiredCheck(t *testing.T) {
	fixture := validTestnetEvidenceFixture()
	fixture.Checks = fixture.Checks[:len(fixture.Checks)-1]
	if _, err := BuildProductionTestnetEvidence(fixture); !errors.Is(err, ErrProductionTestnetEvidence) {
		t.Fatalf("expected missing-check rejection, got %v", err)
	}
}

func TestProductionTestnetEvidenceFailsClosedOnCriticalBlocker(t *testing.T) {
	fixture := validTestnetEvidenceFixture()
	fixture.LaunchBlockers = append(fixture.LaunchBlockers, ProductionLaunchBlocker{Code: "integrity_incident", Critical: true, Resolved: false, Evidence: "open incident"})
	if _, err := BuildProductionTestnetEvidence(fixture); !errors.Is(err, ErrProductionTestnetEvidence) {
		t.Fatalf("expected unresolved critical blocker rejection, got %v", err)
	}
}

func TestProductionTestnetEvidenceRequiresPassingSLO(t *testing.T) {
	fixture := validTestnetEvidenceFixture()
	fixture.SLO.Met = false
	if _, err := BuildProductionTestnetEvidence(fixture); !errors.Is(err, ErrProductionTestnetEvidence) {
		t.Fatalf("expected SLO rejection, got %v", err)
	}
}

func TestProductionTestnetEvidenceRejectsDeploymentMismatch(t *testing.T) {
	evidence, err := BuildProductionTestnetEvidence(validTestnetEvidenceFixture())
	if err != nil { t.Fatal(err) }
	if err := ValidateProductionTestnetEvidence(evidence, strings.Repeat("d", 40), evidence.ConfigFingerprint, evidence.TopologyFingerprint); !errors.Is(err, ErrProductionTestnetEvidence) {
		t.Fatalf("expected commit mismatch rejection, got %v", err)
	}
}

package storage

import (
	"testing"
	"time"
)

func TestProductionAlertsCoverServiceCapacityRepairAndIntegrity(t *testing.T) {
	status := ResourceNetworkStatus{
		ProviderID: "provider-a", NodeID: "node-a",
		Services: []ResourceServiceStatus{
			{ServiceID: "store-a", Health: ResourceHealthDegraded, Capabilities: []ResourceCapability{ResourceCapabilityStore}},
			{ServiceID: "gateway-a", Health: ResourceHealthFailed, Capabilities: []ResourceCapability{ResourceCapabilityGateway}},
		},
	}
	alerts, err := EvaluateProductionAlerts([]ResourceNetworkStatus{status}, ProductionOperationalSignals{
		CapacityUsedBasisPoints: 9100,
		RepairBacklog: 120,
		IntegrityFailures: 1,
		AuthorizationFailures: 30,
		RoutingFailures: 20,
	}, DefaultProductionAlertPolicy())
	if err != nil {
		t.Fatal(err)
	}
	codes := make(map[string]ProductionAlertSeverity)
	for _, alert := range alerts {
		codes[alert.Code] = alert.Severity
	}
	for _, code := range []string{"service_degraded", "service_unavailable", "capacity_pressure", "repair_backlog", "integrity_failure", "authorization_failures", "routing_failures"} {
		if _, ok := codes[code]; !ok {
			t.Fatalf("missing alert %s: %#v", code, alerts)
		}
	}
	if codes["integrity_failure"] != ProductionAlertCritical || codes["capacity_pressure"] != ProductionAlertCritical || codes["repair_backlog"] != ProductionAlertCritical {
		t.Fatalf("critical alert severity lost: %#v", codes)
	}
}

func TestProductionAlertsMapEveryResourceCapability(t *testing.T) {
	status := ResourceNetworkStatus{ProviderID: "provider-a", NodeID: "node-a"}
	for _, capability := range []ResourceCapability{ResourceCapabilityStore, ResourceCapabilityRepair, ResourceCapabilityCache, ResourceCapabilityGateway, ResourceCapabilityRelay} {
		status.Services = append(status.Services, ResourceServiceStatus{ServiceID: string(capability) + "-a", Health: ResourceHealthFailed, Capabilities: []ResourceCapability{capability}})
	}
	alerts, err := EvaluateProductionAlerts([]ResourceNetworkStatus{status}, ProductionOperationalSignals{}, DefaultProductionAlertPolicy())
	if err != nil {
		t.Fatal(err)
	}
	seen := make(map[ResourceCapability]bool)
	for _, alert := range alerts {
		if alert.Code == "service_unavailable" {
			seen[alert.Capability] = true
		}
	}
	for _, capability := range []ResourceCapability{ResourceCapabilityStore, ResourceCapabilityRepair, ResourceCapabilityCache, ResourceCapabilityGateway, ResourceCapabilityRelay} {
		if !seen[capability] {
			t.Fatalf("missing unavailable alert for %s", capability)
		}
	}
}

func TestProductionSLOEvidencePassesOnlyWhenAllObjectivesMeet(t *testing.T) {
	policy := ProductionSLOPolicy{MinAvailabilityBasisPoints: 9950, MinIntegrityBasisPoints: 10000, MaxRecoveryDuration: 15 * time.Minute}
	start := time.Date(2026, 9, 16, 12, 0, 0, 0, time.UTC)
	passing, err := EvaluateProductionSLO(ProductionSLOSample{
		WindowStart: start, WindowEnd: start.Add(time.Hour), Requests: 1000, Successful: 997,
		IntegrityChecks: 1000, IntegrityFailures: 0, RecoveryDuration: 10 * time.Minute,
	}, policy)
	if err != nil {
		t.Fatal(err)
	}
	if !passing.Met || passing.AvailabilityBasisPoints != 9970 || passing.IntegrityBasisPoints != 10000 {
		t.Fatalf("unexpected passing evidence: %#v", passing)
	}

	failing, err := EvaluateProductionSLO(ProductionSLOSample{
		WindowStart: start, WindowEnd: start.Add(time.Hour), Requests: 1000, Successful: 994,
		IntegrityChecks: 1000, IntegrityFailures: 1, RecoveryDuration: 16 * time.Minute,
	}, policy)
	if err != nil {
		t.Fatal(err)
	}
	if failing.Met || failing.AvailabilityMet || failing.IntegrityMet || failing.RecoveryMet {
		t.Fatalf("expected all objectives to fail: %#v", failing)
	}
}

func TestProductionSLORejectsInvalidEvidence(t *testing.T) {
	policy := ProductionSLOPolicy{MinAvailabilityBasisPoints: 9950, MinIntegrityBasisPoints: 10000, MaxRecoveryDuration: 15 * time.Minute}
	if _, err := EvaluateProductionSLO(ProductionSLOSample{}, policy); err == nil {
		t.Fatal("expected empty SLO evidence rejection")
	}
}

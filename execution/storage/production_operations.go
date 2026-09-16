package storage

import (
	"errors"
	"sort"
	"strings"
	"time"
)

var ErrProductionOperations = errors.New("production operations evaluation failure")

type ProductionAlertSeverity string

const (
	ProductionAlertWarning  ProductionAlertSeverity = "warning"
	ProductionAlertCritical ProductionAlertSeverity = "critical"
)

type ProductionAlert struct {
	Code       string                  `json:"code"`
	Severity   ProductionAlertSeverity `json:"severity"`
	Capability ResourceCapability      `json:"capability,omitempty"`
	ServiceID  string                  `json:"service_id,omitempty"`
	Value      uint64                  `json:"value,omitempty"`
	Threshold  uint64                  `json:"threshold,omitempty"`
}

type ProductionOperationalSignals struct {
	CapacityUsedBasisPoints uint64 `json:"capacity_used_basis_points"`
	RepairBacklog           uint64 `json:"repair_backlog"`
	IntegrityFailures       uint64 `json:"integrity_failures"`
	AuthorizationFailures   uint64 `json:"authorization_failures"`
	RoutingFailures         uint64 `json:"routing_failures"`
}

type ProductionAlertPolicy struct {
	CapacityWarningBasisPoints  uint64
	CapacityCriticalBasisPoints uint64
	RepairBacklogWarning        uint64
	RepairBacklogCritical       uint64
	IntegrityFailureCritical    uint64
	AuthorizationFailureWarning uint64
	RoutingFailureWarning       uint64
}

func DefaultProductionAlertPolicy() ProductionAlertPolicy {
	return ProductionAlertPolicy{
		CapacityWarningBasisPoints:  8000,
		CapacityCriticalBasisPoints: 9000,
		RepairBacklogWarning:        25,
		RepairBacklogCritical:       100,
		IntegrityFailureCritical:    1,
		AuthorizationFailureWarning: 25,
		RoutingFailureWarning:       10,
	}
}

func EvaluateProductionAlerts(statuses []ResourceNetworkStatus, signals ProductionOperationalSignals, policy ProductionAlertPolicy) ([]ProductionAlert, error) {
	if len(statuses) == 0 || policy.CapacityWarningBasisPoints == 0 || policy.CapacityCriticalBasisPoints < policy.CapacityWarningBasisPoints || policy.CapacityCriticalBasisPoints > 10000 || policy.RepairBacklogWarning == 0 || policy.RepairBacklogCritical < policy.RepairBacklogWarning || policy.IntegrityFailureCritical == 0 || policy.AuthorizationFailureWarning == 0 || policy.RoutingFailureWarning == 0 {
		return nil, ErrProductionOperations
	}
	alerts := make([]ProductionAlert, 0)
	for _, status := range statuses {
		if strings.TrimSpace(status.ProviderID) == "" || strings.TrimSpace(status.NodeID) == "" {
			return nil, ErrProductionOperations
		}
		for _, service := range status.Services {
			switch service.Health {
			case ResourceHealthFailed, ResourceHealthStopped:
				for _, capability := range service.Capabilities {
					alerts = append(alerts, ProductionAlert{Code: "service_unavailable", Severity: ProductionAlertCritical, Capability: capability, ServiceID: service.ServiceID})
				}
			case ResourceHealthDegraded:
				for _, capability := range service.Capabilities {
					alerts = append(alerts, ProductionAlert{Code: "service_degraded", Severity: ProductionAlertWarning, Capability: capability, ServiceID: service.ServiceID})
				}
			}
		}
	}
	if signals.CapacityUsedBasisPoints >= policy.CapacityCriticalBasisPoints {
		alerts = append(alerts, ProductionAlert{Code: "capacity_pressure", Severity: ProductionAlertCritical, Capability: ResourceCapabilityStore, Value: signals.CapacityUsedBasisPoints, Threshold: policy.CapacityCriticalBasisPoints})
	} else if signals.CapacityUsedBasisPoints >= policy.CapacityWarningBasisPoints {
		alerts = append(alerts, ProductionAlert{Code: "capacity_pressure", Severity: ProductionAlertWarning, Capability: ResourceCapabilityStore, Value: signals.CapacityUsedBasisPoints, Threshold: policy.CapacityWarningBasisPoints})
	}
	if signals.RepairBacklog >= policy.RepairBacklogCritical {
		alerts = append(alerts, ProductionAlert{Code: "repair_backlog", Severity: ProductionAlertCritical, Capability: ResourceCapabilityRepair, Value: signals.RepairBacklog, Threshold: policy.RepairBacklogCritical})
	} else if signals.RepairBacklog >= policy.RepairBacklogWarning {
		alerts = append(alerts, ProductionAlert{Code: "repair_backlog", Severity: ProductionAlertWarning, Capability: ResourceCapabilityRepair, Value: signals.RepairBacklog, Threshold: policy.RepairBacklogWarning})
	}
	if signals.IntegrityFailures >= policy.IntegrityFailureCritical {
		alerts = append(alerts, ProductionAlert{Code: "integrity_failure", Severity: ProductionAlertCritical, Value: signals.IntegrityFailures, Threshold: policy.IntegrityFailureCritical})
	}
	if signals.AuthorizationFailures >= policy.AuthorizationFailureWarning {
		alerts = append(alerts, ProductionAlert{Code: "authorization_failures", Severity: ProductionAlertWarning, Value: signals.AuthorizationFailures, Threshold: policy.AuthorizationFailureWarning})
	}
	if signals.RoutingFailures >= policy.RoutingFailureWarning {
		alerts = append(alerts, ProductionAlert{Code: "routing_failures", Severity: ProductionAlertWarning, Capability: ResourceCapabilityGateway, Value: signals.RoutingFailures, Threshold: policy.RoutingFailureWarning})
	}
	sort.SliceStable(alerts, func(i, j int) bool {
		if alerts[i].Severity != alerts[j].Severity {
			return alerts[i].Severity > alerts[j].Severity
		}
		if alerts[i].Code != alerts[j].Code {
			return alerts[i].Code < alerts[j].Code
		}
		if alerts[i].Capability != alerts[j].Capability {
			return alerts[i].Capability < alerts[j].Capability
		}
		return strings.ToLower(alerts[i].ServiceID) < strings.ToLower(alerts[j].ServiceID)
	})
	return alerts, nil
}

type ProductionSLOPolicy struct {
	MinAvailabilityBasisPoints uint64
	MinIntegrityBasisPoints    uint64
	MaxRecoveryDuration        time.Duration
}

type ProductionSLOSample struct {
	WindowStart       time.Time
	WindowEnd         time.Time
	Requests          uint64
	Successful        uint64
	IntegrityChecks   uint64
	IntegrityFailures uint64
	RecoveryDuration  time.Duration
}

type ProductionSLOEvidence struct {
	AvailabilityBasisPoints uint64        `json:"availability_basis_points"`
	IntegrityBasisPoints    uint64        `json:"integrity_basis_points"`
	RecoveryDuration        time.Duration `json:"recovery_duration"`
	AvailabilityMet         bool          `json:"availability_met"`
	IntegrityMet            bool          `json:"integrity_met"`
	RecoveryMet             bool          `json:"recovery_met"`
	Met                     bool          `json:"met"`
}

func EvaluateProductionSLO(sample ProductionSLOSample, policy ProductionSLOPolicy) (ProductionSLOEvidence, error) {
	if sample.WindowStart.IsZero() || sample.WindowEnd.IsZero() || !sample.WindowEnd.After(sample.WindowStart) || sample.Requests == 0 || sample.Successful > sample.Requests || sample.IntegrityChecks == 0 || sample.IntegrityFailures > sample.IntegrityChecks || sample.RecoveryDuration < 0 || policy.MinAvailabilityBasisPoints == 0 || policy.MinAvailabilityBasisPoints > 10000 || policy.MinIntegrityBasisPoints == 0 || policy.MinIntegrityBasisPoints > 10000 || policy.MaxRecoveryDuration <= 0 {
		return ProductionSLOEvidence{}, ErrProductionOperations
	}
	availability := sample.Successful * 10000 / sample.Requests
	integritySuccess := sample.IntegrityChecks - sample.IntegrityFailures
	integrity := integritySuccess * 10000 / sample.IntegrityChecks
	evidence := ProductionSLOEvidence{
		AvailabilityBasisPoints: availability,
		IntegrityBasisPoints: integrity,
		RecoveryDuration: sample.RecoveryDuration,
		AvailabilityMet: availability >= policy.MinAvailabilityBasisPoints,
		IntegrityMet: integrity >= policy.MinIntegrityBasisPoints,
		RecoveryMet: sample.RecoveryDuration <= policy.MaxRecoveryDuration,
	}
	evidence.Met = evidence.AvailabilityMet && evidence.IntegrityMet && evidence.RecoveryMet
	return evidence, nil
}

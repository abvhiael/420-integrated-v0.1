package architecture

import "errors"

const (
	Phase     = "STATUS-0"
	ServiceID = "420/service/status/v1"
)

type Boundary struct {
	ContractsRequired       bool
	CanonicalStateAuthority bool
	ReadOnlyPublicSurface   bool
	AlternativeClients      bool
	PrivatePayloadsPublic   bool
	NotificationsDownstream bool
	FreshnessRequired       bool
	IncidentStateCanonical  bool
}

func GenesisBoundary() Boundary {
	return Boundary{
		ContractsRequired:       false,
		CanonicalStateAuthority: false,
		ReadOnlyPublicSurface:   true,
		AlternativeClients:      true,
		PrivatePayloadsPublic:   false,
		NotificationsDownstream: true,
		FreshnessRequired:       true,
		IncidentStateCanonical:  false,
	}
}

type HealthState string

const (
	HealthHealthy     HealthState = "healthy"
	HealthDegraded    HealthState = "degraded"
	HealthUnavailable HealthState = "unavailable"
	HealthMaintenance HealthState = "maintenance"
	HealthUnknown     HealthState = "unknown"
)

func ValidHealthState(v HealthState) bool {
	switch v {
	case HealthHealthy, HealthDegraded, HealthUnavailable, HealthMaintenance, HealthUnknown:
		return true
	default:
		return false
	}
}

type ObservationIdentity struct {
	Network     string
	Environment string
	SourceID    string
	ObservedAt  string
}

func (o ObservationIdentity) Validate() error {
	if o.Network == "" || o.Environment == "" || o.SourceID == "" || o.ObservedAt == "" {
		return errors.New("status observation requires network, environment, source and observed-at identity")
	}
	return nil
}

var Invariants = []string{
	"STATUS-INV-001", "STATUS-INV-002", "STATUS-INV-003", "STATUS-INV-004", "STATUS-INV-005",
	"STATUS-INV-006", "STATUS-INV-007", "STATUS-INV-008", "STATUS-INV-009", "STATUS-INV-010",
	"STATUS-INV-011", "STATUS-INV-012", "STATUS-INV-013", "STATUS-INV-014",
}

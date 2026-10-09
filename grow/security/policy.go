// Package security implements the isolated, fail-closed 420Grow V2 role policy.
// It does not authenticate users: callers must supply server-verified principals.
package security

type Role string
type Action string
type State string

const (
	Owner Role = "OWNER"
	Manager Role = "MANAGER"
	Technician Role = "TECHNICIAN"
	Reviewer Role = "REVIEWER"
	Maintainer Role = "MAINTAINER"
	Active State = "ACTIVE"
	Suspended State = "SUSPENDED"
	Revoked State = "REVOKED"
	View Action = "VIEW"
	PlantWrite Action = "PLANT_WRITE"
	FacilityManage Action = "FACILITY_MANAGE"
	InventoryAdjust Action = "INVENTORY_ADJUST"
	AuditExport Action = "AUDIT_EXPORT"
	MembersManage Action = "MEMBERS_MANAGE"
	EquipmentObserve Action = "EQUIPMENT_OBSERVE"
	DeviceControl Action = "DEVICE_CONTROL"
)

// Principal MUST be built only by a validated, unrevoked authentication adapter.
// An empty or caller-supplied identity cannot acquire authorization.
type Principal struct {
	SubjectID string
	Authenticated bool
}

// Grant is a previously verified server-side ACTIVE tenant membership.
// Nonempty FacilityID/ZoneID narrow authorization (never widen it).
type Grant struct {
	SubjectID string
	TenantID string
	FacilityID string
	ZoneID string
	Role Role
	State State
}

// Resource is a tenant-owned object bound to an optional facility/zone.
type Resource struct {
	TenantID string
	FacilityID string
	ZoneID string
}

func nonempty(v string) bool { return v != "" }

func permitted(role Role, action Action) bool {
	switch role {
	case Owner:
		return action == View || action == PlantWrite || action == FacilityManage ||
			action == InventoryAdjust || action == AuditExport ||
			action == MembersManage || action == EquipmentObserve
	case Manager:
		return action == View || action == PlantWrite || action == FacilityManage ||
			action == InventoryAdjust || action == AuditExport || action == EquipmentObserve
	case Technician:
		return action == View || action == PlantWrite || action == EquipmentObserve
	case Reviewer:
		return action == View || action == AuditExport
	case Maintainer:
		return action == EquipmentObserve
	default:
		return false
	}
}

// Authorize denies by default and requires tenant, subject and narrow scope equality.
// DeviceControl is intentionally unavailable until V2-07's separate safety capability.
func Authorize(p Principal, membership Grant, resource Resource, action Action) bool {
	if !p.Authenticated || !nonempty(p.SubjectID) ||
		!nonempty(membership.SubjectID) || p.SubjectID != membership.SubjectID ||
		membership.State != Active || !nonempty(membership.TenantID) ||
		!nonempty(resource.TenantID) || membership.TenantID != resource.TenantID ||
		action == DeviceControl || !permitted(membership.Role, action) {
		return false
	}
	if nonempty(membership.FacilityID) &&
		(!nonempty(resource.FacilityID) || membership.FacilityID != resource.FacilityID) {
		return false
	}
	if nonempty(membership.ZoneID) &&
		(!nonempty(resource.ZoneID) || membership.ZoneID != resource.ZoneID ||
			!nonempty(membership.FacilityID) || membership.FacilityID != resource.FacilityID) {
		return false
	}
	return true
}

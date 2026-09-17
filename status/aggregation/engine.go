package aggregation

import (
	"errors"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/420integrated/420-integrated/status/components"
	"github.com/420integrated/420-integrated/status/evidence"
	"github.com/420integrated/420-integrated/status/incidents"
)

type ComponentStatus struct {
	Component        components.Component
	Health           components.Health
	Live             bool
	Ready            bool
	Reason           string
	FreshSources     int
	StaleSources     int
	Conflicting      bool
	IncidentSeverity incidents.Severity
	Authoritative    bool
}

func (s ComponentStatus) Validate() error {
	if err := s.Component.Validate(); err != nil { return err }
	if !components.ValidHealth(s.Health) { return fmt.Errorf("invalid aggregate health %q", s.Health) }
	if s.Authoritative { return errors.New("aggregate status cannot claim protocol authority") }
	if s.Health == components.HealthHealthy && (!s.Live || !s.Ready) {
		return errors.New("healthy aggregate requires live and ready evidence")
	}
	return nil
}

type Rollup struct {
	Health        components.Health
	Components    []ComponentStatus
	Healthy       int
	Degraded      int
	Unavailable   int
	Maintenance   int
	Unknown       int
	Authoritative bool
}

func Evaluate(component components.Component, observations []evidence.Observation, active []incidents.Incident, now time.Time) (ComponentStatus, error) {
	if err := component.Validate(); err != nil { return ComponentStatus{}, err }
	status := ComponentStatus{Component: component, Health: components.HealthUnknown, Reason: "no fresh evidence"}
	states := map[components.Health]bool{}
	first := true
	allLive, allReady := true, true

	for _, obs := range observations {
		if obs.ComponentID != component.ID { continue }
		if obs.Network != component.Network || obs.Environment != component.Environment { continue }
		if err := obs.Validate(now); err != nil { return ComponentStatus{}, fmt.Errorf("invalid observation from %s: %w", obs.SourceID, err) }
		if !obs.Fresh(now) {
			status.StaleSources++
			continue
		}
		status.FreshSources++
		states[obs.State] = true
		if first {
			allLive, allReady = obs.Live, obs.Ready
			first = false
		} else {
			allLive = allLive && obs.Live
			allReady = allReady && obs.Ready
		}
	}

	if status.FreshSources > 0 {
		status.Live, status.Ready = allLive, allReady
		if len(states) > 1 {
			status.Conflicting = true
			status.Health = components.HealthUnknown
			status.Reason = "conflicting fresh evidence"
		} else {
			for state := range states { status.Health = state }
			status.Reason = "fresh evidence"
			if status.Health == components.HealthHealthy && (!status.Live || !status.Ready) {
				status.Health = components.HealthDegraded
				status.Reason = "fresh evidence is not both live and ready"
			}
		}
	}

	maintenance := false
	maxSeverity := incidents.Severity("")
	for _, incident := range active {
		if incident.Network != component.Network || incident.Environment != component.Environment || incident.CurrentState() == incidents.StateResolved { continue }
		if !contains(incident.AffectedComponents, component.ID) { continue }
		if len(incident.Updates) == 0 { continue }
		last := incident.Updates[len(incident.Updates)-1]
		if incident.Kind == incidents.KindMaintenance && !now.Before(incident.PlannedStart) && now.Before(incident.PlannedEnd) {
			maintenance = true
		}
		if incident.Kind == incidents.KindIncident && severityRank(last.Severity) > severityRank(maxSeverity) {
			maxSeverity = last.Severity
		}
	}
	status.IncidentSeverity = maxSeverity

	switch maxSeverity {
	case incidents.SeverityCritical:
		status.Health = components.HealthUnavailable
		status.Reason = "critical active incident"
	case incidents.SeverityMajor:
		if status.Health != components.HealthUnavailable {
			status.Health = components.HealthDegraded
		}
		status.Reason = "major active incident"
	case incidents.SeverityWarn:
		if status.Health == components.HealthHealthy || status.Health == components.HealthMaintenance {
			status.Health = components.HealthDegraded
			status.Reason = "warning active incident"
		}
	default:
		if maintenance && status.Health != components.HealthUnavailable && status.Health != components.HealthDegraded && !status.Conflicting {
			status.Health = components.HealthMaintenance
			status.Reason = "planned maintenance"
		}
	}

	if err := status.Validate(); err != nil { return ComponentStatus{}, err }
	return status, nil
}

func Aggregate(statuses []ComponentStatus) (Rollup, error) {
	out := Rollup{Health: components.HealthUnknown, Components: append([]ComponentStatus(nil), statuses...)}
	sort.Slice(out.Components, func(i, j int) bool { return out.Components[i].Component.ID < out.Components[j].Component.ID })
	for _, status := range out.Components {
		if err := status.Validate(); err != nil { return Rollup{}, err }
		switch status.Health {
		case components.HealthHealthy: out.Healthy++
		case components.HealthDegraded: out.Degraded++
		case components.HealthUnavailable: out.Unavailable++
		case components.HealthMaintenance: out.Maintenance++
		case components.HealthUnknown: out.Unknown++
		}
	}

	total := len(out.Components)
	switch {
	case total == 0:
		out.Health = components.HealthUnknown
	case out.Unavailable == total:
		out.Health = components.HealthUnavailable
	case out.Unknown == total:
		out.Health = components.HealthUnknown
	case out.Degraded > 0 || out.Unavailable > 0 || out.Unknown > 0:
		out.Health = components.HealthDegraded
	case out.Maintenance > 0:
		out.Health = components.HealthMaintenance
	default:
		out.Health = components.HealthHealthy
	}
	return out, nil
}

func severityRank(v incidents.Severity) int {
	switch v {
	case incidents.SeverityInfo: return 1
	case incidents.SeverityWarn: return 2
	case incidents.SeverityMajor: return 3
	case incidents.SeverityCritical: return 4
	default: return 0
	}
}

func contains(ids []string, want string) bool {
	want = strings.TrimSpace(want)
	for _, id := range ids { if strings.TrimSpace(id) == want { return true } }
	return false
}

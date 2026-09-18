package incidents

import (
	"errors"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/420integrated/420-integrated/status/evidence"
)

type Severity string

const (
	SeverityInfo     Severity = "INFO"
	SeverityWarn     Severity = "WARN"
	SeverityMajor    Severity = "MAJOR"
	SeverityCritical Severity = "CRITICAL"
)

func ValidSeverity(v Severity) bool {
	switch v {
	case SeverityInfo, SeverityWarn, SeverityMajor, SeverityCritical:
		return true
	default:
		return false
	}
}

type State string

const (
	StateOpen       State = "open"
	StateMonitoring State = "monitoring"
	StateResolved   State = "resolved"
)

func ValidState(v State) bool {
	switch v {
	case StateOpen, StateMonitoring, StateResolved:
		return true
	default:
		return false
	}
}

type Kind string

const (
	KindIncident    Kind = "incident"
	KindMaintenance Kind = "maintenance"
)

type Update struct {
	At             time.Time
	State          State
	Severity       Severity
	Summary        string
	Mitigation     string
	Evidence       []evidence.Reference
	Authoritative  bool
}

func (u Update) Validate() error {
	if u.At.IsZero() { return errors.New("incident update timestamp is required") }
	if !ValidState(u.State) { return fmt.Errorf("invalid incident state %q", u.State) }
	if !ValidSeverity(u.Severity) { return fmt.Errorf("invalid incident severity %q", u.Severity) }
	if strings.TrimSpace(u.Summary) == "" { return errors.New("incident update summary is required") }
	if u.Authoritative { return errors.New("incident updates cannot claim protocol authority") }
	for _, ref := range u.Evidence {
		if strings.TrimSpace(ref.Kind) == "" || strings.TrimSpace(ref.Value) == "" {
			return errors.New("incident evidence reference requires kind and value")
		}
	}
	return nil
}

type Incident struct {
	ID                 string
	Kind               Kind
	Title              string
	Network            string
	Environment        string
	AffectedComponents []string
	StartedAt          time.Time
	PlannedStart       time.Time
	PlannedEnd         time.Time
	Updates            []Update
}

func (i Incident) Validate() error {
	if strings.TrimSpace(i.ID) == "" { return errors.New("incident id is required") }
	if strings.TrimSpace(i.Title) == "" { return errors.New("incident title is required") }
	if strings.TrimSpace(i.Network) == "" || strings.TrimSpace(i.Environment) == "" { return errors.New("incident network and environment are required") }
	if len(i.AffectedComponents) == 0 { return errors.New("incident requires affected components") }
	seen := map[string]bool{}
	for _, id := range i.AffectedComponents {
		id = strings.TrimSpace(id)
		if id == "" { return errors.New("affected component id cannot be empty") }
		if seen[id] { return fmt.Errorf("duplicate affected component %q", id) }
		seen[id] = true
	}
	if i.StartedAt.IsZero() { return errors.New("incident start time is required") }
	if i.Kind != KindIncident && i.Kind != KindMaintenance { return fmt.Errorf("invalid incident kind %q", i.Kind) }
	if i.Kind == KindMaintenance {
		if i.PlannedStart.IsZero() || i.PlannedEnd.IsZero() { return errors.New("maintenance requires planned start and end") }
		if !i.PlannedEnd.After(i.PlannedStart) { return errors.New("maintenance end must be after start") }
	}
	if len(i.Updates) == 0 { return errors.New("incident requires at least one update") }
	last := time.Time{}
	state := State("")
	for n, u := range i.Updates {
		if err := u.Validate(); err != nil { return fmt.Errorf("update %d: %w", n, err) }
		if !last.IsZero() && u.At.Before(last) { return errors.New("incident updates must be append-only by time") }
		if n == 0 && u.State != StateOpen { return errors.New("first incident update must open the incident") }
		if n > 0 && !AllowedTransition(state, u.State) { return fmt.Errorf("invalid incident transition %s -> %s", state, u.State) }
		last = u.At
		state = u.State
	}
	return nil
}

func AllowedTransition(from, to State) bool {
	switch from {
	case StateOpen:
		return to == StateOpen || to == StateMonitoring || to == StateResolved
	case StateMonitoring:
		return to == StateMonitoring || to == StateOpen || to == StateResolved
	case StateResolved:
		return false
	default:
		return false
	}
}

func (i Incident) CurrentState() State {
	if len(i.Updates) == 0 { return "" }
	return i.Updates[len(i.Updates)-1].State
}

func (i Incident) ResolvedAt() (time.Time, bool) {
	if i.CurrentState() != StateResolved { return time.Time{}, false }
	return i.Updates[len(i.Updates)-1].At, true
}

func NormalizeAffected(ids []string) []string {
	out := append([]string(nil), ids...)
	sort.Strings(out)
	return out
}

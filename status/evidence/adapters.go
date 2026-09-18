package evidence

import (
	"errors"
	"time"

	"github.com/420integrated/420-integrated/status/components"
)

type ProbeResult struct {
	State      components.Health
	Live       bool
	Ready      bool
	Summary    string
	ObservedAt time.Time
	TTL        time.Duration
	References []Reference
}

type Probe interface {
	Probe(component components.Component, now time.Time) (ProbeResult, error)
}

type ProbeSource struct {
	sourceID string
	probe Probe
}

func NewProbeSource(sourceID string, probe Probe) (*ProbeSource, error) {
	if sourceID == "" { return nil, errors.New("source id is required") }
	if probe == nil { return nil, errors.New("probe is required") }
	return &ProbeSource{sourceID: sourceID, probe: probe}, nil
}

func (s *ProbeSource) ID() string { return s.sourceID }

func (s *ProbeSource) Observe(component components.Component, now time.Time) (Observation, error) {
	result, err := s.probe.Probe(component, now)
	if err != nil { return Observation{}, err }
	if result.TTL <= 0 { return Observation{}, errors.New("probe result TTL must be positive") }
	observedAt := result.ObservedAt
	if observedAt.IsZero() { observedAt = now }
	return Observation{
		ComponentID: component.ID,
		SourceID: s.sourceID,
		Network: component.Network,
		Environment: component.Environment,
		State: result.State,
		Live: result.Live,
		Ready: result.Ready,
		Summary: result.Summary,
		ObservedAt: observedAt,
		ExpiresAt: observedAt.Add(result.TTL),
		References: append([]Reference(nil), result.References...),
		Canonical: false,
	}, nil
}

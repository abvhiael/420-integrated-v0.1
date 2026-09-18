package evidence

import (
	"errors"
	"fmt"
	"sort"
	"sync"
	"time"

	"github.com/420integrated/420-integrated/status/components"
)

type Source interface {
	ID() string
	Observe(component components.Component, now time.Time) (Observation, error)
}

type Ingestor struct {
	registry *components.Registry
	network string
	environment string
	mu sync.RWMutex
	latest map[string]Observation
}

func NewIngestor(registry *components.Registry, network, environment string) (*Ingestor, error) {
	if registry == nil { return nil, errors.New("component registry is required") }
	if network == "" || environment == "" { return nil, errors.New("network and environment are required") }
	return &Ingestor{registry: registry, network: network, environment: environment, latest: map[string]Observation{}}, nil
}

func (i *Ingestor) Ingest(componentID string, source Source, now time.Time) (Observation, error) {
	if source == nil { return Observation{}, errors.New("evidence source is required") }
	component, ok := i.registry.Get(componentID)
	if !ok { return Observation{}, fmt.Errorf("unknown component %q", componentID) }
	if component.Network != i.network || component.Environment != i.environment {
		return Observation{}, errors.New("component network/environment does not match ingestor")
	}
	obs, err := source.Observe(component, now)
	if err != nil { return Observation{}, fmt.Errorf("source %s observation failed: %w", source.ID(), err) }
	if obs.SourceID != source.ID() { return Observation{}, errors.New("observation source identity mismatch") }
	if obs.ComponentID != component.ID { return Observation{}, errors.New("observation component identity mismatch") }
	if obs.Network != i.network || obs.Environment != i.environment { return Observation{}, errors.New("observation network/environment mismatch") }
	if err := obs.Validate(now); err != nil { return Observation{}, err }
	i.mu.Lock(); defer i.mu.Unlock()
	i.latest[componentID+"\x00"+obs.SourceID] = obs
	return obs, nil
}

func (i *Ingestor) Latest(componentID string) []Observation {
	i.mu.RLock(); defer i.mu.RUnlock()
	out := []Observation{}
	prefix := componentID + "\x00"
	for key, obs := range i.latest {
		if len(key) >= len(prefix) && key[:len(prefix)] == prefix { out = append(out, obs) }
	}
	sort.Slice(out, func(a, b int) bool {
		if out[a].ObservedAt.Equal(out[b].ObservedAt) { return out[a].SourceID < out[b].SourceID }
		return out[a].ObservedAt.After(out[b].ObservedAt)
	})
	return out
}

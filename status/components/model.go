package components

import (
	"errors"
	"fmt"
	"sort"
	"strings"
	"sync"
)

type Class string

const (
	ClassConsensus Class = "consensus"
	ClassExecution Class = "execution"
	ClassRPC Class = "rpc"
	ClassIndexer Class = "indexer"
	ClassExplorer Class = "explorer"
	ClassSearch Class = "search"
	ClassAnalytics Class = "analytics"
	ClassStorage Class = "storage"
	ClassAI Class = "ai"
	ClassOracle Class = "oracle"
	ClassBridge Class = "bridge"
	ClassWallet Class = "wallet"
	ClassDApp Class = "dapp"
)

func ValidClass(c Class) bool {
	switch c {
	case ClassConsensus, ClassExecution, ClassRPC, ClassIndexer, ClassExplorer, ClassSearch, ClassAnalytics, ClassStorage, ClassAI, ClassOracle, ClassBridge, ClassWallet, ClassDApp:
		return true
	default:
		return false
	}
}

type Health string

const (
	HealthHealthy Health = "healthy"
	HealthDegraded Health = "degraded"
	HealthUnavailable Health = "unavailable"
	HealthMaintenance Health = "maintenance"
	HealthUnknown Health = "unknown"
)

func ValidHealth(h Health) bool {
	switch h {
	case HealthHealthy, HealthDegraded, HealthUnavailable, HealthMaintenance, HealthUnknown:
		return true
	default:
		return false
	}
}

type Component struct {
	ID string
	Name string
	Class Class
	Network string
	Environment string
	Public bool
}

func (c Component) Validate() error {
	if strings.TrimSpace(c.ID) == "" { return errors.New("component id is required") }
	if strings.TrimSpace(c.Name) == "" { return errors.New("component name is required") }
	if !ValidClass(c.Class) { return fmt.Errorf("invalid component class %q", c.Class) }
	if strings.TrimSpace(c.Network) == "" { return errors.New("component network is required") }
	if strings.TrimSpace(c.Environment) == "" { return errors.New("component environment is required") }
	return nil
}

type Snapshot struct {
	Component Component
	Live bool
	Ready bool
	Health Health
	Reason string
	Authoritative bool
}

func (s Snapshot) Validate() error {
	if err := s.Component.Validate(); err != nil { return err }
	if !ValidHealth(s.Health) { return fmt.Errorf("invalid health state %q", s.Health) }
	if s.Authoritative { return errors.New("status snapshots cannot be canonical authority") }
	if s.Health == HealthHealthy && !s.Ready { return errors.New("healthy component must be ready") }
	if s.Health == HealthHealthy && !s.Live { return errors.New("healthy component must be live") }
	if s.Health == HealthMaintenance && strings.TrimSpace(s.Reason) == "" { return errors.New("maintenance state requires a reason") }
	return nil
}

type Registry struct {
	mu sync.RWMutex
	items map[string]Component
}

func NewRegistry() *Registry { return &Registry{items: map[string]Component{}} }

func (r *Registry) Register(c Component) error {
	if err := c.Validate(); err != nil { return err }
	r.mu.Lock(); defer r.mu.Unlock()
	if _, exists := r.items[c.ID]; exists { return fmt.Errorf("component %q already registered", c.ID) }
	r.items[c.ID] = c
	return nil
}

func (r *Registry) Get(id string) (Component, bool) {
	r.mu.RLock(); defer r.mu.RUnlock()
	c, ok := r.items[id]
	return c, ok
}

func (r *Registry) List() []Component {
	r.mu.RLock(); defer r.mu.RUnlock()
	out := make([]Component, 0, len(r.items))
	for _, c := range r.items { out = append(out, c) }
	sort.Slice(out, func(i, j int) bool { return out[i].ID < out[j].ID })
	return out
}

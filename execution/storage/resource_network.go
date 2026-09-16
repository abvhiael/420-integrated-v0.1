package storage

import (
	"errors"
	"sort"
	"strings"
	"sync"
)

var ErrResourceNetwork = errors.New("resource network runtime failure")

type ResourceCapability string

const (
	ResourceCapabilityStore   ResourceCapability = "store"
	ResourceCapabilityRepair  ResourceCapability = "repair"
	ResourceCapabilityCache   ResourceCapability = "cache"
	ResourceCapabilityGateway ResourceCapability = "gateway"
	ResourceCapabilityRelay   ResourceCapability = "relay"
)

type ResourceServiceState string

const (
	ResourceServiceRegistered ResourceServiceState = "registered"
	ResourceServiceStarting   ResourceServiceState = "starting"
	ResourceServiceRunning    ResourceServiceState = "running"
	ResourceServiceDegraded   ResourceServiceState = "degraded"
	ResourceServiceStopped    ResourceServiceState = "stopped"
	ResourceServiceFailed     ResourceServiceState = "failed"
)

type ResourceServiceDescriptor struct {
	ProviderID   string               `json:"provider_id"`
	NodeID       string               `json:"node_id"`
	ServiceID    string               `json:"service_id"`
	Capabilities []ResourceCapability `json:"capabilities"`
}

type ResourceServiceSnapshot struct {
	Descriptor ResourceServiceDescriptor `json:"descriptor"`
	State      ResourceServiceState      `json:"state"`
}

type ResourceNetworkRuntime struct {
	providerID string
	nodeID     string
	mu         sync.RWMutex
	services   map[string]ResourceServiceSnapshot
}

func NewResourceNetworkRuntime(providerID, nodeID string) (*ResourceNetworkRuntime, error) {
	providerID = strings.TrimSpace(providerID)
	nodeID = strings.TrimSpace(nodeID)
	if providerID == "" || nodeID == "" {
		return nil, ErrResourceNetwork
	}
	return &ResourceNetworkRuntime{
		providerID: providerID,
		nodeID:     nodeID,
		services:   make(map[string]ResourceServiceSnapshot),
	}, nil
}

func (r *ResourceNetworkRuntime) Register(descriptor ResourceServiceDescriptor) error {
	if r == nil {
		return ErrResourceNetwork
	}
	normalized, err := r.normalizeDescriptor(descriptor)
	if err != nil {
		return err
	}
	key := strings.ToLower(normalized.ServiceID)
	r.mu.Lock()
	defer r.mu.Unlock()
	if _, exists := r.services[key]; exists {
		return ErrResourceNetwork
	}
	r.services[key] = ResourceServiceSnapshot{Descriptor: normalized, State: ResourceServiceRegistered}
	return nil
}

func (r *ResourceNetworkRuntime) Transition(serviceID string, next ResourceServiceState) error {
	if r == nil || !validResourceServiceState(next) {
		return ErrResourceNetwork
	}
	key := strings.ToLower(strings.TrimSpace(serviceID))
	if key == "" {
		return ErrResourceNetwork
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	current, ok := r.services[key]
	if !ok || !allowedResourceTransition(current.State, next) {
		return ErrResourceNetwork
	}
	current.State = next
	r.services[key] = current
	return nil
}

func (r *ResourceNetworkRuntime) Snapshot() []ResourceServiceSnapshot {
	if r == nil {
		return nil
	}
	r.mu.RLock()
	out := make([]ResourceServiceSnapshot, 0, len(r.services))
	for _, service := range r.services {
		service.Descriptor.Capabilities = append([]ResourceCapability(nil), service.Descriptor.Capabilities...)
		out = append(out, service)
	}
	r.mu.RUnlock()
	sort.Slice(out, func(i, j int) bool {
		return strings.ToLower(out[i].Descriptor.ServiceID) < strings.ToLower(out[j].Descriptor.ServiceID)
	})
	return out
}

func (r *ResourceNetworkRuntime) ServicesFor(capability ResourceCapability) []ResourceServiceSnapshot {
	if !validResourceCapability(capability) {
		return nil
	}
	all := r.Snapshot()
	out := make([]ResourceServiceSnapshot, 0, len(all))
	for _, service := range all {
		for _, candidate := range service.Descriptor.Capabilities {
			if candidate == capability {
				out = append(out, service)
				break
			}
		}
	}
	return out
}

func (r *ResourceNetworkRuntime) normalizeDescriptor(descriptor ResourceServiceDescriptor) (ResourceServiceDescriptor, error) {
	descriptor.ProviderID = strings.TrimSpace(descriptor.ProviderID)
	descriptor.NodeID = strings.TrimSpace(descriptor.NodeID)
	descriptor.ServiceID = strings.TrimSpace(descriptor.ServiceID)
	if descriptor.ProviderID == "" || descriptor.NodeID == "" || descriptor.ServiceID == "" {
		return ResourceServiceDescriptor{}, ErrResourceNetwork
	}
	if !strings.EqualFold(descriptor.ProviderID, r.providerID) || !strings.EqualFold(descriptor.NodeID, r.nodeID) {
		return ResourceServiceDescriptor{}, ErrResourceNetwork
	}
	if len(descriptor.Capabilities) == 0 {
		return ResourceServiceDescriptor{}, ErrResourceNetwork
	}
	seen := make(map[ResourceCapability]struct{}, len(descriptor.Capabilities))
	capabilities := make([]ResourceCapability, 0, len(descriptor.Capabilities))
	for _, capability := range descriptor.Capabilities {
		capability = ResourceCapability(strings.ToLower(strings.TrimSpace(string(capability))))
		if !validResourceCapability(capability) {
			return ResourceServiceDescriptor{}, ErrResourceNetwork
		}
		if _, exists := seen[capability]; exists {
			continue
		}
		seen[capability] = struct{}{}
		capabilities = append(capabilities, capability)
	}
	sort.Slice(capabilities, func(i, j int) bool { return capabilities[i] < capabilities[j] })
	descriptor.Capabilities = capabilities
	return descriptor, nil
}

func validResourceCapability(capability ResourceCapability) bool {
	switch capability {
	case ResourceCapabilityStore, ResourceCapabilityRepair, ResourceCapabilityCache, ResourceCapabilityGateway, ResourceCapabilityRelay:
		return true
	default:
		return false
	}
}

func validResourceServiceState(state ResourceServiceState) bool {
	switch state {
	case ResourceServiceRegistered, ResourceServiceStarting, ResourceServiceRunning, ResourceServiceDegraded, ResourceServiceStopped, ResourceServiceFailed:
		return true
	default:
		return false
	}
}

func allowedResourceTransition(current, next ResourceServiceState) bool {
	if current == next {
		return false
	}
	switch current {
	case ResourceServiceRegistered:
		return next == ResourceServiceStarting || next == ResourceServiceStopped
	case ResourceServiceStarting:
		return next == ResourceServiceRunning || next == ResourceServiceFailed || next == ResourceServiceStopped
	case ResourceServiceRunning:
		return next == ResourceServiceDegraded || next == ResourceServiceFailed || next == ResourceServiceStopped
	case ResourceServiceDegraded:
		return next == ResourceServiceRunning || next == ResourceServiceFailed || next == ResourceServiceStopped
	case ResourceServiceStopped:
		return next == ResourceServiceStarting
	case ResourceServiceFailed:
		return next == ResourceServiceStarting || next == ResourceServiceStopped
	default:
		return false
	}
}

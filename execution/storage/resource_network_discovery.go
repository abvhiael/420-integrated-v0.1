package storage

import (
	"context"
	"errors"
	"sort"
	"strings"
	"sync"
)

var ErrResourceDiscovery = errors.New("resource network discovery failure")

type ResourceDiscoveryRequest struct {
	Capabilities []ResourceCapability
	IncludeDegraded bool
}

type ResourceEndpoint struct {
	ProviderID string `json:"provider_id"`
	NodeID string `json:"node_id"`
	ServiceID string `json:"service_id"`
	Capability ResourceCapability `json:"capability"`
	Priority uint32 `json:"priority"`
	Endpoint string `json:"endpoint,omitempty"`
	State ResourceServiceState `json:"state"`
	Source GatewaySource `json:"-"`
}

type ResourceDiscovery interface {
	DiscoverResources(context.Context, ResourceDiscoveryRequest) ([]ResourceEndpoint, error)
}

type resourceBinding struct {
	priority uint32
	endpoint string
	source GatewaySource
}

type RuntimeResourceDiscovery struct {
	runtime *ResourceNetworkRuntime
	mu sync.RWMutex
	bindings map[string]map[ResourceCapability]resourceBinding
}

func NewRuntimeResourceDiscovery(runtime *ResourceNetworkRuntime) (*RuntimeResourceDiscovery, error) {
	if runtime == nil {
		return nil, ErrResourceDiscovery
	}
	return &RuntimeResourceDiscovery{runtime: runtime, bindings: make(map[string]map[ResourceCapability]resourceBinding)}, nil
}

func (d *RuntimeResourceDiscovery) Bind(serviceID string, capability ResourceCapability, priority uint32, endpoint string, source GatewaySource) error {
	if d == nil || d.runtime == nil || !validResourceCapability(capability) {
		return ErrResourceDiscovery
	}
	serviceID = strings.TrimSpace(serviceID)
	endpoint = strings.TrimSpace(endpoint)
	if serviceID == "" || (endpoint == "" && source == nil) {
		return ErrResourceDiscovery
	}
	var snapshot *ResourceServiceSnapshot
	for _, candidate := range d.runtime.Snapshot() {
		if strings.EqualFold(candidate.Descriptor.ServiceID, serviceID) {
			copy := candidate
			snapshot = &copy
			break
		}
	}
	if snapshot == nil || !descriptorHasCapability(snapshot.Descriptor, capability) {
		return ErrResourceDiscovery
	}
	key := strings.ToLower(snapshot.Descriptor.ServiceID)
	d.mu.Lock()
	defer d.mu.Unlock()
	if d.bindings[key] == nil {
		d.bindings[key] = make(map[ResourceCapability]resourceBinding)
	}
	if _, exists := d.bindings[key][capability]; exists {
		return ErrResourceDiscovery
	}
	d.bindings[key][capability] = resourceBinding{priority: priority, endpoint: endpoint, source: source}
	return nil
}

func (d *RuntimeResourceDiscovery) DiscoverResources(ctx context.Context, req ResourceDiscoveryRequest) ([]ResourceEndpoint, error) {
	if d == nil || d.runtime == nil {
		return nil, ErrResourceDiscovery
	}
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	requested := make(map[ResourceCapability]struct{}, len(req.Capabilities))
	for _, capability := range req.Capabilities {
		capability = ResourceCapability(strings.ToLower(strings.TrimSpace(string(capability))))
		if !validResourceCapability(capability) {
			return nil, ErrResourceDiscovery
		}
		requested[capability] = struct{}{}
	}
	if len(requested) == 0 {
		return nil, ErrResourceDiscovery
	}

	d.mu.RLock()
	bindings := make(map[string]map[ResourceCapability]resourceBinding, len(d.bindings))
	for serviceID, byCapability := range d.bindings {
		copyMap := make(map[ResourceCapability]resourceBinding, len(byCapability))
		for capability, binding := range byCapability {
			copyMap[capability] = binding
		}
		bindings[serviceID] = copyMap
	}
	d.mu.RUnlock()

	out := make([]ResourceEndpoint, 0)
	for _, service := range d.runtime.Snapshot() {
		if err := ctx.Err(); err != nil {
			return nil, err
		}
		if service.State != ResourceServiceRunning && !(req.IncludeDegraded && service.State == ResourceServiceDegraded) {
			continue
		}
		serviceBindings := bindings[strings.ToLower(service.Descriptor.ServiceID)]
		for _, capability := range service.Descriptor.Capabilities {
			if _, ok := requested[capability]; !ok {
				continue
			}
			binding, ok := serviceBindings[capability]
			if !ok || (binding.endpoint == "" && binding.source == nil) {
				continue
			}
			out = append(out, ResourceEndpoint{
				ProviderID: service.Descriptor.ProviderID,
				NodeID: service.Descriptor.NodeID,
				ServiceID: service.Descriptor.ServiceID,
				Capability: capability,
				Priority: binding.priority,
				Endpoint: binding.endpoint,
				State: service.State,
				Source: binding.source,
			})
		}
	}
	sort.SliceStable(out, func(i, j int) bool {
		if out[i].Capability != out[j].Capability {
			return out[i].Capability < out[j].Capability
		}
		if out[i].Priority != out[j].Priority {
			return out[i].Priority < out[j].Priority
		}
		if !strings.EqualFold(out[i].ProviderID, out[j].ProviderID) {
			return strings.ToLower(out[i].ProviderID) < strings.ToLower(out[j].ProviderID)
		}
		if !strings.EqualFold(out[i].NodeID, out[j].NodeID) {
			return strings.ToLower(out[i].NodeID) < strings.ToLower(out[j].NodeID)
		}
		return strings.ToLower(out[i].ServiceID) < strings.ToLower(out[j].ServiceID)
	})
	return out, nil
}

func descriptorHasCapability(descriptor ResourceServiceDescriptor, capability ResourceCapability) bool {
	for _, candidate := range descriptor.Capabilities {
		if candidate == capability {
			return true
		}
	}
	return false
}

type ResourceGatewayDiscovery struct {
	Discovery ResourceDiscovery
}

func (d ResourceGatewayDiscovery) DiscoverGatewaySources(ctx context.Context, _ GatewayRequest) ([]GatewayCandidate, error) {
	if d.Discovery == nil {
		return nil, ErrResourceDiscovery
	}
	endpoints, err := d.Discovery.DiscoverResources(ctx, ResourceDiscoveryRequest{Capabilities: []ResourceCapability{ResourceCapabilityCache, ResourceCapabilityStore}})
	if err != nil {
		return nil, err
	}
	candidates := make([]GatewayCandidate, 0, len(endpoints))
	for _, endpoint := range endpoints {
		var capability GatewayCapability
		switch endpoint.Capability {
		case ResourceCapabilityCache:
			capability = GatewayCapabilityCache
		case ResourceCapabilityStore:
			capability = GatewayCapabilityStore
		default:
			continue
		}
		if endpoint.Source == nil {
			continue
		}
		candidates = append(candidates, GatewayCandidate{
			ProviderID: endpoint.ProviderID,
			NodeID: endpoint.NodeID,
			Capability: capability,
			Priority: endpoint.Priority,
			Active: endpoint.State == ResourceServiceRunning,
			Source: endpoint.Source,
		})
	}
	return candidates, nil
}

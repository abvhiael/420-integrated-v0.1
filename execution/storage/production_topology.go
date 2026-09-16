package storage

import (
	"context"
	"errors"
	"sort"
	"strings"
)

var ErrProductionTopology = errors.New("production resource topology failure")

type ProductionServiceSpec struct {
	ServiceID    string
	Capabilities []ResourceCapability
	Priority     uint32
	Endpoint     string
	Source       GatewaySource
}

type ProductionNodeSpec struct {
	ProviderID string
	NodeID     string
	Services   []ProductionServiceSpec
}

type ProductionResourceNode struct {
	ProviderID string
	NodeID     string
	Runtime    *ResourceNetworkRuntime
	Discovery  *RuntimeResourceDiscovery
}

type ProductionResourceTopology struct {
	nodes     []ProductionResourceNode
	discovery MultiProviderResourceDiscovery
}

// BuildProductionResourceTopology constructs a derived operational topology.
// It never creates canonical agreements, placements, manifests, proofs, or settlement state.
func BuildProductionResourceTopology(specs []ProductionNodeSpec) (*ProductionResourceTopology, error) {
	if len(specs) < 2 {
		return nil, ErrProductionTopology
	}
	providerSet := make(map[string]struct{})
	nodeSet := make(map[string]struct{})
	nodes := make([]ProductionResourceNode, 0, len(specs))
	discoveries := make([]ResourceDiscovery, 0, len(specs))

	for _, spec := range specs {
		providerID := strings.TrimSpace(spec.ProviderID)
		nodeID := strings.TrimSpace(spec.NodeID)
		if providerID == "" || nodeID == "" || len(spec.Services) == 0 {
			return nil, ErrProductionTopology
		}
		providerSet[strings.ToLower(providerID)] = struct{}{}
		nodeKey := strings.ToLower(providerID + "\x00" + nodeID)
		if _, exists := nodeSet[nodeKey]; exists {
			return nil, ErrProductionTopology
		}
		nodeSet[nodeKey] = struct{}{}

		runtime, err := NewResourceNetworkRuntime(providerID, nodeID)
		if err != nil {
			return nil, ErrProductionTopology
		}
		discovery, err := NewRuntimeResourceDiscovery(runtime)
		if err != nil {
			return nil, ErrProductionTopology
		}
		for _, service := range spec.Services {
			serviceID := strings.TrimSpace(service.ServiceID)
			if serviceID == "" || len(service.Capabilities) == 0 {
				return nil, ErrProductionTopology
			}
			descriptor := ResourceServiceDescriptor{ProviderID: providerID, NodeID: nodeID, ServiceID: serviceID, Capabilities: service.Capabilities}
			if err := runtime.Register(descriptor); err != nil {
				return nil, ErrProductionTopology
			}
			for _, capability := range service.Capabilities {
				if err := discovery.Bind(serviceID, capability, service.Priority, service.Endpoint, service.Source); err != nil {
					return nil, ErrProductionTopology
				}
			}
		}
		node := ProductionResourceNode{ProviderID: providerID, NodeID: nodeID, Runtime: runtime, Discovery: discovery}
		nodes = append(nodes, node)
		discoveries = append(discoveries, discovery)
	}
	if len(providerSet) < 2 {
		return nil, ErrProductionTopology
	}
	sort.Slice(nodes, func(i, j int) bool {
		if !strings.EqualFold(nodes[i].ProviderID, nodes[j].ProviderID) {
			return strings.ToLower(nodes[i].ProviderID) < strings.ToLower(nodes[j].ProviderID)
		}
		return strings.ToLower(nodes[i].NodeID) < strings.ToLower(nodes[j].NodeID)
	})
	return &ProductionResourceTopology{nodes: nodes, discovery: MultiProviderResourceDiscovery{Sources: discoveries}}, nil
}

func (t *ProductionResourceTopology) Nodes() []ProductionResourceNode {
	if t == nil {
		return nil
	}
	return append([]ProductionResourceNode(nil), t.nodes...)
}

func (t *ProductionResourceTopology) Discovery() ResourceDiscovery {
	if t == nil {
		return nil
	}
	return t.discovery
}

func (t *ProductionResourceTopology) StartAll() error {
	if t == nil {
		return ErrProductionTopology
	}
	for _, node := range t.nodes {
		for _, service := range node.Runtime.Snapshot() {
			if service.State != ResourceServiceRegistered && service.State != ResourceServiceStopped && service.State != ResourceServiceFailed {
				continue
			}
			if err := node.Runtime.Transition(service.Descriptor.ServiceID, ResourceServiceStarting); err != nil {
				return ErrProductionTopology
			}
			if err := node.Runtime.Transition(service.Descriptor.ServiceID, ResourceServiceRunning); err != nil {
				return ErrProductionTopology
			}
		}
	}
	return nil
}

func (t *ProductionResourceTopology) StopAll() error {
	if t == nil {
		return ErrProductionTopology
	}
	for i := len(t.nodes) - 1; i >= 0; i-- {
		node := t.nodes[i]
		services := node.Runtime.Snapshot()
		for j := len(services) - 1; j >= 0; j-- {
			state := services[j].State
			if state == ResourceServiceStopped || state == ResourceServiceRegistered {
				continue
			}
			if err := node.Runtime.Transition(services[j].Descriptor.ServiceID, ResourceServiceStopped); err != nil {
				return ErrProductionTopology
			}
		}
	}
	return nil
}

type MultiProviderResourceDiscovery struct {
	Sources []ResourceDiscovery
}

func (d MultiProviderResourceDiscovery) DiscoverResources(ctx context.Context, req ResourceDiscoveryRequest) ([]ResourceEndpoint, error) {
	if len(d.Sources) < 2 {
		return nil, ErrProductionTopology
	}
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	requested := make(map[ResourceCapability]struct{}, len(req.Capabilities))
	for _, capability := range req.Capabilities {
		capability = ResourceCapability(strings.ToLower(strings.TrimSpace(string(capability))))
		if !validResourceCapability(capability) {
			return nil, ErrProductionTopology
		}
		requested[capability] = struct{}{}
	}
	if len(requested) == 0 {
		return nil, ErrProductionTopology
	}

	merged := make([]ResourceEndpoint, 0)
	seen := make(map[string]struct{})
	succeeded := 0
	for _, source := range d.Sources {
		if source == nil {
			continue
		}
		endpoints, err := source.DiscoverResources(ctx, req)
		if err != nil {
			if ctx.Err() != nil {
				return nil, ctx.Err()
			}
			continue
		}
		succeeded++
		for _, endpoint := range endpoints {
			if !validProductionDiscoveredEndpoint(endpoint, requested, req.IncludeDegraded) {
				continue
			}
			key := strings.ToLower(string(endpoint.Capability) + "\x00" + endpoint.ProviderID + "\x00" + endpoint.NodeID + "\x00" + endpoint.ServiceID)
			if _, exists := seen[key]; exists {
				continue
			}
			seen[key] = struct{}{}
			merged = append(merged, endpoint)
		}
	}
	if succeeded == 0 {
		return nil, ErrProductionTopology
	}
	sort.SliceStable(merged, func(i, j int) bool {
		if merged[i].Capability != merged[j].Capability {
			return merged[i].Capability < merged[j].Capability
		}
		if merged[i].Priority != merged[j].Priority {
			return merged[i].Priority < merged[j].Priority
		}
		if !strings.EqualFold(merged[i].ProviderID, merged[j].ProviderID) {
			return strings.ToLower(merged[i].ProviderID) < strings.ToLower(merged[j].ProviderID)
		}
		if !strings.EqualFold(merged[i].NodeID, merged[j].NodeID) {
			return strings.ToLower(merged[i].NodeID) < strings.ToLower(merged[j].NodeID)
		}
		return strings.ToLower(merged[i].ServiceID) < strings.ToLower(merged[j].ServiceID)
	})
	return merged, nil
}

func validProductionDiscoveredEndpoint(endpoint ResourceEndpoint, requested map[ResourceCapability]struct{}, includeDegraded bool) bool {
	if strings.TrimSpace(endpoint.ProviderID) == "" || strings.TrimSpace(endpoint.NodeID) == "" || strings.TrimSpace(endpoint.ServiceID) == "" {
		return false
	}
	if !validResourceCapability(endpoint.Capability) {
		return false
	}
	if _, ok := requested[endpoint.Capability]; !ok {
		return false
	}
	if endpoint.State != ResourceServiceRunning && !(includeDegraded && endpoint.State == ResourceServiceDegraded) {
		return false
	}
	if strings.TrimSpace(endpoint.Endpoint) == "" && endpoint.Source == nil {
		return false
	}
	return true
}

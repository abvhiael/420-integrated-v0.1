package storage

import (
	"context"
	"errors"
	"sort"
	"strings"
	"time"
)

var ErrDeveloperDiscovery = errors.New("developer resource discovery failure")

const DefaultDeveloperDiscoveryMaxResults uint32 = 64

type DeveloperDiscoveryRequest struct {
	Version         string               `json:"version"`
	Capabilities    []ResourceCapability `json:"capabilities"`
	IncludeDegraded bool                 `json:"include_degraded"`
	MaxResults      uint32               `json:"max_results,omitempty"`
}

type DeveloperResourceDescriptor struct {
	ProviderID    string                `json:"provider_id"`
	NodeID        string                `json:"node_id"`
	ServiceID     string                `json:"service_id"`
	Capability    ResourceCapability    `json:"capability"`
	Priority      uint32                `json:"priority"`
	Endpoint      string                `json:"endpoint,omitempty"`
	State         ResourceServiceState  `json:"state"`
	Health        ResourceServiceHealth `json:"health"`
	Authoritative bool                  `json:"authoritative"`
}

type DeveloperDiscoveryResult struct {
	Version       string                        `json:"version"`
	Authoritative bool                          `json:"authoritative"`
	Resources     []DeveloperResourceDescriptor `json:"resources"`
}

type DeveloperResourceStatus struct {
	Version       string                     `json:"version"`
	Authoritative bool                       `json:"authoritative"`
	ProviderID    string                     `json:"provider_id"`
	NodeID        string                     `json:"node_id"`
	Ready         bool                       `json:"ready"`
	Degraded      bool                       `json:"degraded"`
	ObservedAt    time.Time                  `json:"observed_at"`
	Services      []DeveloperServiceStatus   `json:"services"`
	Capabilities  []ResourceCapabilityStatus `json:"capabilities"`
}

type DeveloperServiceStatus struct {
	ProviderID   string                `json:"provider_id"`
	NodeID       string                `json:"node_id"`
	ServiceID    string                `json:"service_id"`
	State        ResourceServiceState  `json:"state"`
	Health       ResourceServiceHealth `json:"health"`
	Capabilities []ResourceCapability  `json:"capabilities"`
}

type DeveloperResourceDirectory struct {
	Discovery ResourceDiscovery
	Runtime   *ResourceNetworkRuntime
}

func (d DeveloperResourceDirectory) Discover(ctx context.Context, req DeveloperDiscoveryRequest) (DeveloperDiscoveryResult, error) {
	if d.Discovery == nil {
		return DeveloperDiscoveryResult{}, ErrDeveloperDiscovery
	}
	if err := ctx.Err(); err != nil {
		return DeveloperDiscoveryResult{}, err
	}
	version := strings.TrimSpace(req.Version)
	if version == "" {
		version = DeveloperAPIVersion
	}
	if version != DeveloperAPIVersion || len(req.Capabilities) == 0 {
		return DeveloperDiscoveryResult{}, ErrDeveloperDiscovery
	}

	seen := make(map[ResourceCapability]struct{}, len(req.Capabilities))
	capabilities := make([]ResourceCapability, 0, len(req.Capabilities))
	for _, capability := range req.Capabilities {
		capability = ResourceCapability(strings.ToLower(strings.TrimSpace(string(capability))))
		if !validResourceCapability(capability) {
			return DeveloperDiscoveryResult{}, ErrDeveloperDiscovery
		}
		if _, ok := seen[capability]; ok {
			continue
		}
		seen[capability] = struct{}{}
		capabilities = append(capabilities, capability)
	}
	sort.Slice(capabilities, func(i, j int) bool { return capabilities[i] < capabilities[j] })

	maxResults := req.MaxResults
	if maxResults == 0 {
		maxResults = DefaultDeveloperDiscoveryMaxResults
	}
	if maxResults > DefaultDeveloperDiscoveryMaxResults {
		return DeveloperDiscoveryResult{}, ErrDeveloperDiscovery
	}

	endpoints, err := d.Discovery.DiscoverResources(ctx, ResourceDiscoveryRequest{
		Capabilities: capabilities,
		IncludeDegraded: req.IncludeDegraded,
	})
	if err != nil {
		return DeveloperDiscoveryResult{}, err
	}

	resources := make([]DeveloperResourceDescriptor, 0, len(endpoints))
	for _, endpoint := range endpoints {
		providerID := strings.TrimSpace(endpoint.ProviderID)
		nodeID := strings.TrimSpace(endpoint.NodeID)
		serviceID := strings.TrimSpace(endpoint.ServiceID)
		publicEndpoint := strings.TrimSpace(endpoint.Endpoint)
		if providerID == "" || nodeID == "" || serviceID == "" || !validResourceCapability(endpoint.Capability) {
			return DeveloperDiscoveryResult{}, ErrDeveloperDiscovery
		}
		if endpoint.State != ResourceServiceRunning && endpoint.State != ResourceServiceDegraded {
			return DeveloperDiscoveryResult{}, ErrDeveloperDiscovery
		}
		if endpoint.State == ResourceServiceDegraded && !req.IncludeDegraded {
			continue
		}
		resources = append(resources, DeveloperResourceDescriptor{
			ProviderID: providerID,
			NodeID: nodeID,
			ServiceID: serviceID,
			Capability: endpoint.Capability,
			Priority: endpoint.Priority,
			Endpoint: publicEndpoint,
			State: endpoint.State,
			Health: resourceHealthForState(endpoint.State),
			Authoritative: false,
		})
	}

	sort.SliceStable(resources, func(i, j int) bool {
		if resources[i].Capability != resources[j].Capability {
			return resources[i].Capability < resources[j].Capability
		}
		if resources[i].Priority != resources[j].Priority {
			return resources[i].Priority < resources[j].Priority
		}
		if !strings.EqualFold(resources[i].ProviderID, resources[j].ProviderID) {
			return strings.ToLower(resources[i].ProviderID) < strings.ToLower(resources[j].ProviderID)
		}
		if !strings.EqualFold(resources[i].NodeID, resources[j].NodeID) {
			return strings.ToLower(resources[i].NodeID) < strings.ToLower(resources[j].NodeID)
		}
		return strings.ToLower(resources[i].ServiceID) < strings.ToLower(resources[j].ServiceID)
	})
	if uint32(len(resources)) > maxResults {
		resources = resources[:maxResults]
	}
	return DeveloperDiscoveryResult{Version: DeveloperAPIVersion, Authoritative: false, Resources: resources}, nil
}

func (d DeveloperResourceDirectory) Status(now time.Time) (DeveloperResourceStatus, error) {
	if d.Runtime == nil {
		return DeveloperResourceStatus{}, ErrDeveloperDiscovery
	}
	status := d.Runtime.Status(now)
	services := make([]DeveloperServiceStatus, 0, len(status.Services))
	for _, service := range status.Services {
		services = append(services, DeveloperServiceStatus{
			ProviderID: service.ProviderID,
			NodeID: service.NodeID,
			ServiceID: service.ServiceID,
			State: service.State,
			Health: service.Health,
			Capabilities: append([]ResourceCapability(nil), service.Capabilities...),
		})
	}
	capabilities := append([]ResourceCapabilityStatus(nil), status.Capabilities...)
	return DeveloperResourceStatus{
		Version: DeveloperAPIVersion,
		Authoritative: false,
		ProviderID: status.ProviderID,
		NodeID: status.NodeID,
		Ready: status.Ready,
		Degraded: status.Degraded,
		ObservedAt: status.ObservedAt,
		Services: services,
		Capabilities: capabilities,
	}, nil
}

package storage

import (
	"context"
	"errors"
	"sort"
	"strings"
	"sync"
	"time"
)

var ErrResourceObservation = errors.New("resource network observation failure")

type ResourceServiceHealth string

const (
	ResourceHealthHealthy  ResourceServiceHealth = "healthy"
	ResourceHealthDegraded ResourceServiceHealth = "degraded"
	ResourceHealthPending  ResourceServiceHealth = "pending"
	ResourceHealthStopped  ResourceServiceHealth = "stopped"
	ResourceHealthFailed   ResourceServiceHealth = "failed"
)

type ResourceServiceStatus struct {
	ProviderID   string               `json:"provider_id"`
	NodeID       string               `json:"node_id"`
	ServiceID    string               `json:"service_id"`
	State        ResourceServiceState `json:"state"`
	Health       ResourceServiceHealth `json:"health"`
	Capabilities []ResourceCapability `json:"capabilities"`
}

type ResourceCapabilityStatus struct {
	Capability ResourceCapability `json:"capability"`
	Running    uint64             `json:"running"`
	Degraded   uint64             `json:"degraded"`
	Unavailable uint64            `json:"unavailable"`
}

type ResourceNetworkStatus struct {
	ProviderID   string                     `json:"provider_id"`
	NodeID       string                     `json:"node_id"`
	Ready        bool                       `json:"ready"`
	Degraded     bool                       `json:"degraded"`
	ObservedAt   time.Time                  `json:"observed_at"`
	Services     []ResourceServiceStatus    `json:"services"`
	Capabilities []ResourceCapabilityStatus `json:"capabilities"`
}

type ResourceObservationKind string

const (
	ResourceObservationRequest ResourceObservationKind = "request"
	ResourceObservationSuccess ResourceObservationKind = "success"
	ResourceObservationFailure ResourceObservationKind = "failure"
)

type ResourceObservation struct {
	ServiceID  string
	Capability ResourceCapability
	Kind       ResourceObservationKind
	Duration   time.Duration
	Bytes      uint64
}

type ResourceObservationMetrics struct {
	Requests        uint64
	Successes       uint64
	Failures        uint64
	ResponseBytes   uint64
	CumulativeNanos uint64
}

type ResourceObserver interface {
	ObserveResource(context.Context, ResourceObservation)
}

type ResourceMetrics struct {
	mu        sync.RWMutex
	byService map[string]ResourceObservationMetrics
}

func NewResourceMetrics() *ResourceMetrics {
	return &ResourceMetrics{byService: make(map[string]ResourceObservationMetrics)}
}

func (m *ResourceMetrics) ObserveResource(_ context.Context, observation ResourceObservation) {
	if m == nil {
		return
	}
	serviceID := strings.ToLower(strings.TrimSpace(observation.ServiceID))
	if serviceID == "" || !validResourceCapability(observation.Capability) {
		return
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	metrics := m.byService[serviceID]
	switch observation.Kind {
	case ResourceObservationRequest:
		metrics.Requests++
	case ResourceObservationSuccess:
		metrics.Successes++
		metrics.ResponseBytes += observation.Bytes
		if observation.Duration > 0 {
			metrics.CumulativeNanos += uint64(observation.Duration)
		}
	case ResourceObservationFailure:
		metrics.Failures++
		if observation.Duration > 0 {
			metrics.CumulativeNanos += uint64(observation.Duration)
		}
	default:
		return
	}
	m.byService[serviceID] = metrics
}

func (m *ResourceMetrics) Snapshot() map[string]ResourceObservationMetrics {
	if m == nil {
		return nil
	}
	m.mu.RLock()
	defer m.mu.RUnlock()
	out := make(map[string]ResourceObservationMetrics, len(m.byService))
	for key, value := range m.byService {
		out[key] = value
	}
	return out
}

func (r *ResourceNetworkRuntime) Status(now time.Time) ResourceNetworkStatus {
	if r == nil {
		return ResourceNetworkStatus{}
	}
	if now.IsZero() {
		now = time.Now().UTC()
	} else {
		now = now.UTC()
	}

	r.mu.RLock()
	providerID := r.providerID
	nodeID := r.nodeID
	r.mu.RUnlock()

	snapshots := r.Snapshot()
	status := ResourceNetworkStatus{
		ProviderID: providerID,
		NodeID:     nodeID,
		Ready:      true,
		ObservedAt: now,
		Services:   make([]ResourceServiceStatus, 0, len(snapshots)),
	}
	capabilityCounts := make(map[ResourceCapability]*ResourceCapabilityStatus)
	for _, capability := range []ResourceCapability{
		ResourceCapabilityStore,
		ResourceCapabilityRepair,
		ResourceCapabilityCache,
		ResourceCapabilityGateway,
		ResourceCapabilityRelay,
	} {
		entry := &ResourceCapabilityStatus{Capability: capability}
		capabilityCounts[capability] = entry
	}

	for _, snapshot := range snapshots {
		health := resourceHealthForState(snapshot.State)
		serviceStatus := ResourceServiceStatus{
			ProviderID: snapshot.Descriptor.ProviderID,
			NodeID: snapshot.Descriptor.NodeID,
			ServiceID: snapshot.Descriptor.ServiceID,
			State: snapshot.State,
			Health: health,
			Capabilities: append([]ResourceCapability(nil), snapshot.Descriptor.Capabilities...),
		}
		status.Services = append(status.Services, serviceStatus)
		if health == ResourceHealthDegraded {
			status.Degraded = true
		}
		if health == ResourceHealthFailed {
			status.Ready = false
		}
		for _, capability := range snapshot.Descriptor.Capabilities {
			entry := capabilityCounts[capability]
			if entry == nil {
				continue
			}
			switch snapshot.State {
			case ResourceServiceRunning:
				entry.Running++
			case ResourceServiceDegraded:
				entry.Degraded++
			default:
				entry.Unavailable++
			}
		}
	}

	status.Capabilities = make([]ResourceCapabilityStatus, 0, len(capabilityCounts))
	for _, capability := range []ResourceCapability{
		ResourceCapabilityStore,
		ResourceCapabilityRepair,
		ResourceCapabilityCache,
		ResourceCapabilityGateway,
		ResourceCapabilityRelay,
	} {
		entry := capabilityCounts[capability]
		if entry.Running == 0 && entry.Degraded == 0 && entry.Unavailable == 0 {
			continue
		}
		status.Capabilities = append(status.Capabilities, *entry)
	}
	sort.Slice(status.Services, func(i, j int) bool {
		return strings.ToLower(status.Services[i].ServiceID) < strings.ToLower(status.Services[j].ServiceID)
	})
	return status
}

func resourceHealthForState(state ResourceServiceState) ResourceServiceHealth {
	switch state {
	case ResourceServiceRunning:
		return ResourceHealthHealthy
	case ResourceServiceDegraded:
		return ResourceHealthDegraded
	case ResourceServiceRegistered, ResourceServiceStarting:
		return ResourceHealthPending
	case ResourceServiceStopped:
		return ResourceHealthStopped
	case ResourceServiceFailed:
		return ResourceHealthFailed
	default:
		return ResourceHealthFailed
	}
}

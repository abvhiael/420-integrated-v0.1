package storage

import (
	"context"
	"errors"
	"sort"
	"strings"
)

var ErrResourceAccounting = errors.New("resource accounting boundary failure")

type ResourceEconomicState string

const (
	ResourceEconomicPending   ResourceEconomicState = "pending"
	ResourceEconomicReserved  ResourceEconomicState = "reserved"
	ResourceEconomicFunded    ResourceEconomicState = "funded"
	ResourceEconomicSettled   ResourceEconomicState = "settled"
	ResourceEconomicCancelled ResourceEconomicState = "cancelled"
)

type ResourceAccountingQuery struct {
	ServiceID  string
	Capability ResourceCapability
	ReferenceID string
}

type ResourceAccountingSnapshot struct {
	ProviderID   string               `json:"provider_id"`
	NodeID       string               `json:"node_id"`
	ServiceID    string               `json:"service_id"`
	Capability   ResourceCapability   `json:"capability"`
	ReferenceID  string               `json:"reference_id"`
	SettlementID string               `json:"settlement_id,omitempty"`
	State        ResourceEconomicState `json:"state"`
	Amount420    string               `json:"amount_420,omitempty"`
}

type ResourceAccountingReader interface {
	ReadResourceAccounting(context.Context, ResourceAccountingQuery) (ResourceAccountingSnapshot, error)
}

type ResourceAccountingAdapter struct {
	Runtime *ResourceNetworkRuntime
	Reader  ResourceAccountingReader
}

func (a ResourceAccountingAdapter) Read(ctx context.Context, query ResourceAccountingQuery) (ResourceAccountingSnapshot, error) {
	if a.Runtime == nil || a.Reader == nil {
		return ResourceAccountingSnapshot{}, ErrResourceAccounting
	}
	if err := ctx.Err(); err != nil {
		return ResourceAccountingSnapshot{}, err
	}
	query.ServiceID = strings.TrimSpace(query.ServiceID)
	query.ReferenceID = strings.TrimSpace(query.ReferenceID)
	if query.ServiceID == "" || query.ReferenceID == "" || !resourceEconomicCapability(query.Capability) {
		return ResourceAccountingSnapshot{}, ErrResourceAccounting
	}
	service, ok := a.Runtime.serviceForAccounting(query.ServiceID, query.Capability)
	if !ok {
		return ResourceAccountingSnapshot{}, ErrResourceAccounting
	}
	snapshot, err := a.Reader.ReadResourceAccounting(ctx, query)
	if err != nil {
		return ResourceAccountingSnapshot{}, err
	}
	if err := validateResourceAccountingSnapshot(service, query, snapshot); err != nil {
		return ResourceAccountingSnapshot{}, err
	}
	return snapshot, nil
}

func (r *ResourceNetworkRuntime) serviceForAccounting(serviceID string, capability ResourceCapability) (ResourceServiceSnapshot, bool) {
	if r == nil || !resourceEconomicCapability(capability) {
		return ResourceServiceSnapshot{}, false
	}
	key := strings.ToLower(strings.TrimSpace(serviceID))
	r.mu.RLock()
	service, ok := r.services[key]
	r.mu.RUnlock()
	if !ok || (service.State != ResourceServiceRunning && service.State != ResourceServiceDegraded) {
		return ResourceServiceSnapshot{}, false
	}
	for _, candidate := range service.Descriptor.Capabilities {
		if candidate == capability {
			service.Descriptor.Capabilities = append([]ResourceCapability(nil), service.Descriptor.Capabilities...)
			return service, true
		}
	}
	return ResourceServiceSnapshot{}, false
}

func resourceEconomicCapability(capability ResourceCapability) bool {
	switch capability {
	case ResourceCapabilityStore, ResourceCapabilityRepair, ResourceCapabilityCache, ResourceCapabilityRelay:
		return true
	default:
		return false
	}
}

func validResourceEconomicState(state ResourceEconomicState) bool {
	switch state {
	case ResourceEconomicPending, ResourceEconomicReserved, ResourceEconomicFunded, ResourceEconomicSettled, ResourceEconomicCancelled:
		return true
	default:
		return false
	}
}

func validateResourceAccountingSnapshot(service ResourceServiceSnapshot, query ResourceAccountingQuery, snapshot ResourceAccountingSnapshot) error {
	snapshot.ProviderID = strings.TrimSpace(snapshot.ProviderID)
	snapshot.NodeID = strings.TrimSpace(snapshot.NodeID)
	snapshot.ServiceID = strings.TrimSpace(snapshot.ServiceID)
	snapshot.ReferenceID = strings.TrimSpace(snapshot.ReferenceID)
	snapshot.SettlementID = strings.TrimSpace(snapshot.SettlementID)
	snapshot.Amount420 = strings.TrimSpace(snapshot.Amount420)
	if !strings.EqualFold(snapshot.ProviderID, service.Descriptor.ProviderID) ||
		!strings.EqualFold(snapshot.NodeID, service.Descriptor.NodeID) ||
		!strings.EqualFold(snapshot.ServiceID, service.Descriptor.ServiceID) ||
		snapshot.Capability != query.Capability ||
		!strings.EqualFold(snapshot.ReferenceID, query.ReferenceID) ||
		!validResourceEconomicState(snapshot.State) {
		return ErrResourceAccounting
	}
	if snapshot.State == ResourceEconomicSettled && snapshot.SettlementID == "" {
		return ErrResourceAccounting
	}
	return nil
}

type ResourceAccountingBatchAdapter struct {
	Adapter ResourceAccountingAdapter
}

func (b ResourceAccountingBatchAdapter) ReadAll(ctx context.Context, queries []ResourceAccountingQuery) ([]ResourceAccountingSnapshot, error) {
	if len(queries) == 0 {
		return nil, nil
	}
	out := make([]ResourceAccountingSnapshot, 0, len(queries))
	for _, query := range queries {
		if err := ctx.Err(); err != nil {
			return nil, err
		}
		snapshot, err := b.Adapter.Read(ctx, query)
		if err != nil {
			return nil, err
		}
		out = append(out, snapshot)
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].Capability != out[j].Capability {
			return out[i].Capability < out[j].Capability
		}
		if strings.ToLower(out[i].ServiceID) != strings.ToLower(out[j].ServiceID) {
			return strings.ToLower(out[i].ServiceID) < strings.ToLower(out[j].ServiceID)
		}
		return strings.ToLower(out[i].ReferenceID) < strings.ToLower(out[j].ReferenceID)
	})
	return out, nil
}

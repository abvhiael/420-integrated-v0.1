package storage

import (
	"errors"
	"sort"
	"strings"
	"sync"
)

var ErrResourceTrust = errors.New("resource network trust boundary failure")

type ResourceTrustDomain string

const (
	ResourceTrustStorage   ResourceTrustDomain = "storage"
	ResourceTrustDelivery  ResourceTrustDomain = "delivery"
	ResourceTrustEconomic  ResourceTrustDomain = "economic"
	ResourceTrustControl   ResourceTrustDomain = "control"
)

type ResourceAuthority string

const (
	ResourceAuthorityDataRead      ResourceAuthority = "data.read"
	ResourceAuthorityDataWrite     ResourceAuthority = "data.write"
	ResourceAuthorityDiscover      ResourceAuthority = "discover"
	ResourceAuthorityServe         ResourceAuthority = "serve"
	ResourceAuthoritySettlementRead ResourceAuthority = "settlement.read"
	ResourceAuthorityLifecycle     ResourceAuthority = "lifecycle"
	ResourceAuthorityCredentialRead ResourceAuthority = "credential.read"
)

type ResourceTrustGrant struct {
	ServiceID   string            `json:"service_id"`
	Domain      ResourceTrustDomain `json:"domain"`
	Authorities []ResourceAuthority `json:"authorities"`
}

type ResourceTrustSnapshot struct {
	ServiceID   string              `json:"service_id"`
	Domain      ResourceTrustDomain `json:"domain"`
	Authorities []ResourceAuthority `json:"authorities"`
}

type ResourceTrustRegistry struct {
	runtime *ResourceNetworkRuntime
	mu      sync.RWMutex
	grants  map[string]ResourceTrustGrant
}

func NewResourceTrustRegistry(runtime *ResourceNetworkRuntime) (*ResourceTrustRegistry, error) {
	if runtime == nil {
		return nil, ErrResourceTrust
	}
	return &ResourceTrustRegistry{runtime: runtime, grants: make(map[string]ResourceTrustGrant)}, nil
}

func (r *ResourceTrustRegistry) Grant(grant ResourceTrustGrant) error {
	if r == nil || r.runtime == nil {
		return ErrResourceTrust
	}
	grant.ServiceID = strings.TrimSpace(grant.ServiceID)
	if grant.ServiceID == "" || !validResourceTrustDomain(grant.Domain) || len(grant.Authorities) == 0 || !r.hasService(grant.ServiceID) {
		return ErrResourceTrust
	}
	authorities := make([]ResourceAuthority, 0, len(grant.Authorities))
	seen := make(map[ResourceAuthority]struct{}, len(grant.Authorities))
	for _, authority := range grant.Authorities {
		authority = ResourceAuthority(strings.ToLower(strings.TrimSpace(string(authority))))
		if !validResourceAuthority(authority) || !authorityAllowedInDomain(authority, grant.Domain) {
			return ErrResourceTrust
		}
		if _, ok := seen[authority]; ok {
			continue
		}
		seen[authority] = struct{}{}
		authorities = append(authorities, authority)
	}
	sort.Slice(authorities, func(i, j int) bool { return authorities[i] < authorities[j] })
	grant.Authorities = authorities
	key := strings.ToLower(grant.ServiceID)
	r.mu.Lock()
	defer r.mu.Unlock()
	if _, exists := r.grants[key]; exists {
		return ErrResourceTrust
	}
	r.grants[key] = grant
	return nil
}

func (r *ResourceTrustRegistry) Authorized(serviceID string, authority ResourceAuthority) bool {
	if r == nil || !validResourceAuthority(authority) {
		return false
	}
	key := strings.ToLower(strings.TrimSpace(serviceID))
	if key == "" {
		return false
	}
	r.mu.RLock()
	grant, ok := r.grants[key]
	r.mu.RUnlock()
	if !ok {
		return false
	}
	for _, candidate := range grant.Authorities {
		if candidate == authority {
			return true
		}
	}
	return false
}

func (r *ResourceTrustRegistry) Snapshot() []ResourceTrustSnapshot {
	if r == nil {
		return nil
	}
	r.mu.RLock()
	out := make([]ResourceTrustSnapshot, 0, len(r.grants))
	for _, grant := range r.grants {
		out = append(out, ResourceTrustSnapshot{
			ServiceID: grant.ServiceID,
			Domain: grant.Domain,
			Authorities: append([]ResourceAuthority(nil), grant.Authorities...),
		})
	}
	r.mu.RUnlock()
	sort.Slice(out, func(i, j int) bool {
		if out[i].Domain != out[j].Domain {
			return out[i].Domain < out[j].Domain
		}
		return strings.ToLower(out[i].ServiceID) < strings.ToLower(out[j].ServiceID)
	})
	return out
}

func (r *ResourceTrustRegistry) hasService(serviceID string) bool {
	for _, service := range r.runtime.Snapshot() {
		if strings.EqualFold(service.Descriptor.ServiceID, serviceID) {
			return true
		}
	}
	return false
}

func validResourceTrustDomain(domain ResourceTrustDomain) bool {
	switch domain {
	case ResourceTrustStorage, ResourceTrustDelivery, ResourceTrustEconomic, ResourceTrustControl:
		return true
	default:
		return false
	}
}

func validResourceAuthority(authority ResourceAuthority) bool {
	switch authority {
	case ResourceAuthorityDataRead, ResourceAuthorityDataWrite, ResourceAuthorityDiscover, ResourceAuthorityServe,
		ResourceAuthoritySettlementRead, ResourceAuthorityLifecycle, ResourceAuthorityCredentialRead:
		return true
	default:
		return false
	}
}

func authorityAllowedInDomain(authority ResourceAuthority, domain ResourceTrustDomain) bool {
	switch domain {
	case ResourceTrustStorage:
		return authority == ResourceAuthorityDataRead || authority == ResourceAuthorityDataWrite
	case ResourceTrustDelivery:
		return authority == ResourceAuthorityDataRead || authority == ResourceAuthorityDiscover || authority == ResourceAuthorityServe
	case ResourceTrustEconomic:
		return authority == ResourceAuthoritySettlementRead
	case ResourceTrustControl:
		return authority == ResourceAuthorityLifecycle || authority == ResourceAuthorityCredentialRead
	default:
		return false
	}
}

package storage

import (
	"errors"
	"sort"
	"strings"
	"sync"
)

var ErrResourceConfig = errors.New("resource network configuration failure")

type ResourceConfigScope string

const (
	ResourceConfigShared  ResourceConfigScope = "shared"
	ResourceConfigService ResourceConfigScope = "service"
)

type ResourceConfigEntry struct {
	Key       string              `json:"key"`
	Value     string              `json:"value,omitempty"`
	Scope     ResourceConfigScope `json:"scope"`
	ServiceID string              `json:"service_id,omitempty"`
	Secret    bool                `json:"secret"`
}

type ResourceConfigView struct {
	Shared  map[string]string `json:"shared"`
	Service map[string]string `json:"service"`
}

type ResourceConfigStore struct {
	runtime *ResourceNetworkRuntime
	mu      sync.RWMutex
	entries map[string]ResourceConfigEntry
}

func NewResourceConfigStore(runtime *ResourceNetworkRuntime) (*ResourceConfigStore, error) {
	if runtime == nil {
		return nil, ErrResourceConfig
	}
	return &ResourceConfigStore{runtime: runtime, entries: make(map[string]ResourceConfigEntry)}, nil
}

func (s *ResourceConfigStore) Set(entry ResourceConfigEntry) error {
	if s == nil || s.runtime == nil {
		return ErrResourceConfig
	}
	entry.Key = strings.TrimSpace(entry.Key)
	entry.ServiceID = strings.TrimSpace(entry.ServiceID)
	if entry.Key == "" || (entry.Scope != ResourceConfigShared && entry.Scope != ResourceConfigService) {
		return ErrResourceConfig
	}
	if entry.Scope == ResourceConfigShared {
		if entry.ServiceID != "" || entry.Secret {
			return ErrResourceConfig
		}
	} else {
		if entry.ServiceID == "" || !s.hasService(entry.ServiceID) {
			return ErrResourceConfig
		}
	}
	key := configEntryKey(entry.Scope, entry.ServiceID, entry.Key)
	s.mu.Lock()
	s.entries[key] = entry
	s.mu.Unlock()
	return nil
}

func (s *ResourceConfigStore) View(serviceID string) (ResourceConfigView, error) {
	if s == nil || s.runtime == nil {
		return ResourceConfigView{}, ErrResourceConfig
	}
	serviceID = strings.TrimSpace(serviceID)
	if serviceID == "" || !s.hasService(serviceID) {
		return ResourceConfigView{}, ErrResourceConfig
	}
	view := ResourceConfigView{Shared: map[string]string{}, Service: map[string]string{}}
	s.mu.RLock()
	for _, entry := range s.entries {
		switch entry.Scope {
		case ResourceConfigShared:
			view.Shared[entry.Key] = entry.Value
		case ResourceConfigService:
			if strings.EqualFold(entry.ServiceID, serviceID) {
				view.Service[entry.Key] = entry.Value
			}
		}
	}
	s.mu.RUnlock()
	return view, nil
}

func (s *ResourceConfigStore) Snapshot() []ResourceConfigEntry {
	if s == nil {
		return nil
	}
	s.mu.RLock()
	out := make([]ResourceConfigEntry, 0, len(s.entries))
	for _, entry := range s.entries {
		copyEntry := entry
		if copyEntry.Secret {
			copyEntry.Value = ""
		}
		out = append(out, copyEntry)
	}
	s.mu.RUnlock()
	sort.Slice(out, func(i, j int) bool {
		leftRank := configScopeRank(out[i].Scope)
		rightRank := configScopeRank(out[j].Scope)
		if leftRank != rightRank {
			return leftRank < rightRank
		}
		leftService := strings.ToLower(out[i].ServiceID)
		rightService := strings.ToLower(out[j].ServiceID)
		if leftService != rightService {
			return leftService < rightService
		}
		return strings.ToLower(out[i].Key) < strings.ToLower(out[j].Key)
	})
	return out
}

func (s *ResourceConfigStore) hasService(serviceID string) bool {
	for _, service := range s.runtime.Snapshot() {
		if strings.EqualFold(service.Descriptor.ServiceID, serviceID) {
			return true
		}
	}
	return false
}

func configEntryKey(scope ResourceConfigScope, serviceID, key string) string {
	return strings.ToLower(string(scope) + "\x00" + strings.TrimSpace(serviceID) + "\x00" + strings.TrimSpace(key))
}

func configScopeRank(scope ResourceConfigScope) int {
	switch scope {
	case ResourceConfigShared:
		return 0
	case ResourceConfigService:
		return 1
	default:
		return 2
	}
}

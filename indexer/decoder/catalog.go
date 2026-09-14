package decoder

import (
	"errors"
	"fmt"
	"sort"
	"strings"
	"sync"
)

var (
	ErrUnknownServiceVersion = errors.New("unknown service version")
	ErrUnknownImplementation = errors.New("unknown implementation")
	ErrInvalidVersionHistory = errors.New("invalid service version history")
)

// ServiceVersion is the rebuildable historical view of ProtocolRegistry.ServiceVersionPublished
// plus the optional Genesis-grade registration profile committed for the same service/version.
type ServiceVersion struct {
	ServiceID       string `json:"serviceId"`
	Version         uint32 `json:"version"`
	Implementation  string `json:"implementation"`
	CodeHash        string `json:"codeHash"`
	MetadataHash    string `json:"metadataHash"`
	ComponentType   uint8  `json:"componentType"`
	ManifestHash    string `json:"manifestHash"`
	DependencyRoot  string `json:"dependencyRoot"`
	InterfaceHash   string `json:"interfaceHash"`
	ActivatedBlock  uint64 `json:"activatedBlock"`
	ActivatedHash   string `json:"activatedHash"`
	DeprecatedBlock uint64 `json:"deprecatedBlock,omitempty"`
	Active          bool   `json:"active"`
}

// ServiceSummary is the Explorer-facing non-authoritative registry projection.
type ServiceSummary struct {
	ServiceID      string         `json:"serviceId"`
	LatestVersion  uint32         `json:"latestVersion"`
	ActiveVersion  uint32         `json:"activeVersion,omitempty"`
	Implementation string         `json:"implementation,omitempty"`
	Versions       []ServiceVersion `json:"versions"`
}

// VersionPublished is normalized from ProtocolRegistry.ServiceVersionPublished with canonical log provenance.
type VersionPublished struct {
	ServiceID      string
	Version        uint32
	Implementation string
	CodeHash       string
	MetadataHash   string
	Active         bool
	BlockNumber    uint64
	BlockHash      string
}

// ProfilePublished is normalized from ProtocolRegistry.ServiceRegistrationProfilePublished.
type ProfilePublished struct {
	ServiceID      string
	Version        uint32
	ComponentType  uint8
	ManifestHash   string
	DependencyRoot string
	InterfaceHash  string
}

// Catalog is a non-authoritative projection of ProtocolRegistry history.
// It is safe to rebuild from registry logs and cannot mutate ProtocolRegistry state.
type Catalog struct {
	mu      sync.RWMutex
	byKey   map[string]ServiceVersion
	byImpl  map[string][]string
}

func NewCatalog() *Catalog {
	return &Catalog{byKey: make(map[string]ServiceVersion), byImpl: make(map[string][]string)}
}

func serviceKey(serviceID string, version uint32) string {
	return fmt.Sprintf("%s@%d", strings.ToLower(serviceID), version)
}

func normalizeAddress(v string) string { return strings.ToLower(v) }

func (c *Catalog) ApplyVersion(ev VersionPublished) error {
	if ev.ServiceID == "" || ev.Version == 0 || ev.Implementation == "" || ev.BlockHash == "" { return ErrInvalidVersionHistory }
	c.mu.Lock(); defer c.mu.Unlock()
	key := serviceKey(ev.ServiceID, ev.Version)
	if existing, ok := c.byKey[key]; ok {
		if existing.Implementation != normalizeAddress(ev.Implementation) || existing.ActivatedBlock != ev.BlockNumber || existing.ActivatedHash != ev.BlockHash { return ErrInvalidVersionHistory }
		return nil
	}
	if ev.Version > 1 {
		if _, ok := c.byKey[serviceKey(ev.ServiceID, ev.Version-1)]; !ok { return ErrInvalidVersionHistory }
	}
	impl := normalizeAddress(ev.Implementation)
	record := ServiceVersion{ServiceID: strings.ToLower(ev.ServiceID), Version: ev.Version, Implementation: impl, CodeHash: ev.CodeHash, MetadataHash: ev.MetadataHash, ActivatedBlock: ev.BlockNumber, ActivatedHash: ev.BlockHash, Active: ev.Active}
	c.byKey[key] = record
	c.byImpl[impl] = append(c.byImpl[impl], key)
	sort.Slice(c.byImpl[impl], func(i, j int) bool { return c.byKey[c.byImpl[impl][i]].ActivatedBlock < c.byKey[c.byImpl[impl][j]].ActivatedBlock })
	return nil
}

func (c *Catalog) ApplyProfile(ev ProfilePublished) error {
	c.mu.Lock(); defer c.mu.Unlock()
	key := serviceKey(ev.ServiceID, ev.Version)
	record, ok := c.byKey[key]
	if !ok { return ErrUnknownServiceVersion }
	record.ComponentType = ev.ComponentType; record.ManifestHash = ev.ManifestHash; record.DependencyRoot = ev.DependencyRoot; record.InterfaceHash = ev.InterfaceHash
	c.byKey[key] = record
	return nil
}

func (c *Catalog) ApplyDeprecated(serviceID string, version uint32, blockNumber uint64) error {
	c.mu.Lock(); defer c.mu.Unlock()
	key := serviceKey(serviceID, version)
	record, ok := c.byKey[key]
	if !ok { return ErrUnknownServiceVersion }
	if blockNumber < record.ActivatedBlock { return ErrInvalidVersionHistory }
	record.Active = false; record.DeprecatedBlock = blockNumber; c.byKey[key] = record
	return nil
}

func (c *Catalog) Version(serviceID string, version uint32) (ServiceVersion, error) {
	c.mu.RLock(); defer c.mu.RUnlock()
	record, ok := c.byKey[serviceKey(serviceID, version)]
	if !ok { return ServiceVersion{}, ErrUnknownServiceVersion }
	return record, nil
}

func (c *Catalog) Service(serviceID string) (ServiceSummary, error) {
	c.mu.RLock(); defer c.mu.RUnlock()
	id := strings.ToLower(strings.TrimSpace(serviceID))
	versions := make([]ServiceVersion, 0)
	for _, record := range c.byKey { if record.ServiceID == id { versions = append(versions, record) } }
	if len(versions) == 0 { return ServiceSummary{}, ErrUnknownServiceVersion }
	sort.Slice(versions, func(i, j int) bool { return versions[i].Version < versions[j].Version })
	out := ServiceSummary{ServiceID: id, LatestVersion: versions[len(versions)-1].Version, Versions: versions}
	for i := len(versions)-1; i >= 0; i-- { if versions[i].Active { out.ActiveVersion = versions[i].Version; out.Implementation = versions[i].Implementation; break } }
	return out, nil
}

func (c *Catalog) Services() []ServiceSummary {
	c.mu.RLock()
	ids := map[string]struct{}{}
	for _, record := range c.byKey { ids[record.ServiceID] = struct{}{} }
	c.mu.RUnlock()
	out := make([]ServiceSummary, 0, len(ids))
	for id := range ids { if service, err := c.Service(id); err == nil { out = append(out, service) } }
	sort.Slice(out, func(i, j int) bool { return out[i].ServiceID < out[j].ServiceID })
	return out
}

func (c *Catalog) ResolveImplementationAt(implementation string, blockNumber uint64) (ServiceVersion, error) {
	c.mu.RLock(); defer c.mu.RUnlock()
	keys := c.byImpl[normalizeAddress(implementation)]
	if len(keys) == 0 { return ServiceVersion{}, ErrUnknownImplementation }
	var best ServiceVersion; found := false
	for _, key := range keys {
		record := c.byKey[key]
		if record.ActivatedBlock > blockNumber { continue }
		if record.DeprecatedBlock != 0 && blockNumber >= record.DeprecatedBlock { continue }
		if !found || record.ActivatedBlock > best.ActivatedBlock { best, found = record, true }
	}
	if !found { return ServiceVersion{}, ErrUnknownImplementation }
	return best, nil
}

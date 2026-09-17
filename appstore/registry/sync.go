package registry

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"strings"
	"sync"
)

var (
	ErrInvalidCanonicalRecord = errors.New("invalid canonical registry record")
	ErrVersionGap             = errors.New("registry version history gap")
	ErrConflictingCanonical   = errors.New("conflicting canonical registry record")
)

type VersionRecord struct {
	ServiceID      string `json:"serviceId"`
	Version        uint32 `json:"version"`
	Implementation string `json:"implementation"`
	CodeHash       string `json:"codeHash"`
	MetadataHash   string `json:"metadataHash"`
	ComponentType  uint8  `json:"componentType"`
	ManifestHash   string `json:"manifestHash"`
	DependencyRoot string `json:"dependencyRoot"`
	InterfaceHash  string `json:"interfaceHash"`
	Active         bool   `json:"active"`
	BlockNumber    uint64 `json:"blockNumber"`
	BlockHash      string `json:"blockHash"`
}

type Snapshot struct {
	ChainID         uint64          `json:"chainId"`
	RegistryAddress string          `json:"registryAddress"`
	FinalizedBlock  uint64          `json:"finalizedBlock"`
	Versions        []VersionRecord `json:"versions"`
}

type Source interface {
	Snapshot(context.Context) (Snapshot, error)
}

type Projection struct {
	mu       sync.RWMutex
	chainID  uint64
	registry string
	finalized uint64
	byKey    map[string]VersionRecord
}

func NewProjection(chainID uint64, registryAddress string) (*Projection, error) {
	registryAddress = strings.ToLower(strings.TrimSpace(registryAddress))
	if chainID == 0 || !validAddress(registryAddress) {
		return nil, ErrInvalidCanonicalRecord
	}
	return &Projection{chainID: chainID, registry: registryAddress, byKey: make(map[string]VersionRecord)}, nil
}

func key(serviceID string, version uint32) string {
	return fmt.Sprintf("%s@%d", strings.ToLower(strings.TrimSpace(serviceID)), version)
}

func validAddress(v string) bool {
	if len(v) != 42 || !strings.HasPrefix(v, "0x") { return false }
	for _, r := range v[2:] {
		if !(r >= '0' && r <= '9') && !(r >= 'a' && r <= 'f') && !(r >= 'A' && r <= 'F') { return false }
	}
	return true
}

func validHash(v string) bool {
	if len(v) != 66 || !strings.HasPrefix(v, "0x") { return false }
	for _, r := range v[2:] {
		if !(r >= '0' && r <= '9') && !(r >= 'a' && r <= 'f') && !(r >= 'A' && r <= 'F') { return false }
	}
	return true
}

func validateRecord(r VersionRecord) error {
	if strings.TrimSpace(r.ServiceID) == "" || r.Version == 0 || !validAddress(r.Implementation) || !validHash(r.CodeHash) || !validHash(r.MetadataHash) || r.BlockNumber == 0 || !validHash(r.BlockHash) {
		return ErrInvalidCanonicalRecord
	}
	if r.ComponentType != 0 {
		if !validHash(r.ManifestHash) || !validHash(r.DependencyRoot) || !validHash(r.InterfaceHash) {
			return ErrInvalidCanonicalRecord
		}
	}
	return nil
}

func sameCanonical(a, b VersionRecord) bool {
	return strings.EqualFold(a.ServiceID, b.ServiceID) && a.Version == b.Version && strings.EqualFold(a.Implementation, b.Implementation) && strings.EqualFold(a.CodeHash, b.CodeHash) && strings.EqualFold(a.MetadataHash, b.MetadataHash) && a.ComponentType == b.ComponentType && strings.EqualFold(a.ManifestHash, b.ManifestHash) && strings.EqualFold(a.DependencyRoot, b.DependencyRoot) && strings.EqualFold(a.InterfaceHash, b.InterfaceHash) && a.Active == b.Active && a.BlockNumber == b.BlockNumber && strings.EqualFold(a.BlockHash, b.BlockHash)
}

func (p *Projection) Apply(snapshot Snapshot) error {
	if snapshot.ChainID != p.chainID || !strings.EqualFold(snapshot.RegistryAddress, p.registry) || snapshot.FinalizedBlock < p.finalized {
		return ErrInvalidCanonicalRecord
	}
	versions := append([]VersionRecord(nil), snapshot.Versions...)
	sort.Slice(versions, func(i, j int) bool {
		if strings.EqualFold(versions[i].ServiceID, versions[j].ServiceID) { return versions[i].Version < versions[j].Version }
		return strings.ToLower(versions[i].ServiceID) < strings.ToLower(versions[j].ServiceID)
	})

	p.mu.Lock()
	defer p.mu.Unlock()
	staged := make(map[string]VersionRecord, len(p.byKey)+len(versions))
	for k, v := range p.byKey { staged[k] = v }
	for _, record := range versions {
		if err := validateRecord(record); err != nil { return err }
		k := key(record.ServiceID, record.Version)
		if existing, ok := staged[k]; ok {
			if !sameCanonical(existing, record) { return ErrConflictingCanonical }
			continue
		}
		if record.Version > 1 {
			if _, ok := staged[key(record.ServiceID, record.Version-1)]; !ok { return ErrVersionGap }
		}
		staged[k] = record
	}
	p.byKey = staged
	p.finalized = snapshot.FinalizedBlock
	return nil
}

func (p *Projection) Rebuild(snapshot Snapshot) error {
	p.mu.Lock()
	p.byKey = make(map[string]VersionRecord)
	p.finalized = 0
	p.mu.Unlock()
	return p.Apply(snapshot)
}

func (p *Projection) Version(serviceID string, version uint32) (VersionRecord, bool) {
	p.mu.RLock(); defer p.mu.RUnlock()
	record, ok := p.byKey[key(serviceID, version)]
	return record, ok
}

func (p *Projection) Service(serviceID string) []VersionRecord {
	p.mu.RLock(); defer p.mu.RUnlock()
	id := strings.ToLower(strings.TrimSpace(serviceID))
	out := make([]VersionRecord, 0)
	for _, record := range p.byKey { if strings.ToLower(record.ServiceID) == id { out = append(out, record) } }
	sort.Slice(out, func(i, j int) bool { return out[i].Version < out[j].Version })
	return out
}

func (p *Projection) FinalizedBlock() uint64 { p.mu.RLock(); defer p.mu.RUnlock(); return p.finalized }

func Sync(ctx context.Context, source Source, projection *Projection) error {
	if source == nil || projection == nil { return errors.New("registry source and projection are required") }
	snapshot, err := source.Snapshot(ctx)
	if err != nil { return fmt.Errorf("read canonical registry snapshot: %w", err) }
	if err := projection.Apply(snapshot); err != nil { return fmt.Errorf("apply canonical registry snapshot: %w", err) }
	return nil
}

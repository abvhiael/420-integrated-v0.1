package catalog

import (
	"context"
	"errors"
	"fmt"
	"os"
	"strings"
	"sync"
	"time"

	appregistry "github.com/420integrated/420-integrated/appstore/registry"
)

var (
	ErrStaleCanonicalSource = errors.New("appstore canonical source is behind persisted finality")
	ErrFinalizedConflict    = errors.New("appstore finalized catalogue history conflict")
	ErrCatalogueIdentity    = errors.New("appstore catalogue identity mismatch")
)

type Lifecycle struct {
	mu       sync.RWMutex
	store    *Store
	source   appregistry.Source
	chainID  uint64
	registry string
	doc      Document
	proj     *appregistry.Projection
	ready    bool
}

func NewLifecycle(store *Store, source appregistry.Source, chainID uint64, registryAddress string) (*Lifecycle, error) {
	registryAddress = strings.ToLower(strings.TrimSpace(registryAddress))
	if store == nil || source == nil || chainID == 0 || registryAddress == "" {
		return nil, ErrInvalidStore
	}
	if _, err := appregistry.NewProjection(chainID, registryAddress); err != nil {
		return nil, err
	}
	return &Lifecycle{
		store:    store,
		source:   source,
		chainID:  chainID,
		registry: registryAddress,
	}, nil
}

func (l *Lifecycle) Bootstrap(ctx context.Context) error {
	var persisted *Document
	doc, err := l.store.Load()
	switch {
	case err == nil:
		if err := l.validateIdentity(doc); err != nil {
			return err
		}
		persisted = &doc
	case errors.Is(err, os.ErrNotExist):
		// Missing local state is recoverable only from the canonical source.
	default:
		return fmt.Errorf("load persisted catalogue: %w", err)
	}

	snapshot, err := l.source.Snapshot(ctx)
	if err != nil {
		return fmt.Errorf("read canonical catalogue snapshot: %w", err)
	}
	fresh, err := RebuildFromSnapshot(snapshot)
	if err != nil {
		return fmt.Errorf("rebuild canonical catalogue: %w", err)
	}
	if err := l.validateIdentity(fresh); err != nil {
		return err
	}
	if persisted != nil {
		if err := validateTransition(*persisted, fresh); err != nil {
			return err
		}
	}
	if err := l.store.Save(fresh); err != nil {
		return fmt.Errorf("persist rebuilt catalogue: %w", err)
	}
	projection, err := RestoreProjection(fresh)
	if err != nil {
		return fmt.Errorf("restore rebuilt catalogue: %w", err)
	}
	l.swap(fresh, projection)
	return nil
}

func (l *Lifecycle) Run(ctx context.Context, interval time.Duration) error {
	if interval <= 0 {
		return ErrInvalidStore
	}
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return nil
		case <-ticker.C:
			if err := l.Refresh(ctx); err != nil {
				return err
			}
		}
	}
}

func (l *Lifecycle) Refresh(ctx context.Context) error {
	l.mu.RLock()
	if !l.ready {
		l.mu.RUnlock()
		return ErrInvalidStore
	}
	current := cloneDocument(l.doc)
	l.mu.RUnlock()

	snapshot, err := l.source.Snapshot(ctx)
	if err != nil {
		return fmt.Errorf("refresh canonical catalogue snapshot: %w", err)
	}
	fresh, err := RebuildFromSnapshot(snapshot)
	if err != nil {
		return fmt.Errorf("rebuild refreshed catalogue: %w", err)
	}
	if err := l.validateIdentity(fresh); err != nil {
		return err
	}
	if err := validateTransition(current, fresh); err != nil {
		return err
	}
	if err := l.store.Save(fresh); err != nil {
		return fmt.Errorf("persist refreshed catalogue: %w", err)
	}
	projection, err := RestoreProjection(fresh)
	if err != nil {
		return fmt.Errorf("restore refreshed catalogue: %w", err)
	}
	l.swap(fresh, projection)
	return nil
}

func (l *Lifecycle) Snapshot() (Document, bool) {
	l.mu.RLock()
	defer l.mu.RUnlock()
	if !l.ready {
		return Document{}, false
	}
	return cloneDocument(l.doc), true
}

func (l *Lifecycle) Projection() (*appregistry.Projection, bool) {
	l.mu.RLock()
	defer l.mu.RUnlock()
	if !l.ready {
		return nil, false
	}
	return l.proj, true
}

func (l *Lifecycle) validateIdentity(doc Document) error {
	if doc.ChainID != l.chainID || !strings.EqualFold(doc.RegistryAddress, l.registry) {
		return ErrCatalogueIdentity
	}
	return nil
}

func (l *Lifecycle) swap(doc Document, projection *appregistry.Projection) {
	l.mu.Lock()
	defer l.mu.Unlock()
	l.doc = cloneDocument(doc)
	l.proj = projection
	l.ready = true
}

func cloneDocument(doc Document) Document {
	out := doc
	out.Versions = append([]appregistry.VersionRecord(nil), doc.Versions...)
	return out
}

func validateTransition(previous, next Document) error {
	if previous.ChainID != next.ChainID || !strings.EqualFold(previous.RegistryAddress, next.RegistryAddress) {
		return ErrCatalogueIdentity
	}
	if next.FinalizedBlock < previous.FinalizedBlock {
		return ErrStaleCanonicalSource
	}

	nextByKey := make(map[string]appregistry.VersionRecord, len(next.Versions))
	for _, record := range next.Versions {
		nextByKey[versionKey(record)] = record
	}
	for _, old := range previous.Versions {
		current, ok := nextByKey[versionKey(old)]
		if !ok {
			return ErrFinalizedConflict
		}
		if !sameImmutableVersion(old, current) {
			return ErrFinalizedConflict
		}
		if previous.FinalizedBlock == next.FinalizedBlock && old.Active != current.Active {
			return ErrFinalizedConflict
		}
		if !old.Active && current.Active {
			return ErrFinalizedConflict
		}
	}
	return nil
}

func versionKey(record appregistry.VersionRecord) string {
	return fmt.Sprintf("%s@%d", strings.ToLower(strings.TrimSpace(record.ServiceID)), record.Version)
}

func sameImmutableVersion(a, b appregistry.VersionRecord) bool {
	return strings.EqualFold(a.ServiceID, b.ServiceID) &&
		a.Version == b.Version &&
		strings.EqualFold(a.Implementation, b.Implementation) &&
		strings.EqualFold(a.CodeHash, b.CodeHash) &&
		strings.EqualFold(a.MetadataHash, b.MetadataHash) &&
		a.ComponentType == b.ComponentType &&
		strings.EqualFold(a.ManifestHash, b.ManifestHash) &&
		strings.EqualFold(a.DependencyRoot, b.DependencyRoot) &&
		strings.EqualFold(a.InterfaceHash, b.InterfaceHash) &&
		a.BlockNumber == b.BlockNumber &&
		strings.EqualFold(a.BlockHash, b.BlockHash)
}

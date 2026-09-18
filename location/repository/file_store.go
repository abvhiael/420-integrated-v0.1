package repository

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"

	"github.com/420integrated/420-integrated/location/model"
)

const schemaVersion = "420-location-place-store-v1"

var (
	ErrNotFound       = errors.New("place not found")
	ErrExists         = errors.New("place already exists")
	ErrVersion        = errors.New("place version conflict")
	ErrAliasCollision = errors.New("provider alias already belongs to another place")
)

type snapshot struct {
	Schema string        `json:"schema"`
	Places []model.Place `json:"places"`
}

type FileStore struct {
	mu      sync.RWMutex
	path    string
	items   map[string]model.Place
	aliases map[string]string
}

func OpenFileStore(path string) (*FileStore, error) {
	path = strings.TrimSpace(path)
	if path == "" {
		return nil, errors.New("place repository path is required")
	}
	s := &FileStore{path: path, items: map[string]model.Place{}, aliases: map[string]string{}}
	if err := s.load(); err != nil {
		return nil, err
	}
	return s, nil
}

func (s *FileStore) Ready(context.Context) error {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if strings.TrimSpace(s.path) == "" {
		return errors.New("place repository path is not configured")
	}
	info, err := os.Stat(filepath.Dir(s.path))
	if err != nil {
		return fmt.Errorf("place repository parent unavailable: %w", err)
	}
	if !info.IsDir() {
		return errors.New("place repository parent is not a directory")
	}
	return nil
}

func (s *FileStore) Create(place model.Place) (model.Place, error) {
	if err := place.Validate(); err != nil {
		return model.Place{}, err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, ok := s.items[place.ID]; ok {
		return model.Place{}, ErrExists
	}
	if err := s.checkAliasesLocked(place.ID, place.ProviderAliases); err != nil {
		return model.Place{}, err
	}
	s.items[place.ID] = model.ClonePlace(place)
	s.indexAliasesLocked(place)
	if err := s.persistLocked(); err != nil {
		delete(s.items, place.ID)
		s.rebuildAliasesLocked()
		return model.Place{}, err
	}
	return model.ClonePlace(place), nil
}

func (s *FileStore) Get(id string) (model.Place, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	place, ok := s.items[strings.TrimSpace(id)]
	if !ok {
		return model.Place{}, ErrNotFound
	}
	return model.ClonePlace(place), nil
}

func (s *FileStore) Update(place model.Place, expectedVersion uint32) (model.Place, error) {
	if err := place.Validate(); err != nil {
		return model.Place{}, err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	current, ok := s.items[place.ID]
	if !ok {
		return model.Place{}, ErrNotFound
	}
	if current.Version != expectedVersion || place.Version != expectedVersion+1 {
		return model.Place{}, ErrVersion
	}
	if place.CreatedAt != current.CreatedAt || place.Owner != current.Owner {
		return model.Place{}, errors.New("place immutable fields changed")
	}
	if err := s.checkAliasesLocked(place.ID, place.ProviderAliases); err != nil {
		return model.Place{}, err
	}
	before := current
	s.items[place.ID] = model.ClonePlace(place)
	s.rebuildAliasesLocked()
	if err := s.persistLocked(); err != nil {
		s.items[place.ID] = before
		s.rebuildAliasesLocked()
		return model.Place{}, err
	}
	return model.ClonePlace(place), nil
}

func (s *FileStore) FindByProviderAlias(provider, id string) (model.Place, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	placeID, ok := s.aliases[aliasKey(provider, id)]
	if !ok {
		return model.Place{}, false
	}
	place, ok := s.items[placeID]
	if !ok {
		return model.Place{}, false
	}
	return model.ClonePlace(place), true
}

func (s *FileStore) ListByOwner(owner model.SubjectRef) []model.Place {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]model.Place, 0)
	for _, place := range s.items {
		if place.Owner == owner {
			out = append(out, model.ClonePlace(place))
		}
	}
	sort.Slice(out, func(i, j int) bool {
		if !out[i].CreatedAt.Equal(out[j].CreatedAt) {
			return out[i].CreatedAt.Before(out[j].CreatedAt)
		}
		return out[i].ID < out[j].ID
	})
	return out
}

func (s *FileStore) ListAll() []model.Place {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]model.Place, 0, len(s.items))
	for _, place := range s.items {
		out = append(out, model.ClonePlace(place))
	}
	sort.Slice(out, func(i, j int) bool { return out[i].ID < out[j].ID })
	return out
}

func (s *FileStore) Count() int {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return len(s.items)
}

func (s *FileStore) load() error {
	parent := filepath.Dir(s.path)
	if err := os.MkdirAll(parent, 0o700); err != nil {
		return fmt.Errorf("create place repository directory: %w", err)
	}
	payload, err := os.ReadFile(s.path)
	if errors.Is(err, os.ErrNotExist) {
		return s.persistLocked()
	}
	if err != nil {
		return fmt.Errorf("read place repository: %w", err)
	}
	if len(payload) == 0 {
		return errors.New("place repository is empty/corrupt")
	}
	var snap snapshot
	if err := json.Unmarshal(payload, &snap); err != nil {
		return fmt.Errorf("decode place repository: %w", err)
	}
	if snap.Schema != schemaVersion {
		return fmt.Errorf("unsupported place repository schema %q", snap.Schema)
	}
	for _, place := range snap.Places {
		if err := place.Validate(); err != nil {
			return fmt.Errorf("invalid persisted place %q: %w", place.ID, err)
		}
		if _, exists := s.items[place.ID]; exists {
			return fmt.Errorf("duplicate persisted place id %q", place.ID)
		}
		if err := s.checkAliasesLocked(place.ID, place.ProviderAliases); err != nil {
			return fmt.Errorf("invalid persisted place %q: %w", place.ID, err)
		}
		s.items[place.ID] = model.ClonePlace(place)
		s.indexAliasesLocked(place)
	}
	return nil
}

func (s *FileStore) persistLocked() error {
	places := make([]model.Place, 0, len(s.items))
	for _, place := range s.items {
		places = append(places, model.ClonePlace(place))
	}
	sort.Slice(places, func(i, j int) bool { return places[i].ID < places[j].ID })
	payload, err := json.MarshalIndent(snapshot{Schema: schemaVersion, Places: places}, "", "  ")
	if err != nil {
		return fmt.Errorf("encode place repository: %w", err)
	}
	payload = append(payload, byte(10))
	parent := filepath.Dir(s.path)
	tmp, err := os.CreateTemp(parent, ".places-*.tmp")
	if err != nil {
		return fmt.Errorf("create place repository temp file: %w", err)
	}
	tmpName := tmp.Name()
	defer os.Remove(tmpName)
	if err := tmp.Chmod(0o600); err != nil {
		tmp.Close()
		return fmt.Errorf("chmod place repository temp file: %w", err)
	}
	if _, err := tmp.Write(payload); err != nil {
		tmp.Close()
		return fmt.Errorf("write place repository: %w", err)
	}
	if err := tmp.Sync(); err != nil {
		tmp.Close()
		return fmt.Errorf("sync place repository: %w", err)
	}
	if err := tmp.Close(); err != nil {
		return fmt.Errorf("close place repository: %w", err)
	}
	if err := os.Rename(tmpName, s.path); err != nil {
		return fmt.Errorf("replace place repository: %w", err)
	}
	return os.Chmod(s.path, 0o600)
}

func (s *FileStore) checkAliasesLocked(placeID string, aliases []model.ProviderAlias) error {
	for _, alias := range aliases {
		if other, ok := s.aliases[aliasKey(alias.Provider, alias.ID)]; ok && other != placeID {
			return ErrAliasCollision
		}
	}
	return nil
}

func (s *FileStore) indexAliasesLocked(place model.Place) {
	for _, alias := range place.ProviderAliases {
		s.aliases[aliasKey(alias.Provider, alias.ID)] = place.ID
	}
}

func (s *FileStore) rebuildAliasesLocked() {
	s.aliases = map[string]string{}
	for _, place := range s.items {
		s.indexAliasesLocked(place)
	}
}

func aliasKey(provider, id string) string {
	provider = strings.ToLower(strings.TrimSpace(provider))
	id = strings.TrimSpace(id)
	return fmt.Sprintf("%d:%s:%s", len(provider), provider, id)
}

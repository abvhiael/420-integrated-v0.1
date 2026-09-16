package catalog

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"

	appregistry "github.com/420integrated/420-integrated/appstore/registry"
)

const SchemaVersion = 1

var (
	ErrInvalidStore      = errors.New("invalid appstore catalogue store")
	ErrStoreCorrupt      = errors.New("appstore catalogue store is corrupt")
	ErrUnsupportedSchema = errors.New("unsupported appstore catalogue schema")
)

type Document struct {
	SchemaVersion   int                         `json:"schemaVersion"`
	ChainID         uint64                      `json:"chainId"`
	RegistryAddress string                      `json:"registryAddress"`
	FinalizedBlock  uint64                      `json:"finalizedBlock"`
	Versions        []appregistry.VersionRecord `json:"versions"`
}

type Store struct {
	mu   sync.Mutex
	path string
}

func Open(path string) (*Store, error) {
	path = strings.TrimSpace(path)
	if path == "" { return nil, ErrInvalidStore }
	return &Store{path: path}, nil
}

func (s *Store) Save(doc Document) error {
	s.mu.Lock(); defer s.mu.Unlock()
	if doc.SchemaVersion != SchemaVersion || doc.ChainID == 0 || strings.TrimSpace(doc.RegistryAddress) == "" { return ErrInvalidStore }
	sort.Slice(doc.Versions, func(i, j int) bool {
		if strings.EqualFold(doc.Versions[i].ServiceID, doc.Versions[j].ServiceID) { return doc.Versions[i].Version < doc.Versions[j].Version }
		return strings.ToLower(doc.Versions[i].ServiceID) < strings.ToLower(doc.Versions[j].ServiceID)
	})
	payload, err := json.MarshalIndent(doc, "", "  ")
	if err != nil { return err }
	payload = append(payload, '\n')
	if err := os.MkdirAll(filepath.Dir(s.path), 0o755); err != nil { return fmt.Errorf("create catalogue directory: %w", err) }
	tmp := s.path + ".tmp"
	if err := os.WriteFile(tmp, payload, 0o600); err != nil { return fmt.Errorf("write catalogue temp file: %w", err) }
	if err := os.Rename(tmp, s.path); err != nil { _ = os.Remove(tmp); return fmt.Errorf("replace catalogue file: %w", err) }
	return nil
}

func (s *Store) Load() (Document, error) {
	s.mu.Lock(); defer s.mu.Unlock()
	payload, err := os.ReadFile(s.path)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) { return Document{}, os.ErrNotExist }
		return Document{}, fmt.Errorf("read catalogue file: %w", err)
	}
	var doc Document
	if err := json.Unmarshal(payload, &doc); err != nil { return Document{}, ErrStoreCorrupt }
	if doc.SchemaVersion != SchemaVersion { return Document{}, ErrUnsupportedSchema }
	if doc.ChainID == 0 || strings.TrimSpace(doc.RegistryAddress) == "" { return Document{}, ErrStoreCorrupt }
	return doc, nil
}

func RebuildFromSnapshot(snapshot appregistry.Snapshot) (Document, error) {
	projection, err := appregistry.NewProjection(snapshot.ChainID, snapshot.RegistryAddress)
	if err != nil { return Document{}, err }
	if err := projection.Rebuild(snapshot); err != nil { return Document{}, err }
	versions := make([]appregistry.VersionRecord, 0, len(snapshot.Versions))
	for _, service := range snapshot.Versions { versions = append(versions, service) }
	return Document{SchemaVersion: SchemaVersion, ChainID: snapshot.ChainID, RegistryAddress: strings.ToLower(snapshot.RegistryAddress), FinalizedBlock: projection.FinalizedBlock(), Versions: versions}, nil
}

func RestoreProjection(doc Document) (*appregistry.Projection, error) {
	if doc.SchemaVersion != SchemaVersion { return nil, ErrUnsupportedSchema }
	projection, err := appregistry.NewProjection(doc.ChainID, doc.RegistryAddress)
	if err != nil { return nil, err }
	if err := projection.Rebuild(appregistry.Snapshot{ChainID: doc.ChainID, RegistryAddress: doc.RegistryAddress, FinalizedBlock: doc.FinalizedBlock, Versions: doc.Versions}); err != nil { return nil, ErrStoreCorrupt }
	return projection, nil
}

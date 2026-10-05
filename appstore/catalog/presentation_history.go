package catalog

import (
	"encoding/json"
	"errors"
	"os"
	"sort"
	"strings"
	"sync"

	"github.com/420integrated/420-integrated/appstore/curation"
)

const PresentationHistorySchemaVersion = 1

var ErrPresentationHistoryCorrupt = errors.New("appstore presentation history is corrupt")

type PresentationRevision struct {
	ServiceID string            `json:"serviceId"`
	Revision  uint64            `json:"revision"`
	Metadata  curation.Metadata `json:"metadata"`
}

type PresentationHistoryDocument struct {
	SchemaVersion int                    `json:"schemaVersion"`
	Revisions     []PresentationRevision `json:"revisions"`
}

type PresentationHistoryStore struct {
	mu   sync.Mutex
	path string
}

func OpenPresentationHistory(path string) (*PresentationHistoryStore, error) {
	path = strings.TrimSpace(path)
	if path == "" {
		return nil, ErrInvalidStore
	}
	return &PresentationHistoryStore{path: path}, nil
}

func (s *PresentationHistoryStore) Append(metadata curation.Metadata) (PresentationRevision, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	normalized, err := curation.Normalize(metadata)
	if err != nil {
		return PresentationRevision{}, err
	}
	doc, err := s.loadUnlocked()
	if err != nil && !errors.Is(err, os.ErrNotExist) {
		return PresentationRevision{}, err
	}
	if errors.Is(err, os.ErrNotExist) {
		doc = PresentationHistoryDocument{SchemaVersion: PresentationHistorySchemaVersion}
	}
	var revision uint64 = 1
	for _, existing := range doc.Revisions {
		if strings.EqualFold(existing.ServiceID, normalized.ServiceID) && existing.Revision >= revision {
			revision = existing.Revision + 1
		}
	}
	entry := PresentationRevision{
		ServiceID: normalized.ServiceID,
		Revision:  revision,
		Metadata:  normalized,
	}
	doc.Revisions = append(doc.Revisions, entry)
	sort.SliceStable(doc.Revisions, func(i, j int) bool {
		if doc.Revisions[i].ServiceID == doc.Revisions[j].ServiceID {
			return doc.Revisions[i].Revision < doc.Revisions[j].Revision
		}
		return doc.Revisions[i].ServiceID < doc.Revisions[j].ServiceID
	})
	payload, err := json.MarshalIndent(doc, "", "  ")
	if err != nil {
		return PresentationRevision{}, err
	}
	payload = append(payload, '\n')
	if err := writeAtomic(s.path, payload); err != nil {
		return PresentationRevision{}, err
	}
	return entry, nil
}

func (s *PresentationHistoryStore) Load() (PresentationHistoryDocument, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.loadUnlocked()
}

func (s *PresentationHistoryStore) loadUnlocked() (PresentationHistoryDocument, error) {
	payload, err := os.ReadFile(s.path)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return PresentationHistoryDocument{}, os.ErrNotExist
		}
		return PresentationHistoryDocument{}, err
	}
	var doc PresentationHistoryDocument
	if err := json.Unmarshal(payload, &doc); err != nil {
		return PresentationHistoryDocument{}, ErrPresentationHistoryCorrupt
	}
	if doc.SchemaVersion != PresentationHistorySchemaVersion {
		return PresentationHistoryDocument{}, ErrUnsupportedSchema
	}
	next := map[string]uint64{}
	for i, entry := range doc.Revisions {
		normalized, err := curation.Normalize(entry.Metadata)
		if err != nil || !strings.EqualFold(entry.ServiceID, normalized.ServiceID) {
			return PresentationHistoryDocument{}, ErrPresentationHistoryCorrupt
		}
		id := strings.ToLower(strings.TrimSpace(entry.ServiceID))
		want := next[id] + 1
		if entry.Revision != want {
			return PresentationHistoryDocument{}, ErrPresentationHistoryCorrupt
		}
		doc.Revisions[i].ServiceID = id
		doc.Revisions[i].Metadata = normalized
		next[id] = entry.Revision
	}
	return doc, nil
}

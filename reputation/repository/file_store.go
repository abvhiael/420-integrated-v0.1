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

	"github.com/420integrated/420-integrated/reputation/model"
)

var (
	ErrNotFound = errors.New("review not found")
	ErrExists   = errors.New("review already exists")
	ErrVersion  = errors.New("review version conflict")
)

type snapshot struct {
	Schema     string           `json:"schema"`
	Reviews    []model.Review   `json:"reviews"`
	Responses  []model.Response         `json:"responses,omitempty"`
	Moderation []model.ModerationRecord `json:"moderation,omitempty"`
}

type FileStore struct {
	mu        sync.RWMutex
	path      string
	items     map[string]model.Review
	responses  map[string]model.Response
	moderation map[string]model.ModerationRecord
}

func OpenFileStore(path string) (*FileStore, error) {
	path = strings.TrimSpace(path)
	if path == "" {
		return nil, errors.New("review repository path is required")
	}
	s := &FileStore{path: path, items: map[string]model.Review{}, responses: map[string]model.Response{}, moderation: map[string]model.ModerationRecord{}}
	if err := s.load(); err != nil {
		return nil, err
	}
	return s, nil
}

func (s *FileStore) Ready(context.Context) error {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if strings.TrimSpace(s.path) == "" {
		return errors.New("review repository path is not configured")
	}
	parent := filepath.Dir(s.path)
	info, err := os.Stat(parent)
	if err != nil {
		return fmt.Errorf("review repository parent unavailable: %w", err)
	}
	if !info.IsDir() {
		return errors.New("review repository parent is not a directory")
	}
	return nil
}

func (s *FileStore) Create(review model.Review) (model.Review, error) {
	if err := review.Validate(); err != nil {
		return model.Review{}, err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, ok := s.items[review.ID]; ok {
		return model.Review{}, ErrExists
	}
	s.items[review.ID] = model.CloneReview(review)
	if err := s.persistLocked(); err != nil {
		delete(s.items, review.ID)
		return model.Review{}, err
	}
	return model.CloneReview(review), nil
}

func (s *FileStore) Get(id string) (model.Review, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	review, ok := s.items[strings.TrimSpace(id)]
	if !ok {
		return model.Review{}, ErrNotFound
	}
	return model.CloneReview(review), nil
}

func (s *FileStore) Update(review model.Review, expectedVersion uint32) (model.Review, error) {
	if err := review.Validate(); err != nil {
		return model.Review{}, err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	current, ok := s.items[review.ID]
	if !ok {
		return model.Review{}, ErrNotFound
	}
	if current.Version != expectedVersion || review.Version != expectedVersion+1 {
		return model.Review{}, ErrVersion
	}
	if review.CreatedAt != current.CreatedAt {
		return model.Review{}, errors.New("review created time is immutable")
	}
	before := current
	s.items[review.ID] = model.CloneReview(review)
	if err := s.persistLocked(); err != nil {
		s.items[review.ID] = before
		return model.Review{}, err
	}
	return model.CloneReview(review), nil
}

func (s *FileStore) ListBySubject(domain model.Domain, subject model.SubjectRef) []model.Review {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]model.Review, 0)
	for _, review := range s.items {
		if review.Domain != domain || review.Subject != subject {
			continue
		}
		out = append(out, model.CloneReview(review))
	}
	sort.Slice(out, func(i, j int) bool {
		if !out[i].CreatedAt.Equal(out[j].CreatedAt) {
			return out[i].CreatedAt.After(out[j].CreatedAt)
		}
		return out[i].ID < out[j].ID
	})
	return out
}

func (s *FileStore) CreateResponse(response model.Response) (model.Response, error) {
	if err := response.Validate(); err != nil {
		return model.Response{}, err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, ok := s.responses[response.ReviewID]; ok {
		return model.Response{}, ErrExists
	}
	s.responses[response.ReviewID] = response
	if err := s.persistLocked(); err != nil {
		delete(s.responses, response.ReviewID)
		return model.Response{}, err
	}
	return response, nil
}

func (s *FileStore) GetResponse(reviewID string) (model.Response, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	response, ok := s.responses[strings.TrimSpace(reviewID)]
	if !ok {
		return model.Response{}, ErrNotFound
	}
	return response, nil
}

func (s *FileStore) UpdateResponse(response model.Response, expectedVersion uint32) (model.Response, error) {
	if err := response.Validate(); err != nil {
		return model.Response{}, err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	current, ok := s.responses[response.ReviewID]
	if !ok {
		return model.Response{}, ErrNotFound
	}
	if current.Version != expectedVersion || response.Version != expectedVersion+1 {
		return model.Response{}, ErrVersion
	}
	if response.CreatedAt != current.CreatedAt || response.Subject != current.Subject {
		return model.Response{}, errors.New("response immutable fields changed")
	}
	before := current
	s.responses[response.ReviewID] = response
	if err := s.persistLocked(); err != nil {
		s.responses[response.ReviewID] = before
		return model.Response{}, err
	}
	return response, nil
}

func (s *FileStore) CreateModeration(record model.ModerationRecord) (model.ModerationRecord, error) {
	if err := record.Validate(); err != nil { return model.ModerationRecord{}, err }
	s.mu.Lock(); defer s.mu.Unlock()
	if _, ok := s.moderation[record.ID]; ok { return model.ModerationRecord{}, ErrExists }
	s.moderation[record.ID] = record
	if err := s.persistLocked(); err != nil { delete(s.moderation, record.ID); return model.ModerationRecord{}, err }
	return record, nil
}

func (s *FileStore) ListModeration(reviewID string) []model.ModerationRecord {
	s.mu.RLock(); defer s.mu.RUnlock()
	out := make([]model.ModerationRecord, 0)
	for _, record := range s.moderation {
		if record.ReviewID == strings.TrimSpace(reviewID) { out = append(out, record) }
	}
	sort.Slice(out, func(i,j int) bool {
		if !out[i].CreatedAt.Equal(out[j].CreatedAt) { return out[i].CreatedAt.Before(out[j].CreatedAt) }
		return out[i].ID < out[j].ID
	})
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
		return fmt.Errorf("create review repository directory: %w", err)
	}
	payload, err := os.ReadFile(s.path)
	if errors.Is(err, os.ErrNotExist) {
		return s.persistLocked()
	}
	if err != nil {
		return fmt.Errorf("read review repository: %w", err)
	}
	if len(payload) == 0 {
		return errors.New("review repository is empty/corrupt")
	}
	var snap snapshot
	if err := json.Unmarshal(payload, &snap); err != nil {
		return fmt.Errorf("decode review repository: %w", err)
	}
	if snap.Schema != "420-reputation-review-store-v1" {
		return fmt.Errorf("unsupported review repository schema %q", snap.Schema)
	}
	for _, review := range snap.Reviews {
		if err := review.Validate(); err != nil {
			return fmt.Errorf("invalid persisted review %q: %w", review.ID, err)
		}
		if _, exists := s.items[review.ID]; exists {
			return fmt.Errorf("duplicate persisted review id %q", review.ID)
		}
		s.items[review.ID] = model.CloneReview(review)
	}
	for _, response := range snap.Responses {
		if err := response.Validate(); err != nil { return fmt.Errorf("invalid persisted response %q: %w", response.ReviewID, err) }
		if _, exists := s.responses[response.ReviewID]; exists { return fmt.Errorf("duplicate persisted response review id %q", response.ReviewID) }
		s.responses[response.ReviewID] = response
	}
	for _, record := range snap.Moderation {
		if err := record.Validate(); err != nil { return fmt.Errorf("invalid persisted moderation %q: %w", record.ID, err) }
		if _, exists := s.moderation[record.ID]; exists { return fmt.Errorf("duplicate persisted moderation id %q", record.ID) }
		s.moderation[record.ID] = record
	}
	return nil
}

func (s *FileStore) persistLocked() error {
	reviews := make([]model.Review, 0, len(s.items))
	for _, review := range s.items {
		reviews = append(reviews, model.CloneReview(review))
	}
	sort.Slice(reviews, func(i, j int) bool { return reviews[i].ID < reviews[j].ID })
	responses := make([]model.Response, 0, len(s.responses))
	for _, response := range s.responses { responses = append(responses, response) }
	sort.Slice(responses, func(i, j int) bool { return responses[i].ReviewID < responses[j].ReviewID })
	moderation := make([]model.ModerationRecord, 0, len(s.moderation))
	for _, record := range s.moderation { moderation = append(moderation, record) }
	sort.Slice(moderation, func(i,j int) bool { return moderation[i].ID < moderation[j].ID })
	payload, err := json.MarshalIndent(snapshot{
		Schema:  "420-reputation-review-store-v1",
		Reviews: reviews,
		Responses: responses,
		Moderation: moderation,
	}, "", "  ")
	if err != nil {
		return fmt.Errorf("encode review repository: %w", err)
	}
	payload = append(payload, '\n')
	parent := filepath.Dir(s.path)
	tmp, err := os.CreateTemp(parent, ".reviews-*.tmp")
	if err != nil {
		return fmt.Errorf("create review repository temp file: %w", err)
	}
	tmpName := tmp.Name()
	defer os.Remove(tmpName)
	if err := tmp.Chmod(0o600); err != nil {
		tmp.Close()
		return fmt.Errorf("chmod review repository temp file: %w", err)
	}
	if _, err := tmp.Write(payload); err != nil {
		tmp.Close()
		return fmt.Errorf("write review repository: %w", err)
	}
	if err := tmp.Sync(); err != nil {
		tmp.Close()
		return fmt.Errorf("sync review repository: %w", err)
	}
	if err := tmp.Close(); err != nil {
		return fmt.Errorf("close review repository: %w", err)
	}
	if err := os.Rename(tmpName, s.path); err != nil {
		return fmt.Errorf("replace review repository: %w", err)
	}
	return os.Chmod(s.path, 0o600)
}

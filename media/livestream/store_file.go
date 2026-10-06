package livestream

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
)

type FileStore struct {
	path string
	mu   sync.Mutex
}

type fileState struct {
	Records map[string]Record `json:"records"`
}

func NewFileStore(path string) (*FileStore, error) {
	if strings.TrimSpace(path) == "" {
		return nil, ErrInvalidRequest
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return nil, err
	}
	return &FileStore{path: path}, nil
}

func (s *FileStore) Create(ctx context.Context, record Record) (bool, error) {
	if err := ctx.Err(); err != nil {
		return false, err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	state, err := s.load()
	if err != nil {
		return false, err
	}
	if _, exists := state.Records[record.ID]; exists {
		return false, nil
	}
	state.Records[record.ID] = record
	return true, s.save(state)
}

func (s *FileStore) Get(ctx context.Context, id string) (Record, bool, error) {
	if err := ctx.Err(); err != nil {
		return Record{}, false, err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	state, err := s.load()
	if err != nil {
		return Record{}, false, err
	}
	record, ok := state.Records[id]
	return record, ok, nil
}

func (s *FileStore) Save(ctx context.Context, record Record) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	state, err := s.load()
	if err != nil {
		return err
	}
	if _, exists := state.Records[record.ID]; !exists {
		return ErrSessionNotFound
	}
	state.Records[record.ID] = record
	return s.save(state)
}

func (s *FileStore) List(ctx context.Context) ([]Record, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	state, err := s.load()
	if err != nil {
		return nil, err
	}
	ids := make([]string, 0, len(state.Records))
	for id := range state.Records {
		ids = append(ids, id)
	}
	sort.Strings(ids)
	out := make([]Record, 0, len(ids))
	for _, id := range ids {
		out = append(out, state.Records[id])
	}
	return out, nil
}

func (s *FileStore) load() (fileState, error) {
	state := fileState{Records: make(map[string]Record)}
	data, err := os.ReadFile(s.path)
	if errors.Is(err, os.ErrNotExist) {
		return state, nil
	}
	if err != nil {
		return state, err
	}
	if len(data) == 0 {
		return state, nil
	}
	if err := json.Unmarshal(data, &state); err != nil {
		return fileState{}, err
	}
	if state.Records == nil {
		state.Records = make(map[string]Record)
	}
	return state, nil
}

func (s *FileStore) save(state fileState) error {
	data, err := json.Marshal(state)
	if err != nil {
		return err
	}
	tmp := s.path + ".tmp"
	if err := os.WriteFile(tmp, data, 0o600); err != nil {
		return err
	}
	return os.Rename(tmp, s.path)
}

var _ Store = (*FileStore)(nil)

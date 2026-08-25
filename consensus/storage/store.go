package storage

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"

	ctypes "github.com/420integrated/420-integrated/consensus/types"
)

type Status struct {
	Head          ctypes.Checkpoint `json:"head"`
	Safe          ctypes.Checkpoint `json:"safe"`
	Finalized     ctypes.Checkpoint `json:"finalized"`
	NextSlot      uint64            `json:"next_slot"`
	LastQCMessage string            `json:"last_qc_message,omitempty"`
}

type FileStore struct {
	mu   sync.Mutex
	path string
}

func NewFileStore(path string) *FileStore { return &FileStore{path: path} }

func (s *FileStore) Load() (Status, bool, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	raw, err := os.ReadFile(s.path)
	if os.IsNotExist(err) {
		return Status{}, false, nil
	}
	if err != nil {
		return Status{}, false, err
	}
	var st Status
	if err := json.Unmarshal(raw, &st); err != nil {
		return Status{}, false, fmt.Errorf("decode store: %w", err)
	}
	return st, true, nil
}

func (s *FileStore) Save(st Status) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := os.MkdirAll(filepath.Dir(s.path), 0o755); err != nil {
		return err
	}
	raw, err := json.MarshalIndent(st, "", "  ")
	if err != nil {
		return err
	}
	tmp := s.path + ".tmp"
	if err := os.WriteFile(tmp, append(raw, '\n'), 0o600); err != nil {
		return err
	}
	f, err := os.OpenFile(tmp, os.O_RDWR, 0)
	if err == nil {
		_ = f.Sync()
		_ = f.Close()
	}
	return os.Rename(tmp, s.path)
}

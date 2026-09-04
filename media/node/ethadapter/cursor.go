package ethadapter

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"sync"
)

type CursorStore interface {
	Load() (uint64, error)
	Save(block uint64) error
}

type FileCursor struct {
	path string
	mu   sync.Mutex
}

func NewFileCursor(path string) (*FileCursor, error) {
	if path == "" { return nil, errors.New("420media ethadapter: empty cursor path") }
	return &FileCursor{path: path}, nil
}

func (c *FileCursor) Load() (uint64, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	data, err := os.ReadFile(c.path)
	if errors.Is(err, os.ErrNotExist) { return 0, nil }
	if err != nil { return 0, err }
	var state struct { Block uint64 `json:"block"` }
	if err := json.Unmarshal(data, &state); err != nil { return 0, err }
	return state.Block, nil
}

func (c *FileCursor) Save(block uint64) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	if err := os.MkdirAll(filepath.Dir(c.path), 0o700); err != nil { return err }
	data, err := json.Marshal(struct { Block uint64 `json:"block"` }{Block: block})
	if err != nil { return err }
	tmp := c.path + ".tmp"
	if err := os.WriteFile(tmp, data, 0o600); err != nil { return err }
	return os.Rename(tmp, c.path)
}

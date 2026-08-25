package devnet

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"sync"

	eng "github.com/420integrated/420-integrated/consensus/engine"
)

type FileEngineSink struct {
	mu   sync.Mutex
	path string
}

func NewFileEngineSink(path string) *FileEngineSink { return &FileEngineSink{path: path} }

func (s *FileEngineSink) UpdateForkchoice(ctx context.Context, state eng.ForkchoiceStateV1) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := os.MkdirAll(filepath.Dir(s.path), 0o755); err != nil {
		return err
	}
	raw, _ := json.MarshalIndent(state, "", "  ")
	return os.WriteFile(s.path, append(raw, '\n'), 0o600)
}

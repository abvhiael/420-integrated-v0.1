package recovery

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"

	"github.com/420integrated/420-integrated/town/projection"
)

const maxRecoveryBytes = 8 << 20

var ErrRecoveryTooLarge = errors.New("Town recovery snapshot too large")

func Save(path string, state projection.RecoveryState) error {
	if path == "" {
		return errors.New("recovery path is required")
	}
	payload, err := json.Marshal(state)
	if err != nil {
		return err
	}
	if len(payload) > maxRecoveryBytes {
		return ErrRecoveryTooLarge
	}

	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return err
	}
	tmp, err := os.CreateTemp(dir, ".town-recovery-*")
	if err != nil {
		return err
	}
	tmpPath := tmp.Name()
	ok := false
	defer func() {
		if !ok {
			_ = os.Remove(tmpPath)
		}
	}()

	if err := tmp.Chmod(0o600); err != nil {
		_ = tmp.Close()
		return err
	}
	if _, err := tmp.Write(payload); err != nil {
		_ = tmp.Close()
		return err
	}
	if err := tmp.Sync(); err != nil {
		_ = tmp.Close()
		return err
	}
	if err := tmp.Close(); err != nil {
		return err
	}
	if err := os.Rename(tmpPath, path); err != nil {
		return err
	}
	ok = true
	return nil
}

func Load(path string) (projection.RecoveryState, error) {
	var state projection.RecoveryState
	f, err := os.Open(path)
	if err != nil {
		return state, err
	}
	defer f.Close()

	dec := json.NewDecoder(io.LimitReader(f, maxRecoveryBytes+1))
	if err := dec.Decode(&state); err != nil {
		return state, err
	}
	var extra any
	if err := dec.Decode(&extra); err != io.EOF {
		return state, errors.New("recovery file must contain one JSON value")
	}
	info, err := f.Stat()
	if err != nil {
		return state, err
	}
	if info.Size() > maxRecoveryBytes {
		return state, ErrRecoveryTooLarge
	}
	if state.Schema != "420-town-projection-recovery-v1" {
		return state, fmt.Errorf("unsupported Town recovery schema %q", state.Schema)
	}
	return state, nil
}

func Restore(path string, store *projection.Store) error {
	if store == nil {
		return errors.New("projection store is required")
	}
	state, err := Load(path)
	if err != nil {
		return err
	}
	return store.RestoreRecovery(state)
}

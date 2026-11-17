// Package telemetry publishes categorical operational facts, never errors,
// duties, keys, credentials, endpoints or settlement authority.
package telemetry

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sync"
	"time"
)

const Schema = "420-stake-runtime-health-v1"

type Health struct {
	Schema     string    `json:"schema"`
	Component  string    `json:"component"`
	ObservedAt time.Time `json:"observedAt"`
	Status     string    `json:"status"`
}

func (h Health) Validate() error {
	if h.Schema != Schema || h.ObservedAt.IsZero() {
		return errors.New("invalid runtime health")
	}
	switch h.Component {
	case "signer", "validator", "settlement":
	default:
		return errors.New("invalid runtime component")
	}
	switch h.Status {
	case "STARTING", "READY", "STOPPED", "SIGNING_PROTECTION_FAILURE", "SETTLEMENT_FAILURE", "PERSISTENCE_FAILURE":
	default:
		return errors.New("invalid runtime status")
	}
	return nil
}

// Atomic persists observability state without modifying any protocol journal.
func Atomic(path string, raw []byte) error { return atomic(path, raw, 0600) }
func atomic(path string, raw []byte, mode os.FileMode) error {
	dir := filepath.Dir(path)
	f, err := os.CreateTemp(dir, ".stake-observation-")
	if err != nil {
		return err
	}
	if err = f.Chmod(mode); err != nil {
		f.Close()
		os.Remove(f.Name())
		return err
	}
	name := f.Name()
	defer os.Remove(name)
	defer f.Close()
	if _, err = f.Write(raw); err != nil {
		return err
	}
	if err = f.Sync(); err != nil {
		return err
	}
	if err = f.Close(); err != nil {
		return err
	}
	if err = os.Rename(name, path); err != nil {
		return err
	}
	d, err := os.Open(dir)
	if err != nil {
		return err
	}
	defer d.Close()
	return d.Sync()
}

type Writer struct {
	mu         sync.Mutex
	path       string
	health     Health
	stop, done chan struct{}
	once       sync.Once
}

func New(path, component string) *Writer {
	if path != "" {
		if info, err := os.Lstat(path); err == nil {
			var previous Health
			raw, readErr := os.ReadFile(path)
			if !info.Mode().IsRegular() || readErr != nil || decodeHealth(raw, &previous) != nil || previous.Validate() != nil || previous.Component != component {
				fmt.Fprintln(os.Stderr, "STAKE_TELEMETRY_PERSISTENCE_FAILURE")
				path = ""
			}
		} else if !os.IsNotExist(err) {
			fmt.Fprintln(os.Stderr, "STAKE_TELEMETRY_PERSISTENCE_FAILURE")
			path = ""
		}
	}

	w := &Writer{path: path, health: Health{Schema: Schema, Component: component, Status: "STARTING"}, stop: make(chan struct{}), done: make(chan struct{})}
	w.Set("STARTING")
	go func() {
		defer close(w.done)
		t := time.NewTicker(10 * time.Second)
		defer t.Stop()
		for {
			select {
			case <-w.stop:
				return
			case <-t.C:
				w.mu.Lock()
				w.write()
				w.mu.Unlock()
			}
		}
	}()
	return w
}
func (w *Writer) write() {
	if w.path == "" {
		return
	}
	w.health.ObservedAt = time.Now().UTC()
	if w.health.Validate() != nil {
		return
	}
	raw, _ := json.Marshal(w.health)
	if atomic(w.path, append(raw, '\n'), 0644) != nil {
		fmt.Fprintln(os.Stderr, "STAKE_TELEMETRY_PERSISTENCE_FAILURE")
	}
}
func (w *Writer) Set(status string) {
	w.mu.Lock()
	defer w.mu.Unlock()
	w.health.Status = status
	w.write()
}
func (w *Writer) Failure(err error) {
	if err == nil {
		return
	}
	status := "SIGNING_PROTECTION_FAILURE"
	if w.health.Component == "settlement" {
		status = "SETTLEMENT_FAILURE"
	}
	var pe *os.PathError
	if errors.As(err, &pe) {
		status = "PERSISTENCE_FAILURE"
	}
	w.Set(status)
}
func (w *Writer) Close(err error) {
	w.once.Do(func() {
		close(w.stop)
		<-w.done
		if err != nil {
			w.Failure(err)
		} else {
			w.mu.Lock()
			if w.health.Status == "READY" || w.health.Status == "STARTING" {
				w.health.Status = "STOPPED"
			}
			w.write()
			w.mu.Unlock()
		}
	})
}

// Watch publishes semantic health from a read-only, bounded local probe.
func (w *Writer) Watch(parent context.Context, probe func(context.Context) error) func() {
	ctx, cancel := context.WithCancel(parent)
	done := make(chan struct{})
	go func() {
		defer close(done)
		ticker := time.NewTicker(10 * time.Second)
		defer ticker.Stop()
		for {
			limited, stop := context.WithTimeout(ctx, 5*time.Second)
			err := probe(limited)
			stop()
			if ctx.Err() != nil {
				return
			}
			if err != nil {
				w.Failure(err)
			} else {
				w.Set("READY")
			}
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
			}
		}
	}()
	return func() { cancel(); <-done }
}

// AtomicPublicSnapshot preserves the producer's modification time; copying an
// old public projection must not turn it into fresh operational evidence.
func AtomicPublicSnapshot(path string, raw []byte, modified time.Time) error {
	dir := filepath.Dir(path)
	f, err := os.CreateTemp(dir, ".stake-public-view-")
	if err != nil {
		return err
	}
	name := f.Name()
	defer os.Remove(name)
	defer f.Close()
	if err = f.Chmod(0644); err != nil {
		return err
	}
	if _, err = f.Write(raw); err != nil {
		return err
	}
	if err = os.Chtimes(name, modified, modified); err != nil {
		return err
	}
	if err = f.Sync(); err != nil {
		return err
	}
	if err = f.Close(); err != nil {
		return err
	}
	if err = os.Rename(name, path); err != nil {
		return err
	}
	d, err := os.Open(dir)
	if err != nil {
		return err
	}
	defer d.Close()
	return d.Sync()
}

func decodeHealth(raw []byte, h *Health) error {
	d := json.NewDecoder(bytes.NewReader(raw))
	d.DisallowUnknownFields()
	if err := d.Decode(h); err != nil {
		return err
	}
	if err := d.Decode(new(any)); err != io.EOF {
		return errors.New("invalid health document")
	}
	return nil
}

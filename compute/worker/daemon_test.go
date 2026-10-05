package worker

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

const testID = "0x1111111111111111111111111111111111111111111111111111111111111111"

type testService struct {
	name    string
	started chan struct{}
	stopped chan struct{}
	err     error
}

func (s *testService) Name() string { return s.name }

func (s *testService) Run(ctx context.Context) error {
	if s.started != nil {
		close(s.started)
	}
	if s.err != nil {
		return s.err
	}
	<-ctx.Done()
	if s.stopped != nil {
		close(s.stopped)
	}
	return ctx.Err()
}

type blockingService struct {
	name     string
	released chan struct{}
	runs     atomic.Int32
}

func (s *blockingService) Name() string { return s.name }
func (s *blockingService) Run(context.Context) error {
	s.runs.Add(1)
	<-s.released
	return nil
}

func validConfig(t *testing.T) Config {
	t.Helper()
	return Config{
		Identity: Identity{
			ChainID:    420,
			ProviderID: testID,
			NodeID:     testID,
			ResourceID: testID,
			WorkerID:   testID,
		},
		StateDir:        filepath.Join(t.TempDir(), "worker"),
		HeartbeatPeriod: 5 * time.Second,
		ShutdownTimeout: 250 * time.Millisecond,
	}
}

func TestConfigValidationFailsClosed(t *testing.T) {
	cfg := validConfig(t)
	cfg.Identity.ChainID = 0
	if !errors.Is(cfg.Validate(), ErrInvalidConfig) {
		t.Fatal("zero chain ID must fail closed")
	}
	cfg = validConfig(t)
	cfg.Identity.WorkerID = "0x1234"
	if !errors.Is(cfg.Validate(), ErrInvalidConfig) {
		t.Fatal("malformed worker ID must fail closed")
	}
	cfg = validConfig(t)
	cfg.HeartbeatPeriod = 0
	if !errors.Is(cfg.Validate(), ErrInvalidConfig) {
		t.Fatal("non-positive heartbeat must fail closed")
	}
}

func TestPrepareStateDirCreatesPrivateDirectory(t *testing.T) {
	cfg := validConfig(t)
	dir, err := cfg.PrepareStateDir()
	if err != nil {
		t.Fatal(err)
	}
	info, err := os.Stat(dir)
	if err != nil {
		t.Fatal(err)
	}
	if !info.IsDir() {
		t.Fatal("state path is not a directory")
	}
	if info.Mode().Perm()&0o077 != 0 {
		t.Fatalf("state directory permissions too broad: %o", info.Mode().Perm())
	}
}

func TestDaemonReadyAndGracefulShutdown(t *testing.T) {
	started := make(chan struct{})
	stopped := make(chan struct{})
	service := &testService{name: "standby", started: started, stopped: stopped}
	d, err := New(validConfig(t), service)
	if err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan error, 1)
	go func() { done <- d.Run(ctx) }()

	select {
	case <-d.Ready():
	case <-time.After(time.Second):
		t.Fatal("daemon did not become ready")
	}
	<-started
	if got := d.Snapshot().State; got != StateReady {
		t.Fatalf("state=%s want ready", got)
	}
	cancel()
	if err := <-done; err != nil {
		t.Fatalf("graceful shutdown: %v", err)
	}
	select {
	case <-stopped:
	default:
		t.Fatal("service did not observe cancellation")
	}
	if got := d.Snapshot().State; got != StateStopped {
		t.Fatalf("state=%s want stopped", got)
	}
}

func TestUnexpectedServiceExitCancelsSiblings(t *testing.T) {
	stopped := make(chan struct{})
	failing := &testService{name: "failing", err: errors.New("boom")}
	sibling := &testService{name: "sibling", stopped: stopped}
	d, err := New(validConfig(t), failing, sibling)
	if err != nil {
		t.Fatal(err)
	}
	err = d.Run(context.Background())
	if err == nil || !strings.Contains(err.Error(), "failing: boom") {
		t.Fatalf("unexpected error: %v", err)
	}
	select {
	case <-stopped:
	case <-time.After(time.Second):
		t.Fatal("sibling was not cancelled")
	}
}

func TestShutdownTimeoutFailsClosed(t *testing.T) {
	released := make(chan struct{})
	service := &blockingService{name: "blocked", released: released}
	cfg := validConfig(t)
	cfg.ShutdownTimeout = 20 * time.Millisecond
	d, err := New(cfg, service)
	if err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan error, 1)
	go func() { done <- d.Run(ctx) }()
	<-d.Ready()
	cancel()
	err = <-done
	close(released)
	if err == nil || !strings.Contains(err.Error(), "shutdown timed out") {
		t.Fatalf("expected bounded shutdown timeout, got %v", err)
	}
}

func TestDaemonRejectsEmptyDuplicateAndSecondRun(t *testing.T) {
	if _, err := New(validConfig(t)); !errors.Is(err, ErrNoServices) {
		t.Fatalf("empty services: %v", err)
	}
	a := &testService{name: "same"}
	b := &testService{name: "same"}
	if _, err := New(validConfig(t), a, b); err == nil {
		t.Fatal("duplicate service names must fail")
	}
	service := &testService{name: "standby"}
	d, err := New(validConfig(t), service)
	if err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if err := d.Run(ctx); err != nil {
		t.Fatal(err)
	}
	if !errors.Is(d.Run(context.Background()), ErrAlreadyRunning) {
		t.Fatal("daemon instance must be one-shot")
	}
}

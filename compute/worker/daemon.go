package worker

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"sync/atomic"
	"time"
)

var (
	ErrNoServices     = errors.New("compute worker daemon has no services")
	ErrServiceExited  = errors.New("compute worker service exited unexpectedly")
	ErrAlreadyRunning = errors.New("compute worker daemon is already running or has already run")
)

type Service interface {
	Name() string
	Run(context.Context) error
}

type State string

const (
	StateStopped  State = "stopped"
	StateStarting State = "starting"
	StateReady    State = "ready"
	StateStopping State = "stopping"
)

type Snapshot struct {
	State      State
	Identity   Identity
	StateDir   string
	StartedAt  time.Time
	ServiceNum int
}

type serviceResult struct {
	name string
	err  error
}

type Daemon struct {
	config   Config
	services []Service

	started atomic.Bool
	mu      sync.RWMutex
	state   Snapshot
	ready   chan struct{}
}

func New(config Config, services ...Service) (*Daemon, error) {
	if err := config.Validate(); err != nil {
		return nil, err
	}
	if len(services) == 0 {
		return nil, ErrNoServices
	}
	seen := make(map[string]struct{}, len(services))
	for i, service := range services {
		if service == nil {
			return nil, fmt.Errorf("service %d: nil", i)
		}
		name := service.Name()
		if name == "" {
			return nil, fmt.Errorf("service %d: empty name", i)
		}
		if _, ok := seen[name]; ok {
			return nil, fmt.Errorf("duplicate service name %q", name)
		}
		seen[name] = struct{}{}
	}
	return &Daemon{
		config:   config,
		services: append([]Service(nil), services...),
		ready:    make(chan struct{}),
		state: Snapshot{
			State:      StateStopped,
			Identity:   config.Identity,
			ServiceNum: len(services),
		},
	}, nil
}

func (d *Daemon) Ready() <-chan struct{} { return d.ready }

func (d *Daemon) Snapshot() Snapshot {
	d.mu.RLock()
	defer d.mu.RUnlock()
	return d.state
}

func (d *Daemon) Run(ctx context.Context) error {
	if !d.started.CompareAndSwap(false, true) {
		return ErrAlreadyRunning
	}

	stateDir, err := d.config.PrepareStateDir()
	if err != nil {
		return err
	}
	d.setState(StateStarting, stateDir)

	runCtx, cancel := context.WithCancel(ctx)
	defer cancel()

	results := make(chan serviceResult, len(d.services))
	for _, service := range d.services {
		service := service
		go func() {
			results <- serviceResult{name: service.Name(), err: service.Run(runCtx)}
		}()
	}

	d.setState(StateReady, stateDir)
	close(d.ready)

	remaining := len(d.services)
	var cause error
	select {
	case <-ctx.Done():
	case first := <-results:
		remaining--
		if first.err == nil || errors.Is(first.err, context.Canceled) {
			cause = fmt.Errorf("%w: %s", ErrServiceExited, first.name)
		} else {
			cause = fmt.Errorf("%s: %w", first.name, first.err)
		}
	}

	d.setState(StateStopping, stateDir)
	cancel()
	shutdownErr := d.awaitShutdown(results, remaining)
	d.setState(StateStopped, stateDir)

	if cause != nil && shutdownErr != nil {
		return fmt.Errorf("%w; shutdown: %v", cause, shutdownErr)
	}
	if cause != nil {
		return cause
	}
	return shutdownErr
}

func (d *Daemon) awaitShutdown(results <-chan serviceResult, remaining int) error {
	timer := time.NewTimer(d.config.ShutdownTimeout)
	defer timer.Stop()

	var firstErr error
	for remaining > 0 {
		select {
		case result := <-results:
			remaining--
			if result.err != nil && !errors.Is(result.err, context.Canceled) && firstErr == nil {
				firstErr = fmt.Errorf("%s shutdown: %w", result.name, result.err)
			}
		case <-timer.C:
			return fmt.Errorf("compute worker shutdown timed out with %d service(s) remaining", remaining)
		}
	}
	return firstErr
}

func (d *Daemon) setState(state State, stateDir string) {
	d.mu.Lock()
	defer d.mu.Unlock()
	if d.state.StartedAt.IsZero() && state == StateStarting {
		d.state.StartedAt = time.Now().UTC()
	}
	d.state.State = state
	d.state.StateDir = stateDir
}

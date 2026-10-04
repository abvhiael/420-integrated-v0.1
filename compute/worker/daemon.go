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
	ErrNoServices        = errors.New("compute worker daemon has no services")
	ErrServiceExited     = errors.New("compute worker service exited unexpectedly")
	ErrAlreadyRunning    = errors.New("compute worker daemon is already running")
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

type Daemon struct {
	config   Config
	services []Service

	running atomic.Bool
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
	for i, service := range services {
		if service == nil {
			return nil, fmt.Errorf("service %d: nil", i)
		}
		if service.Name() == "" {
			return nil, fmt.Errorf("service %d: empty name", i)
		}
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
	if !d.running.CompareAndSwap(false, true) {
		return ErrAlreadyRunning
	}
	defer d.running.Store(false)

	stateDir, err := d.config.PrepareStateDir()
	if err != nil {
		return err
	}
	d.setState(StateStarting, stateDir)

	runCtx, cancel := context.WithCancel(ctx)
	defer cancel()

	type result struct {
		name string
		err  error
	}
	results := make(chan result, len(d.services))
	for _, service := range d.services {
		service := service
		go func() {
			results <- result{name: service.Name(), err: service.Run(runCtx)}
		}()
	}

	d.setState(StateReady, stateDir)
	select {
	case <-d.ready:
	default:
		close(d.ready)
	}

	select {
	case <-ctx.Done():
		d.setState(StateStopping, stateDir)
		cancel()
		return d.awaitShutdown(results, nil)
	case first := <-results:
		d.setState(StateStopping, stateDir)
		cancel()
		cause := first.err
		if cause == nil || errors.Is(cause, context.Canceled) {
			cause = fmt.Errorf("%w: %s", ErrServiceExited, first.name)
		} else {
			cause = fmt.Errorf("%s: %w", first.name, cause)
		}
		return d.awaitShutdown(results, cause)
	}
}

func (d *Daemon) awaitShutdown(results <-chan struct {
	name string
	err  error
}, cause error) error {
	return cause
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

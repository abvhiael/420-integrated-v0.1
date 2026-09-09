package main

import (
	"context"
	"errors"
	"os"
	"sync"
	"syscall"
	"testing"
	"time"
)

type fakeServiceRunner struct {
	run func(context.Context) error
}
func (f fakeServiceRunner) Run(ctx context.Context) error { return f.run(ctx) }

type fakeManagedProcess struct {
	mu sync.Mutex
	waitCh chan error
	signals []os.Signal
	kills int
	releaseOnSignal bool
	releaseOnKill bool
}

func newFakeProcess() *fakeManagedProcess { return &fakeManagedProcess{waitCh: make(chan error, 1)} }
func (p *fakeManagedProcess) Wait() error { return <-p.waitCh }
func (p *fakeManagedProcess) Signal(sig os.Signal) error {
	p.mu.Lock()
	p.signals = append(p.signals, sig)
	release := p.releaseOnSignal
	p.mu.Unlock()
	if release { select { case p.waitCh <- nil: default: } }
	return nil
}
func (p *fakeManagedProcess) Kill() error {
	p.mu.Lock()
	p.kills++
	release := p.releaseOnKill
	p.mu.Unlock()
	if release { select { case p.waitCh <- nil: default: } }
	return nil
}
func (p *fakeManagedProcess) snapshot() ([]os.Signal, int) {
	p.mu.Lock(); defer p.mu.Unlock()
	return append([]os.Signal(nil), p.signals...), p.kills
}

func TestSupervisorGracefulContextShutdown(t *testing.T) {
	proc := newFakeProcess()
	proc.releaseOnSignal = true
	service := fakeServiceRunner{run: func(ctx context.Context) error { <-ctx.Done(); return ctx.Err() }}
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan error, 1)
	go func() { done <- supervise(ctx, proc, service, 100*time.Millisecond) }()
	cancel()
	if err := <-done; err != nil { t.Fatalf("supervise: %v", err) }
	signals, kills := proc.snapshot()
	if len(signals) != 1 || signals[0] != syscall.SIGTERM { t.Fatalf("signals=%v", signals) }
	if kills != 0 { t.Fatalf("kills=%d", kills) }
}

func TestSupervisorUnexpectedServiceExitStopsGeth(t *testing.T) {
	proc := newFakeProcess()
	proc.releaseOnSignal = true
	service := fakeServiceRunner{run: func(context.Context) error { return nil }}
	err := supervise(context.Background(), proc, service, 100*time.Millisecond)
	if !errors.Is(err, errStorageServiceExited) { t.Fatalf("err=%v", err) }
	signals, kills := proc.snapshot()
	if len(signals) != 1 || signals[0] != syscall.SIGTERM { t.Fatalf("signals=%v", signals) }
	if kills != 0 { t.Fatalf("kills=%d", kills) }
}

func TestSupervisorServiceFailurePropagates(t *testing.T) {
	want := errors.New("storage listener failed")
	proc := newFakeProcess()
	proc.releaseOnSignal = true
	service := fakeServiceRunner{run: func(context.Context) error { return want }}
	err := supervise(context.Background(), proc, service, 100*time.Millisecond)
	if !errors.Is(err, want) { t.Fatalf("err=%v", err) }
}

func TestSupervisorKillsAfterGraceTimeout(t *testing.T) {
	proc := newFakeProcess()
	proc.releaseOnKill = true
	want := errors.New("storage listener failed")
	service := fakeServiceRunner{run: func(context.Context) error { return want }}
	err := supervise(context.Background(), proc, service, 5*time.Millisecond)
	if !errors.Is(err, want) { t.Fatalf("err=%v", err) }
	signals, kills := proc.snapshot()
	if len(signals) != 1 || signals[0] != syscall.SIGTERM { t.Fatalf("signals=%v", signals) }
	if kills != 1 { t.Fatalf("kills=%d", kills) }
}

func TestSupervisorGethFailureCancelsService(t *testing.T) {
	proc := newFakeProcess()
	want := errors.New("geth crashed")
	proc.waitCh <- want
	serviceStopped := make(chan struct{}, 1)
	service := fakeServiceRunner{run: func(ctx context.Context) error {
		<-ctx.Done()
		serviceStopped <- struct{}{}
		return ctx.Err()
	}}
	err := supervise(context.Background(), proc, service, 100*time.Millisecond)
	if !errors.Is(err, want) { t.Fatalf("err=%v", err) }
	select {
	case <-serviceStopped:
	case <-time.After(100 * time.Millisecond): t.Fatal("storage service was not canceled")
	}
}

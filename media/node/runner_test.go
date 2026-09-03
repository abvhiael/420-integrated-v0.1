package node

import (
	"context"
	"errors"
	"testing"
	"time"
)

type fakeChain struct {
	pending   []Job
	refreshed Job
	accepted  bool
	running   bool
	committed bool
}

func (f *fakeChain) PendingJobs(context.Context) ([]Job, error) { return f.pending, nil }
func (f *fakeChain) AcceptJob(context.Context, [32]byte) error { f.accepted = true; return nil }
func (f *fakeChain) RefreshJob(context.Context, [32]byte) (Job, error) { return f.refreshed, nil }
func (f *fakeChain) MarkRunning(context.Context, [32]byte) error { f.running = true; return nil }
func (f *fakeChain) CommitResult(context.Context, [32]byte, [32]byte) error { f.committed = true; return nil }

type fakeProcessor struct {
	called bool
	result Result
	err    error
}

func (p *fakeProcessor) Process(context.Context, Job) (Result, error) {
	p.called = true
	return p.result, p.err
}

func id(b byte) [32]byte { var v [32]byte; v[0] = b; return v }

func TestHandleHappyPath(t *testing.T) {
	op := id(1)
	cap := id(2)
	jobID := id(3)
	chain := &fakeChain{refreshed: Job{
		ID: jobID, OperatorID: op, CapabilityID: cap, Status: JobFunded,
		FundedAmount: 100, Deadline: time.Now().Add(time.Hour),
	}}
	processor := &fakeProcessor{result: Result{OutputRef: id(9)}}
	r := NewRunner(OperatorConfig{OperatorID: op, Capabilities: map[[32]byte]struct{}{cap: {}}}, chain, processor, NewMemoryLeaseStore(time.Minute))

	if err := r.handle(context.Background(), Job{ID: jobID}); err != nil {
		t.Fatalf("handle: %v", err)
	}
	if !chain.accepted || !chain.running || !chain.committed || !processor.called {
		t.Fatal("expected accept, running, processor and commit path")
	}
}

func TestHandleRejectsUnfundedJob(t *testing.T) {
	op := id(1)
	cap := id(2)
	chain := &fakeChain{refreshed: Job{ID: id(3), OperatorID: op, CapabilityID: cap, Status: JobAccepted}}
	processor := &fakeProcessor{result: Result{OutputRef: id(9)}}
	r := NewRunner(OperatorConfig{OperatorID: op, Capabilities: map[[32]byte]struct{}{cap: {}}}, chain, processor, NewMemoryLeaseStore(time.Minute))

	err := r.handle(context.Background(), Job{ID: id(3)})
	if !errors.Is(err, ErrJobNotFunded) {
		t.Fatalf("expected ErrJobNotFunded, got %v", err)
	}
	if processor.called || chain.running || chain.committed {
		t.Fatal("unfunded job must never execute")
	}
}

func TestHandleRejectsOperatorMismatch(t *testing.T) {
	cap := id(2)
	chain := &fakeChain{refreshed: Job{ID: id(3), OperatorID: id(8), CapabilityID: cap, Status: JobFunded, FundedAmount: 10}}
	processor := &fakeProcessor{result: Result{OutputRef: id(9)}}
	r := NewRunner(OperatorConfig{OperatorID: id(1), Capabilities: map[[32]byte]struct{}{cap: {}}}, chain, processor, NewMemoryLeaseStore(time.Minute))

	if err := r.handle(context.Background(), Job{ID: id(3)}); !errors.Is(err, ErrOperatorMismatch) {
		t.Fatalf("expected ErrOperatorMismatch, got %v", err)
	}
}

func TestMemoryLeasePreventsDuplicateExecution(t *testing.T) {
	store := NewMemoryLeaseStore(time.Minute)
	jobID := id(7)
	first, ok, err := store.Acquire(context.Background(), jobID)
	if err != nil || !ok { t.Fatalf("first acquire: ok=%v err=%v", ok, err) }
	if _, ok, err := store.Acquire(context.Background(), jobID); err != nil || ok {
		t.Fatalf("duplicate acquire must be denied: ok=%v err=%v", ok, err)
	}
	if err := first.Release(); err != nil { t.Fatal(err) }
	if _, ok, err := store.Acquire(context.Background(), jobID); err != nil || !ok {
		t.Fatalf("acquire after release: ok=%v err=%v", ok, err)
	}
}

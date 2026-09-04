package ethadapter

import (
	"context"
	"errors"
	"testing"

	medianode "github.com/420integrated/420-integrated/media/node"
)

type fakeBackend struct {
	pending   []ContractJob
	refreshed ContractJob
	acceptErr error
	runErr    error
	commitErr error
	accepted  [32]byte
	running   [32]byte
	committed [32]byte
	output    [32]byte
}

func (f *fakeBackend) ListPendingJobs(context.Context) ([]ContractJob, error) { return f.pending, nil }
func (f *fakeBackend) Job(context.Context, [32]byte) (ContractJob, error)      { return f.refreshed, nil }
func (f *fakeBackend) AcceptJob(_ context.Context, id [32]byte) error {
	f.accepted = id
	return f.acceptErr
}
func (f *fakeBackend) MarkRunning(_ context.Context, id [32]byte) error {
	f.running = id
	return f.runErr
}
func (f *fakeBackend) CommitResult(_ context.Context, id, output [32]byte) error {
	f.committed = id
	f.output = output
	return f.commitErr
}

func b32(v byte) [32]byte {
	var out [32]byte
	out[31] = v
	return out
}

func TestPendingJobsTranslatesContractStatus(t *testing.T) {
	backend := &fakeBackend{pending: []ContractJob{{
		ID: b32(1), CapabilityID: b32(2), Status: 3, FundedAmount: 42,
	}}}
	adapter, err := New(backend)
	if err != nil { t.Fatal(err) }
	jobs, err := adapter.PendingJobs(context.Background())
	if err != nil { t.Fatal(err) }
	if len(jobs) != 1 { t.Fatalf("got %d jobs", len(jobs)) }
	if jobs[0].Status != medianode.JobFunded { t.Fatalf("status=%q", jobs[0].Status) }
	if jobs[0].FundedAmount != 42 { t.Fatalf("funded=%d", jobs[0].FundedAmount) }
}

func TestUnknownStatusFailsClosed(t *testing.T) {
	backend := &fakeBackend{pending: []ContractJob{{ID: b32(1), CapabilityID: b32(2), Status: 99}}}
	adapter, _ := New(backend)
	_, err := adapter.PendingJobs(context.Background())
	if !errors.Is(err, ErrUnknownJobStatus) { t.Fatalf("err=%v", err) }
}

func TestInvalidContractJobFailsClosed(t *testing.T) {
	backend := &fakeBackend{pending: []ContractJob{{CapabilityID: b32(2), Status: 3}}}
	adapter, _ := New(backend)
	_, err := adapter.PendingJobs(context.Background())
	if !errors.Is(err, ErrInvalidJob) { t.Fatalf("err=%v", err) }
}

func TestLifecycleWritesDelegateToBackend(t *testing.T) {
	backend := &fakeBackend{}
	adapter, _ := New(backend)
	id, output := b32(7), b32(8)
	if err := adapter.AcceptJob(context.Background(), id); err != nil { t.Fatal(err) }
	if err := adapter.MarkRunning(context.Background(), id); err != nil { t.Fatal(err) }
	if err := adapter.CommitResult(context.Background(), id, output); err != nil { t.Fatal(err) }
	if backend.accepted != id || backend.running != id || backend.committed != id || backend.output != output {
		t.Fatal("backend lifecycle calls not preserved")
	}
}

func TestEmptyOutputReferenceRejectedBeforeBackend(t *testing.T) {
	backend := &fakeBackend{}
	adapter, _ := New(backend)
	err := adapter.CommitResult(context.Background(), b32(1), [32]byte{})
	if !errors.Is(err, medianode.ErrInvalidResult) { t.Fatalf("err=%v", err) }
	if backend.committed != ([32]byte{}) { t.Fatal("backend called for invalid output") }
}

func TestNilBackendRejected(t *testing.T) {
	if _, err := New(nil); err == nil { t.Fatal("expected nil backend error") }
}

package telemetry

import (
	"context"
	"errors"
	"testing"
	"time"

	medianode "github.com/420integrated/420-integrated/media/node"
)

func id(v byte) [32]byte { var out [32]byte; out[31] = v; return out }

func TestEvidenceHashDeterministic(t *testing.T) {
	base := time.Unix(1_800_000_000, 123_000_000).UTC()
	e := Evidence{
		Version: 1, JobID: id(1), OperatorID: id(2), CapabilityID: id(3), SLAID: id(4), OutputRef: id(5),
		AcceptedAt: base, StartedAt: base.Add(2*time.Second), FinishedAt: base.Add(7*time.Second),
		AvailabilityBps: 9999, Outcome: OutcomePass,
	}
	h1, err := e.Hash(); if err != nil { t.Fatal(err) }
	h2, err := e.Hash(); if err != nil { t.Fatal(err) }
	if h1 != h2 || h1 == ([32]byte{}) { t.Fatal("evidence hash is not deterministic/non-zero") }
}

func TestEvidenceHashChangesWithOutcome(t *testing.T) {
	base := time.Unix(1_800_000_000, 0).UTC()
	e := Evidence{Version:1, JobID:id(1), OperatorID:id(2), CapabilityID:id(3), AcceptedAt:base, StartedAt:base, FinishedAt:base.Add(time.Second), AvailabilityBps:10_000, Outcome:OutcomePass}
	h1, _ := e.Hash(); e.Outcome = OutcomeFail; h2, _ := e.Hash()
	if h1 == h2 { t.Fatal("outcome did not affect evidence commitment") }
}

func TestEvaluatePolicy(t *testing.T) {
	base := time.Unix(1_800_000_000, 0).UTC()
	p := Policy{MaxStartDelay:2*time.Second, MaxProcessing:5*time.Second, MinAvailability:9900}
	out, err := Evaluate(p, base, base.Add(time.Second), base.Add(4*time.Second), 9990)
	if err != nil || out != OutcomePass { t.Fatalf("out=%v err=%v", out, err) }
	out, err = Evaluate(p, base, base.Add(3*time.Second), base.Add(4*time.Second), 9990)
	if err != nil || out != OutcomeFail { t.Fatalf("start delay out=%v err=%v", out, err) }
	out, err = Evaluate(p, base, base.Add(time.Second), base.Add(7*time.Second), 9990)
	if err != nil || out != OutcomeFail { t.Fatalf("processing out=%v err=%v", out, err) }
	out, err = Evaluate(p, base, base.Add(time.Second), base.Add(4*time.Second), 9800)
	if err != nil || out != OutcomeFail { t.Fatalf("availability out=%v err=%v", out, err) }
}

func TestInvalidEvidenceFailsClosed(t *testing.T) {
	_, err := (Evidence{}).Hash()
	if !errors.Is(err, ErrInvalidEvidence) { t.Fatalf("err=%v", err) }
}

type fakeProcessor struct{ err error }
func (f fakeProcessor) Process(context.Context, medianode.Job) (medianode.Result, error) { return medianode.Result{OutputRef:id(9)}, f.err }

func TestInstrumentedProcessorHealth(t *testing.T) {
	now := time.Unix(1_800_000_000, 0).UTC()
	h := NewHealth(now)
	p := InstrumentedProcessor{Next:fakeProcessor{}, Health:h, Now:func() time.Time { return now.Add(time.Second) }}
	if _, err := p.Process(context.Background(), medianode.Job{}); err != nil { t.Fatal(err) }
	s := h.Snapshot()
	if s.ActiveJobs != 0 || s.CompletedJobs != 1 || s.FailedJobs != 0 { t.Fatalf("snapshot=%+v", s) }

	p.Next = fakeProcessor{err:errors.New("boom")}
	if _, err := p.Process(context.Background(), medianode.Job{}); err == nil { t.Fatal("expected error") }
	s = h.Snapshot()
	if s.ActiveJobs != 0 || s.CompletedJobs != 1 || s.FailedJobs != 1 { t.Fatalf("snapshot=%+v", s) }
}

func TestChainHealthTransitions(t *testing.T) {
	base := time.Unix(1_800_000_000, 0).UTC()
	h := NewHealth(base)
	h.ChainError(base.Add(time.Second))
	if h.Snapshot().Healthy { t.Fatal("expected unhealthy after chain error") }
	h.ChainOK(base.Add(2*time.Second))
	if !h.Snapshot().Healthy { t.Fatal("expected healthy after chain recovery") }
}

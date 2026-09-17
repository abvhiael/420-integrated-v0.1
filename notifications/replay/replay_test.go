package replay

import (
	"context"
	"errors"
	"testing"
)

type fakeStream struct { batch EventBatch; err error; seenCursor string }
func (f *fakeStream) ProtocolEvents(_ context.Context, _ uint64, cursor string) (EventBatch, error) { f.seenCursor = cursor; return f.batch, f.err }

type fakeHandler struct { events []string; signals []string; failEvent string }
func (h *fakeHandler) HandleEvent(_ context.Context, e EventEnvelope) error { if e.ID == h.failEvent { return errors.New("boom") }; h.events = append(h.events, e.ID); return nil }
func (h *fakeHandler) HandleCanonicality(_ context.Context, s CanonicalSignal) error { h.signals = append(h.signals, s.ID); return nil }

func validEvent(id string) EventEnvelope {
	return EventEnvelope{StreamVersion: StreamVersion, ID:id, Source:"protocol", Protocol:"420Pay", EventName:"PaymentCompleted", Provenance:Provenance{ChainID:"420", BlockHash:"0xabc", TransactionHash:"0xdef", LogIndex:0}, Authoritative:false}
}

func TestReplayAdvancesOnlyAfterSuccessfulBatch(t *testing.T) {
	store := NewMemoryCheckpointStore()
	_ = store.Save(Checkpoint{ChainID:420, Cursor:"cursor-1"})
	stream := &fakeStream{batch:EventBatch{StreamVersion:StreamVersion, Events:[]EventEnvelope{validEvent("evt-1")}, NextCursor:"cursor-2"}}
	h := &fakeHandler{failEvent:"evt-1"}
	p, _ := NewProcessor(420, stream, store, h)
	if _, err := p.ReplayOnce(context.Background()); err == nil { t.Fatal("expected processing failure") }
	cp, _, _ := store.Load(420)
	if cp.Cursor != "cursor-1" { t.Fatalf("checkpoint advanced on failed batch: %s", cp.Cursor) }
	h.failEvent = ""
	cp, err := p.ReplayOnce(context.Background()); if err != nil { t.Fatal(err) }
	if cp.Cursor != "cursor-2" || stream.seenCursor != "cursor-1" { t.Fatalf("unexpected replay state: %#v cursor=%s", cp, stream.seenCursor) }
}

func TestReplayRejectsChainMismatchWithoutAdvance(t *testing.T) {
	store := NewMemoryCheckpointStore(); _ = store.Save(Checkpoint{ChainID:420, Cursor:"before"})
	e := validEvent("evt-1"); e.Provenance.ChainID = "421"
	p, _ := NewProcessor(420, &fakeStream{batch:EventBatch{StreamVersion:StreamVersion, Events:[]EventEnvelope{e}, NextCursor:"after"}}, store, &fakeHandler{})
	if _, err := p.ReplayOnce(context.Background()); err == nil { t.Fatal("expected chain mismatch") }
	cp, _, _ := store.Load(420); if cp.Cursor != "before" { t.Fatal("checkpoint advanced") }
}

func TestReplayRestartUsesStoredCursor(t *testing.T) {
	store := NewMemoryCheckpointStore(); _ = store.Save(Checkpoint{ChainID:420, Cursor:"resume-here"})
	stream := &fakeStream{batch:EventBatch{StreamVersion:StreamVersion, NextCursor:"next"}}
	p, _ := NewProcessor(420, stream, store, &fakeHandler{})
	if _, err := p.ReplayOnce(context.Background()); err != nil { t.Fatal(err) }
	if stream.seenCursor != "resume-here" { t.Fatalf("did not resume from checkpoint: %s", stream.seenCursor) }
}

func TestCanonicalSignalsAreAppendOnlyKindsAndNonAuthoritative(t *testing.T) {
	h := &fakeHandler{}
	p, _ := NewProcessor(420, &fakeStream{}, NewMemoryCheckpointStore(), h)
	for _, kind := range []string{"finalized","retracted","superseded"} {
		s := CanonicalSignal{ID:"sig-"+kind, Kind:kind, EventID:"evt-1", ChainID:"420", BlockNumber:"10", BlockHash:"0xabc"}
		if err := p.ApplyCanonicalSignal(context.Background(), s); err != nil { t.Fatalf("%s: %v", kind, err) }
	}
	if len(h.signals) != 3 { t.Fatalf("signals=%v", h.signals) }
	bad := CanonicalSignal{ID:"sig", Kind:"finalized", EventID:"evt", ChainID:"420", BlockHash:"0xabc", Authoritative:true}
	if err := p.ApplyCanonicalSignal(context.Background(), bad); err == nil { t.Fatal("authoritative signal accepted") }
}

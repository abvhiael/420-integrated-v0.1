package livegateway

import (
	"context"
	"errors"
	"testing"
)

type fakeDriver struct {
	startErr error
	stopErr  error
	started  SessionSpec
	stopped  SessionSpec
}

func (f *fakeDriver) Start(_ context.Context, spec SessionSpec) error {
	f.started = spec
	return f.startErr
}
func (f *fakeDriver) Stop(_ context.Context, spec SessionSpec) error {
	f.stopped = spec
	return f.stopErr
}

func ref(v byte) [32]byte {
	var out [32]byte
	out[31] = v
	return out
}

func TestWHIPSessionLifecycle(t *testing.T) {
	driver := &fakeDriver{}
	registry, err := New(map[Protocol]Driver{ProtocolWHIP: driver})
	if err != nil { t.Fatal(err) }
	spec := SessionSpec{ID: "live-1", Protocol: ProtocolWHIP, Direction: DirectionIngress, Endpoint: "https://media.example/whip", StreamRef: ref(1)}
	session, err := registry.Start(context.Background(), spec)
	if err != nil { t.Fatal(err) }
	if session.State != StateActive || driver.started.ID != spec.ID { t.Fatalf("start=%+v", session) }
	closed, err := registry.Stop(context.Background(), spec.ID)
	if err != nil { t.Fatal(err) }
	if closed.State != StateClosed || driver.stopped.ID != spec.ID { t.Fatalf("stop=%+v", closed) }
}

func TestRejectsCredentialsInEndpoint(t *testing.T) {
	registry, _ := New(map[Protocol]Driver{ProtocolRTMP: &fakeDriver{}})
	_, err := registry.Start(context.Background(), SessionSpec{ID: "x", Protocol: ProtocolRTMP, Direction: DirectionIngress, Endpoint: "rtmp://user:secret@example/live", StreamRef: ref(1)})
	if !errors.Is(err, ErrSecretInEndpoint) { t.Fatalf("err=%v", err) }
}

func TestRejectsMismatchedScheme(t *testing.T) {
	registry, _ := New(map[Protocol]Driver{ProtocolSRT: &fakeDriver{}})
	_, err := registry.Start(context.Background(), SessionSpec{ID: "x", Protocol: ProtocolSRT, Direction: DirectionIngress, Endpoint: "https://example/live", StreamRef: ref(1)})
	if !errors.Is(err, ErrInvalidEndpoint) { t.Fatalf("err=%v", err) }
}

func TestDuplicateSessionFailsClosed(t *testing.T) {
	registry, _ := New(map[Protocol]Driver{ProtocolWHEP: &fakeDriver{}})
	spec := SessionSpec{ID: "viewer-1", Protocol: ProtocolWHEP, Direction: DirectionEgress, Endpoint: "https://example/whep", StreamRef: ref(1)}
	if _, err := registry.Start(context.Background(), spec); err != nil { t.Fatal(err) }
	if _, err := registry.Start(context.Background(), spec); !errors.Is(err, ErrSessionExists) { t.Fatalf("err=%v", err) }
}

func TestDriverStartFailureRecorded(t *testing.T) {
	driver := &fakeDriver{startErr: errors.New("dial failed")}
	registry, _ := New(map[Protocol]Driver{ProtocolSRT: driver})
	spec := SessionSpec{ID: "srt-1", Protocol: ProtocolSRT, Direction: DirectionIngress, Endpoint: "srt://example:9000", StreamRef: ref(1)}
	session, err := registry.Start(context.Background(), spec)
	if err == nil { t.Fatal("expected error") }
	if session.State != StateFailed || session.LastError == "" { t.Fatalf("session=%+v", session) }
	stored, ok := registry.Get(spec.ID)
	if !ok || stored.State != StateFailed { t.Fatalf("stored=%+v ok=%v", stored, ok) }
}

func TestStopOnlyAllowedFromActive(t *testing.T) {
	driver := &fakeDriver{startErr: errors.New("boom")}
	registry, _ := New(map[Protocol]Driver{ProtocolRTMP: driver})
	spec := SessionSpec{ID: "r", Protocol: ProtocolRTMP, Direction: DirectionIngress, Endpoint: "rtmp://example/live", StreamRef: ref(1)}
	_, _ = registry.Start(context.Background(), spec)
	_, err := registry.Stop(context.Background(), spec.ID)
	if !errors.Is(err, ErrInvalidTransition) { t.Fatalf("err=%v", err) }
}

func TestWebRTCSchemeAllowed(t *testing.T) {
	registry, _ := New(map[Protocol]Driver{ProtocolWebRTC: &fakeDriver{}})
	_, err := registry.Start(context.Background(), SessionSpec{ID: "rtc", Protocol: ProtocolWebRTC, Direction: DirectionEgress, Endpoint: "webrtc://edge.example/session", StreamRef: ref(2)})
	if err != nil { t.Fatal(err) }
}

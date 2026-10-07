package livegateway

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"
)

func TestRestartFailedAndClosedSession(t *testing.T) {
	driver := &fakeDriver{startErr: errors.New("first failure")}
	registry, _ := New(map[Protocol]Driver{ProtocolWHIP: driver})
	spec := SessionSpec{ID: "restart", Protocol: ProtocolWHIP, Direction: DirectionIngress, Endpoint: "https://example/whip", StreamRef: ref(7)}
	if _, err := registry.Start(context.Background(), spec); err == nil {
		t.Fatal("expected first start failure")
	}
	driver.startErr = nil
	active, err := registry.Restart(context.Background(), spec.ID)
	if err != nil || active.State != StateActive {
		t.Fatalf("restart=%+v err=%v", active, err)
	}
	closed, err := registry.Stop(context.Background(), spec.ID)
	if err != nil || closed.State != StateClosed {
		t.Fatalf("close=%+v err=%v", closed, err)
	}
	active, err = registry.Restart(context.Background(), spec.ID)
	if err != nil || active.State != StateActive {
		t.Fatalf("closed restart=%+v err=%v", active, err)
	}
}

func TestSessionSpecBounds(t *testing.T) {
	base := SessionSpec{ID: "bounded", Protocol: ProtocolWHIP, Direction: DirectionIngress, Endpoint: "https://example/whip", StreamRef: ref(8)}
	if err := ValidateSpec(base); err != nil {
		t.Fatal(err)
	}
	tooLongEndpoint := base
	tooLongEndpoint.Endpoint = "https://example/" + strings.Repeat("x", MaxEndpointBytes)
	if err := ValidateSpec(tooLongEndpoint); !errors.Is(err, ErrInvalidEndpoint) {
		t.Fatalf("endpoint err=%v", err)
	}
	tooLongCredential := base
	tooLongCredential.CredentialRef = CredentialRef(strings.Repeat("c", MaxCredentialRefBytes+1))
	if err := ValidateSpec(tooLongCredential); !errors.Is(err, ErrInvalidEndpoint) {
		t.Fatalf("credential ref err=%v", err)
	}
	tooLongDuration := base
	tooLongDuration.MaxDuration = MaxSessionDuration + time.Second
	if err := ValidateSpec(tooLongDuration); !errors.Is(err, ErrInvalidEndpoint) {
		t.Fatalf("duration err=%v", err)
	}
}

func TestResolvedCredentialBound(t *testing.T) {
	driver, _ := NewWebRTCDriver(
		&fakeHTTP{status: 201, body: "answer"},
		&fakeSDP{},
		fakeCreds{value: strings.Repeat("t", MaxResolvedCredentialBytes+1)},
	)
	err := driver.Start(context.Background(), SessionSpec{
		ID: "cred-bound", Protocol: ProtocolWHIP, Direction: DirectionIngress,
		Endpoint: "https://example/whip", CredentialRef: "cred", StreamRef: ref(9),
	})
	if !errors.Is(err, ErrMissingCredential) {
		t.Fatalf("err=%v", err)
	}
}

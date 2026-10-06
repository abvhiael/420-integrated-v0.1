package livestream

import (
	"context"
	"errors"
	"path/filepath"
	"testing"
	"time"

	"github.com/420integrated/420-integrated/media/node/livegateway"
)

type authorityFake struct {
	controller string
	err        error
}

func (f *authorityFake) Controller(context.Context, [32]byte) (string, error) {
	return f.controller, f.err
}

type driverFake struct {
	starts   int
	stops    int
	startErr error
	stopErr  error
}

func (f *driverFake) Start(context.Context, livegateway.SessionSpec) error {
	f.starts++
	return f.startErr
}

func (f *driverFake) Stop(context.Context, livegateway.SessionSpec) error {
	f.stops++
	return f.stopErr
}

func streamRef(v byte) [32]byte {
	var out [32]byte
	out[31] = v
	return out
}

func sessionSpec() livegateway.SessionSpec {
	return livegateway.SessionSpec{
		ID:          "stream-session-1",
		Protocol:    livegateway.ProtocolWHIP,
		Direction:   livegateway.DirectionIngress,
		Endpoint:    "https://edge.example/whip",
		StreamRef:   streamRef(1),
		MaxDuration: time.Hour,
	}
}

func serviceFixture(t *testing.T, driver *driverFake, authority *authorityFake, gate FeatureGate) Service {
	t.Helper()
	registry, err := livegateway.New(map[livegateway.Protocol]livegateway.Driver{
		livegateway.ProtocolWHIP: driver,
	})
	if err != nil {
		t.Fatal(err)
	}
	store, err := NewFileStore(filepath.Join(t.TempDir(), "livestream.json"))
	if err != nil {
		t.Fatal(err)
	}
	return Service{Gate: gate, Authority: authority, Gateway: registry, Store: store}
}

func TestCreateStartStatusStopLifecycleRequiresController(t *testing.T) {
	driver := &driverFake{}
	authority := &authorityFake{controller: "0xabc"}
	svc := serviceFixture(t, driver, authority, FixedFeatureGate{Livestreaming: true})
	ctx := context.Background()

	created, err := svc.Create(ctx, "0xAbC", sessionSpec())
	if err != nil {
		t.Fatal(err)
	}
	if created.State != livegateway.StateCreated || created.DesiredLive {
		t.Fatalf("created=%+v", created)
	}
	started, err := svc.Start(ctx, "0xabc", created.ID)
	if err != nil {
		t.Fatal(err)
	}
	if started.State != livegateway.StateActive || !started.DesiredLive || driver.starts != 1 {
		t.Fatalf("started=%+v starts=%d", started, driver.starts)
	}
	status, err := svc.Status(ctx, "0xABC", created.ID)
	if err != nil || status.State != livegateway.StateActive {
		t.Fatalf("status=%+v err=%v", status, err)
	}
	stopped, err := svc.Stop(ctx, "0xabc", created.ID)
	if err != nil {
		t.Fatal(err)
	}
	if stopped.State != livegateway.StateClosed || stopped.DesiredLive || driver.stops != 1 {
		t.Fatalf("stopped=%+v stops=%d", stopped, driver.stops)
	}
}

func TestUnauthorizedControllerCannotCreateMutateOrReadStatus(t *testing.T) {
	driver := &driverFake{}
	authority := &authorityFake{controller: "0xabc"}
	svc := serviceFixture(t, driver, authority, FixedFeatureGate{Livestreaming: true})
	ctx := context.Background()

	if _, err := svc.Create(ctx, "0xdef", sessionSpec()); !errors.Is(err, ErrUnauthorized) {
		t.Fatalf("create err=%v", err)
	}
	created, err := svc.Create(ctx, "0xabc", sessionSpec())
	if err != nil {
		t.Fatal(err)
	}
	for _, op := range []func() error{
		func() error { _, err := svc.Start(ctx, "0xdef", created.ID); return err },
		func() error { _, err := svc.Stop(ctx, "0xdef", created.ID); return err },
		func() error { _, err := svc.Status(ctx, "0xdef", created.ID); return err },
	} {
		if err := op(); !errors.Is(err, ErrUnauthorized) {
			t.Fatalf("expected unauthorized, got %v", err)
		}
	}
	if driver.starts != 0 || driver.stops != 0 {
		t.Fatalf("unauthorized transport use starts=%d stops=%d", driver.starts, driver.stops)
	}
}

func TestFeatureFlagFailsClosedForCreateStartAndRecovery(t *testing.T) {
	driver := &driverFake{}
	authority := &authorityFake{controller: "0xabc"}
	svc := serviceFixture(t, driver, authority, FixedFeatureGate{Livestreaming: false})
	ctx := context.Background()

	if _, err := svc.Create(ctx, "0xabc", sessionSpec()); !errors.Is(err, ErrFeatureDisabled) {
		t.Fatalf("create err=%v", err)
	}

	svc.Gate = FixedFeatureGate{Livestreaming: true}
	created, err := svc.Create(ctx, "0xabc", sessionSpec())
	if err != nil {
		t.Fatal(err)
	}
	svc.Gate = FixedFeatureGate{Livestreaming: false}
	if _, err := svc.Start(ctx, "0xabc", created.ID); !errors.Is(err, ErrFeatureDisabled) {
		t.Fatalf("start err=%v", err)
	}
	if _, err := svc.Recover(ctx); !errors.Is(err, ErrFeatureDisabled) {
		t.Fatalf("recover err=%v", err)
	}
	if driver.starts != 0 {
		t.Fatalf("feature-disabled transport started %d times", driver.starts)
	}
}

func TestPersistentRecoveryReconnectsDesiredLiveSession(t *testing.T) {
	ctx := context.Background()
	path := filepath.Join(t.TempDir(), "livestream.json")
	store, err := NewFileStore(path)
	if err != nil {
		t.Fatal(err)
	}
	authority := &authorityFake{controller: "0xabc"}
	firstDriver := &driverFake{}
	firstRegistry, _ := livegateway.New(map[livegateway.Protocol]livegateway.Driver{livegateway.ProtocolWHIP: firstDriver})
	first := Service{Gate: FixedFeatureGate{Livestreaming: true}, Authority: authority, Gateway: firstRegistry, Store: store}

	created, err := first.Create(ctx, "0xabc", sessionSpec())
	if err != nil {
		t.Fatal(err)
	}
	started, err := first.Start(ctx, "0xabc", created.ID)
	if err != nil || started.State != livegateway.StateActive {
		t.Fatalf("start=%+v err=%v", started, err)
	}

	secondDriver := &driverFake{}
	secondRegistry, _ := livegateway.New(map[livegateway.Protocol]livegateway.Driver{livegateway.ProtocolWHIP: secondDriver})
	restartedStore, _ := NewFileStore(path)
	second := Service{Gate: FixedFeatureGate{Livestreaming: true}, Authority: authority, Gateway: secondRegistry, Store: restartedStore}

	recovered, err := second.Recover(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if len(recovered) != 1 || recovered[0].State != livegateway.StateActive || secondDriver.starts != 1 {
		t.Fatalf("recovered=%+v starts=%d", recovered, secondDriver.starts)
	}
	status, err := second.Status(ctx, "0xabc", created.ID)
	if err != nil || status.State != livegateway.StateActive || !status.DesiredLive {
		t.Fatalf("status=%+v err=%v", status, err)
	}
}

func TestRecoveryFailsClosedAfterControllerTransfer(t *testing.T) {
	ctx := context.Background()
	path := filepath.Join(t.TempDir(), "livestream.json")
	store, _ := NewFileStore(path)
	authority := &authorityFake{controller: "0xabc"}
	driver := &driverFake{}
	registry, _ := livegateway.New(map[livegateway.Protocol]livegateway.Driver{livegateway.ProtocolWHIP: driver})
	svc := Service{Gate: FixedFeatureGate{Livestreaming: true}, Authority: authority, Gateway: registry, Store: store}
	created, _ := svc.Create(ctx, "0xabc", sessionSpec())
	_, _ = svc.Start(ctx, "0xabc", created.ID)

	authority.controller = "0xdef"
	newDriver := &driverFake{}
	newRegistry, _ := livegateway.New(map[livegateway.Protocol]livegateway.Driver{livegateway.ProtocolWHIP: newDriver})
	restartedStore, _ := NewFileStore(path)
	restarted := Service{Gate: FixedFeatureGate{Livestreaming: true}, Authority: authority, Gateway: newRegistry, Store: restartedStore}
	recovered, err := restarted.Recover(ctx)
	if !errors.Is(err, ErrUnauthorized) {
		t.Fatalf("recover err=%v", err)
	}
	if len(recovered) != 1 || recovered[0].DesiredLive || recovered[0].State != livegateway.StateFailed {
		t.Fatalf("recovered=%+v", recovered)
	}
	if newDriver.starts != 0 {
		t.Fatalf("transferred stream restarted %d times", newDriver.starts)
	}
}

func TestReconnectFailureIsBoundedAndPersisted(t *testing.T) {
	ctx := context.Background()
	driver := &driverFake{startErr: errors.New("edge unavailable")}
	authority := &authorityFake{controller: "0xabc"}
	svc := serviceFixture(t, driver, authority, FixedFeatureGate{Livestreaming: true})
	svc.MaxReconnectAttempts = 2
	created, _ := svc.Create(ctx, "0xabc", sessionSpec())

	failed, err := svc.Start(ctx, "0xabc", created.ID)
	if err == nil || failed.State != livegateway.StateFailed || failed.ReconnectAttempts != 1 {
		t.Fatalf("first=%+v err=%v", failed, err)
	}
	failed, err = svc.Start(ctx, "0xabc", created.ID)
	if err == nil || failed.ReconnectAttempts != 2 {
		t.Fatalf("second=%+v err=%v", failed, err)
	}
	if _, err := svc.Start(ctx, "0xabc", created.ID); !errors.Is(err, ErrRecoveryExhausted) {
		t.Fatalf("third err=%v", err)
	}
	if driver.starts != 2 {
		t.Fatalf("unbounded reconnect attempts=%d", driver.starts)
	}
}

func TestStopPersistsDesiredFalseBeforeTransportFailure(t *testing.T) {
	ctx := context.Background()
	driver := &driverFake{stopErr: errors.New("stop failed")}
	authority := &authorityFake{controller: "0xabc"}
	svc := serviceFixture(t, driver, authority, FixedFeatureGate{Livestreaming: true})
	created, _ := svc.Create(ctx, "0xabc", sessionSpec())
	_, _ = svc.Start(ctx, "0xabc", created.ID)

	failed, err := svc.Stop(ctx, "0xabc", created.ID)
	if err == nil || failed.DesiredLive || failed.State != livegateway.StateFailed {
		t.Fatalf("failed=%+v err=%v", failed, err)
	}
	status, err := svc.Status(ctx, "0xabc", created.ID)
	if err != nil || status.DesiredLive {
		t.Fatalf("status=%+v err=%v", status, err)
	}
}

package mail

import (
	"context"
	"errors"
	"reflect"
	"testing"
	"time"
)

type routingSinkStub struct {
	order *[]string
	err   error
	calls int
}

func (s *routingSinkStub) NotifyMail(_ context.Context, _ Notification) error {
	s.calls++
	if s.order != nil {
		*s.order = append(*s.order, NotificationRoute420Notifications)
	}
	return s.err
}

type routingSignalAuthorityStub struct {
	order *[]string
	err   error
	calls int
}

func (s *routingSignalAuthorityStub) DeliverSignalNotification(_ context.Context, _ SignalNotificationRequest) (SignalNotificationReceipt, error) {
	s.calls++
	if s.order != nil {
		*s.order = append(*s.order, NotificationRouteSignal)
	}
	if s.err != nil {
		return SignalNotificationReceipt{}, s.err
	}
	return SignalNotificationReceipt{
		DeliveryID: "signal-routing-1",
		AcceptedAt: time.Unix(1700002000, 0).UTC(),
		Accepted:   true,
	}, nil
}

func TestUnifiedNotificationRouterRoutesQualifiedChannelsDeterministically(t *testing.T) {
	order := []string{}
	primary := &routingSinkStub{order: &order}
	signalAuthority := &routingSignalAuthorityStub{order: &order}
	router := NewUnifiedNotificationRouter(primary, NewSignalNotificationService(signalAuthority))

	if got, want := router.Routes(), []string{NotificationRoute420Notifications, NotificationRouteSignal}; !reflect.DeepEqual(got, want) {
		t.Fatalf("routes=%v want=%v", got, want)
	}
	if err := router.NotifyMail(context.Background(), Notification{MessageID: "msg-1", Recipient: "bob.420", Sender: "alice.420", Source: ServiceID}); err != nil {
		t.Fatal(err)
	}
	if got, want := order, []string{NotificationRoute420Notifications, NotificationRouteSignal}; !reflect.DeepEqual(got, want) {
		t.Fatalf("route order=%v want=%v", got, want)
	}
}

func TestUnifiedNotificationRouterAttemptsAllRoutesDespiteFailure(t *testing.T) {
	primaryErr := errors.New("420notifications unavailable")
	signalErr := errors.New("signal unavailable")
	primary := &routingSinkStub{err: primaryErr}
	signalAuthority := &routingSignalAuthorityStub{err: signalErr}
	router := NewUnifiedNotificationRouter(primary, NewSignalNotificationService(signalAuthority))

	err := router.NotifyMail(context.Background(), Notification{MessageID: "msg-1", Recipient: "bob.420"})
	if !errors.Is(err, primaryErr) || !errors.Is(err, signalErr) {
		t.Fatalf("routing errors not preserved: %v", err)
	}
	if primary.calls != 1 || signalAuthority.calls != 1 {
		t.Fatalf("route failure prevented fanout: primary=%d signal=%d", primary.calls, signalAuthority.calls)
	}
}

func TestUnifiedNotificationRouterRejectsMalformedEventBeforeFanout(t *testing.T) {
	primary := &routingSinkStub{}
	signalAuthority := &routingSignalAuthorityStub{}
	router := NewUnifiedNotificationRouter(primary, NewSignalNotificationService(signalAuthority))

	for _, n := range []Notification{{Recipient: "bob.420"}, {MessageID: "msg-1"}} {
		if err := router.NotifyMail(context.Background(), n); !errors.Is(err, ErrInvalidInput) {
			t.Fatalf("malformed notification accepted: %+v err=%v", n, err)
		}
	}
	if primary.calls != 0 || signalAuthority.calls != 0 {
		t.Fatalf("malformed event reached routes: primary=%d signal=%d", primary.calls, signalAuthority.calls)
	}
}

func TestUnifiedNotificationRouterDoesNotInventDiscordOrTelegramNotificationRoutes(t *testing.T) {
	router := NewUnifiedNotificationRouter(&routingSinkStub{}, NewSignalNotificationService(&routingSignalAuthorityStub{}))
	for _, route := range router.Routes() {
		if route == DiscordProvider || route == TelegramProvider {
			t.Fatalf("explicit message-delivery provider was promoted to notification route: %q", route)
		}
	}
}

func TestUnifiedNotificationRouterNoConfiguredRoutesIsNoOp(t *testing.T) {
	router := NewUnifiedNotificationRouter(nil, nil)
	if err := router.NotifyMail(context.Background(), Notification{MessageID: "msg-1", Recipient: "bob.420"}); err != nil {
		t.Fatalf("optional notification routing unexpectedly blocked: %v", err)
	}
}

package mail

import (
	"context"
	"encoding/json"
	"errors"
	"reflect"
	"strings"
	"testing"
	"time"
)

type signalNotificationAuthorityStub struct {
	req     SignalNotificationRequest
	receipt SignalNotificationReceipt
	err     error
	calls   int
}

func (s *signalNotificationAuthorityStub) DeliverSignalNotification(_ context.Context, req SignalNotificationRequest) (SignalNotificationReceipt, error) {
	s.calls++
	s.req = req
	if s.err != nil {
		return SignalNotificationReceipt{}, s.err
	}
	return s.receipt, nil
}

func acceptedSignalReceipt() SignalNotificationReceipt {
	return SignalNotificationReceipt{
		DeliveryID: "signal-delivery-1",
		AcceptedAt: time.Unix(1700000400, 0).UTC(),
		Accepted:   true,
	}
}

func TestSignalNotificationPrivacyMinimizesMailMetadata(t *testing.T) {
	authority := &signalNotificationAuthorityStub{receipt: acceptedSignalReceipt()}
	svc := NewSignalNotificationService(authority)
	n := Notification{
		MessageID: "msg-1", Recipient: "bob.420", Sender: "alice.420", Source: "secret-source",
	}
	out, err := svc.Notify(context.Background(), n)
	if err != nil {
		t.Fatal(err)
	}
	if !out.Accepted || authority.calls != 1 {
		t.Fatalf("unexpected result/calls: %+v calls=%d", out, authority.calls)
	}
	if authority.req.EventID != "mail:msg-1" ||
		authority.req.RecipientIdentity != "bob.420" ||
		authority.req.Kind != SignalNotificationKind ||
		authority.req.Title != "New 420Mail message" ||
		authority.req.IdempotencyKey == "" {
		t.Fatalf("unexpected request: %+v", authority.req)
	}
	raw, _ := json.Marshal(authority.req)
	for _, forbidden := range []string{"alice.420", "secret-source", "body", "subject", "sender"} {
		if strings.Contains(strings.ToLower(string(raw)), strings.ToLower(forbidden)) {
			t.Fatalf("privacy-minimized Signal request leaked %q: %s", forbidden, raw)
		}
	}
	typ := reflect.TypeOf(SignalNotificationRequest{})
	for _, forbiddenField := range []string{"Body", "Subject", "Sender", "Source"} {
		if _, ok := typ.FieldByName(forbiddenField); ok {
			t.Fatalf("Signal notification request unexpectedly exposes %s", forbiddenField)
		}
	}
}

func TestSignalNotificationIdempotencyIsDeterministicAndRecipientBound(t *testing.T) {
	a := signalNotificationIdempotencyKey("bob.420", "msg-1")
	b := signalNotificationIdempotencyKey("bob.420", "msg-1")
	c := signalNotificationIdempotencyKey("mallory.420", "msg-1")
	d := signalNotificationIdempotencyKey("bob.420", "msg-2")
	if a == "" || a != b || a == c || a == d {
		t.Fatalf("idempotency binding failed: %q %q %q %q", a, b, c, d)
	}
}

func TestSignalNotificationAllowsConsentSuppressionWithoutDeliveryEvidence(t *testing.T) {
	authority := &signalNotificationAuthorityStub{receipt: SignalNotificationReceipt{Suppressed: true}}
	out, err := NewSignalNotificationService(authority).Notify(context.Background(), Notification{
		MessageID: "msg-1", Recipient: "bob.420",
	})
	if err != nil {
		t.Fatal(err)
	}
	if !out.Suppressed || out.Accepted || out.DeliveryID != "" || !out.AcceptedAt.IsZero() {
		t.Fatalf("unexpected suppressed result: %+v", out)
	}
}

func TestSignalNotificationRejectsInvalidAuthorityResults(t *testing.T) {
	cases := []SignalNotificationReceipt{
		{},
		{Accepted: true},
		{Accepted: true, Suppressed: true, DeliveryID: "x", AcceptedAt: time.Now().UTC()},
		{Suppressed: true, DeliveryID: "should-not-exist"},
		{Suppressed: true, AcceptedAt: time.Now().UTC()},
	}
	for _, receipt := range cases {
		authority := &signalNotificationAuthorityStub{receipt: receipt}
		_, err := NewSignalNotificationService(authority).Notify(context.Background(), Notification{
			MessageID: "msg-1", Recipient: "bob.420",
		})
		if !errors.Is(err, ErrSignalNotificationInvalidResult) {
			t.Fatalf("invalid receipt accepted: %+v err=%v", receipt, err)
		}
	}
}

func TestSignalNotificationRejectsMalformedNotificationBeforeAuthority(t *testing.T) {
	for _, n := range []Notification{
		{Recipient: "bob.420"},
		{MessageID: "msg-1"},
	} {
		authority := &signalNotificationAuthorityStub{receipt: acceptedSignalReceipt()}
		_, err := NewSignalNotificationService(authority).Notify(context.Background(), n)
		if !errors.Is(err, ErrInvalidInput) {
			t.Fatalf("invalid notification accepted: %+v err=%v", n, err)
		}
		if authority.calls != 0 {
			t.Fatal("invalid notification reached Signal authority")
		}
	}
}

func TestSignalNotificationSinkPreservesPrimary420Notifications(t *testing.T) {
	primary := &testNotify{}
	authority := &signalNotificationAuthorityStub{receipt: acceptedSignalReceipt()}
	sink := NewSignalNotificationSink(primary, NewSignalNotificationService(authority))
	err := sink.NotifyMail(context.Background(), Notification{
		MessageID: "msg-1", Recipient: "bob.420", Sender: "alice.420", Source: ServiceID,
	})
	if err != nil {
		t.Fatal(err)
	}
	if primary.Count() != 1 || authority.calls != 1 {
		t.Fatalf("fanout mismatch: primary=%d signal=%d", primary.Count(), authority.calls)
	}
}

func TestMailSendEmitsSignalNotificationThroughExistingNotificationPath(t *testing.T) {
	primary := &testNotify{}
	authority := &signalNotificationAuthorityStub{receipt: acceptedSignalReceipt()}
	sink := NewSignalNotificationSink(primary, NewSignalNotificationService(authority))
	svc := NewService(
		testIDs{"alice.420": true, "bob.420": true},
		testPolicy{},
		&testBlobs{},
		sink,
		NewMemoryStore(),
	)
	svc.Now = func() time.Time { return time.Unix(1700000000, 0).UTC() }
	req := SendRequest{
		IdempotencyKey: "signal-notify-send-1",
		Sender: "alice.420", Recipient: "bob.420", Subject: "private subject",
		Body: "private body", Source: ServiceID,
	}
	if _, err := svc.Send(context.Background(), "alice.420", req); err != nil {
		t.Fatal(err)
	}
	if primary.Count() != 1 || authority.calls != 1 {
		t.Fatalf("notification fanout mismatch: primary=%d signal=%d", primary.Count(), authority.calls)
	}
	if strings.Contains(authority.req.Title, req.Subject) ||
		strings.Contains(authority.req.Title, req.Body) ||
		strings.Contains(authority.req.Title, req.Sender) {
		t.Fatalf("Signal notification leaked private mail metadata: %+v", authority.req)
	}
}

func TestSignalTransportFailureDoesNotRollbackMailAndDuplicateSendDoesNotRenotify(t *testing.T) {
	primary := &testNotify{}
	authority := &signalNotificationAuthorityStub{err: errors.New("signal unavailable")}
	sink := NewSignalNotificationSink(primary, NewSignalNotificationService(authority))
	svc := NewService(
		testIDs{"alice.420": true, "bob.420": true},
		testPolicy{},
		&testBlobs{},
		sink,
		NewMemoryStore(),
	)
	svc.Now = func() time.Time { return time.Unix(1700000000, 0).UTC() }
	req := SendRequest{
		IdempotencyKey: "signal-failure-send-1",
		Sender: "alice.420", Recipient: "bob.420", Subject: "hello", Body: "private body", Source: ServiceID,
	}
	first, err := svc.Send(context.Background(), "alice.420", req)
	if err != nil {
		t.Fatalf("Signal outage rolled back Mail send: %v", err)
	}
	second, err := svc.Send(context.Background(), "alice.420", req)
	if err != nil {
		t.Fatalf("idempotent replay failed: %v", err)
	}
	if first.ID != second.ID {
		t.Fatal("idempotent replay created a second Mail message")
	}
	if primary.Count() != 1 || authority.calls != 1 {
		t.Fatalf("duplicate notification emitted: primary=%d signal=%d", primary.Count(), authority.calls)
	}
	page, err := svc.Inbox(context.Background(), "bob.420", "", 10)
	if err != nil {
		t.Fatal(err)
	}
	if len(page.Items) != 1 || page.Items[0].ID != first.ID {
		t.Fatalf("Mail delivery missing after Signal outage: %+v", page.Items)
	}
}

func TestSignalNotificationAuthorityFailureDoesNotCreateFallbackPayload(t *testing.T) {
	dep := errors.New("signal transport unavailable")
	authority := &signalNotificationAuthorityStub{err: dep}
	_, err := NewSignalNotificationService(authority).Notify(context.Background(), Notification{
		MessageID: "msg-1", Recipient: "bob.420",
	})
	if !errors.Is(err, dep) {
		t.Fatalf("dependency error lost: %v", err)
	}
	if authority.calls != 1 {
		t.Fatalf("unexpected authority calls: %d", authority.calls)
	}
}

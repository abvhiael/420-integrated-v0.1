package mail

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

type signalShareAuthorityStub struct {
	payload SignalSharePayload
	receipt SignalShareReceipt
	err     error
	calls   int
}

func (s *signalShareAuthorityStub) DeliverSignalShare(_ context.Context, payload SignalSharePayload) (SignalShareReceipt, error) {
	s.calls++
	s.payload = payload
	if s.err != nil {
		return SignalShareReceipt{}, s.err
	}
	return s.receipt, nil
}

func acceptedSignalShareReceipt() SignalShareReceipt {
	return SignalShareReceipt{
		DeliveryID: "signal-share-1",
		AcceptedAt: time.Unix(1700000500, 0).UTC(),
		Accepted:   true,
	}
}

func signalShareHarness(t *testing.T) (*Service, *SignalShareService, *signalShareAuthorityStub, Message) {
	t.Helper()
	blobs := &testBlobs{}
	mail := NewService(
		testIDs{"alice.420": true, "bob.420": true},
		testPolicy{},
		blobs,
		&testNotify{},
		NewMemoryStore(),
	)
	mail.Now = func() time.Time { return time.Unix(1700000000, 0).UTC() }
	msg, err := mail.Send(context.Background(), "alice.420", SendRequest{
		IdempotencyKey: "signal-share-seed",
		Sender:         "alice.420",
		Recipient:      "bob.420",
		Subject:        "private subject",
		Body:           "private body",
		Source:         ServiceID,
	})
	if err != nil {
		t.Fatal(err)
	}
	authority := &signalShareAuthorityStub{receipt: acceptedSignalShareReceipt()}
	return mail, NewSignalShareService(mail, authority), authority, msg
}

func validSignalShareRequest(messageID string) SignalShareRequest {
	return SignalShareRequest{
		MessageID:      messageID,
		DestinationRef: "signal-destination:opaque-1",
		Mode:           SignalShareModeShare,
		Note:           "optional note",
		IdempotencyKey: "signal-share-idem-1",
	}
}

func TestSignalShareRequiresOwnedLiveMailboxCopy(t *testing.T) {
	_, svc, authority, msg := signalShareHarness(t)
	req := validSignalShareRequest(msg.ID)

	if _, err := svc.Deliver(context.Background(), "mallory.420", req); !errors.Is(err, ErrUnauthorized) && !errors.Is(err, ErrNotFound) {
		t.Fatalf("foreign message export accepted: %v", err)
	}
	if authority.calls != 0 {
		t.Fatal("foreign export reached Signal authority")
	}
}

func TestSignalShareExportsBodyOnlyAfterAuthorizedRead(t *testing.T) {
	_, svc, authority, msg := signalShareHarness(t)
	req := validSignalShareRequest(msg.ID)
	out, err := svc.Deliver(context.Background(), "bob.420", req)
	if err != nil {
		t.Fatal(err)
	}
	if !out.Accepted || authority.calls != 1 {
		t.Fatalf("unexpected result/calls: %+v calls=%d", out, authority.calls)
	}
	if authority.payload.Actor != "bob.420" ||
		authority.payload.SourceMessageID != msg.ID ||
		authority.payload.DestinationRef != req.DestinationRef ||
		authority.payload.Mode != SignalShareModeShare ||
		authority.payload.Content != "private body" ||
		authority.payload.Note != req.Note ||
		authority.payload.IdempotencyKey != req.IdempotencyKey {
		t.Fatalf("unexpected Signal share payload: %+v", authority.payload)
	}
	if authority.payload.Subject != "" {
		t.Fatalf("SHARE unexpectedly forwarded subject: %+v", authority.payload)
	}
}

func TestSignalForwardIncludesSubjectButNotImplicitSenderMetadata(t *testing.T) {
	_, svc, authority, msg := signalShareHarness(t)
	req := validSignalShareRequest(msg.ID)
	req.Mode = SignalShareModeForward
	req.IdempotencyKey = "signal-forward-idem-1"
	if _, err := svc.Deliver(context.Background(), "bob.420", req); err != nil {
		t.Fatal(err)
	}
	if authority.payload.Subject != "private subject" || authority.payload.Content != "private body" {
		t.Fatalf("forward payload incomplete: %+v", authority.payload)
	}
	raw, _ := json.Marshal(authority.payload)
	if strings.Contains(string(raw), "alice.420") {
		t.Fatalf("forward leaked sender metadata without explicit field: %s", raw)
	}
}

func TestSignalShareRejectsDeletedMailboxCopy(t *testing.T) {
	mail, svc, authority, msg := signalShareHarness(t)
	if err := mail.PermanentlyDelete(context.Background(), "bob.420", msg.ID); err != nil {
		t.Fatal(err)
	}
	_, err := svc.Deliver(context.Background(), "bob.420", validSignalShareRequest(msg.ID))
	if !errors.Is(err, ErrNotFound) {
		t.Fatalf("deleted message export accepted: %v", err)
	}
	if authority.calls != 0 {
		t.Fatal("deleted export reached Signal authority")
	}
}

func TestSignalShareRejectsMalformedInputBeforeAuthority(t *testing.T) {
	_, svc, authority, msg := signalShareHarness(t)
	cases := []func(*SignalShareRequest){
		func(r *SignalShareRequest) { r.MessageID = "" },
		func(r *SignalShareRequest) { r.DestinationRef = "" },
		func(r *SignalShareRequest) { r.DestinationRef = strings.Repeat("x", MaxSignalDestinationRefBytes+1) },
		func(r *SignalShareRequest) { r.Mode = "BAD" },
		func(r *SignalShareRequest) { r.Note = strings.Repeat("x", MaxSignalShareNoteBytes+1) },
		func(r *SignalShareRequest) { r.IdempotencyKey = "" },
	}
	for _, mutate := range cases {
		req := validSignalShareRequest(msg.ID)
		mutate(&req)
		before := authority.calls
		if _, err := svc.Deliver(context.Background(), "bob.420", req); !errors.Is(err, ErrInvalidInput) {
			t.Fatalf("invalid request accepted: %+v err=%v", req, err)
		}
		if authority.calls != before {
			t.Fatalf("invalid request reached authority: %+v", req)
		}
	}
}

func TestSignalShareRejectsInvalidAuthorityReceipt(t *testing.T) {
	cases := []SignalShareReceipt{
		{},
		{Accepted: true},
		{Accepted: false, DeliveryID: "x", AcceptedAt: time.Now().UTC()},
	}
	for _, receipt := range cases {
		_, svc, authority, msg := signalShareHarness(t)
		authority.receipt = receipt
		_, err := svc.Deliver(context.Background(), "bob.420", validSignalShareRequest(msg.ID))
		if !errors.Is(err, ErrSignalShareInvalidResult) {
			t.Fatalf("invalid receipt accepted: %+v err=%v", receipt, err)
		}
	}
}

func TestSignalSharePropagatesAuthorityFailureWithoutFallback(t *testing.T) {
	_, svc, authority, msg := signalShareHarness(t)
	dep := errors.New("signal share unavailable")
	authority.err = dep
	_, err := svc.Deliver(context.Background(), "bob.420", validSignalShareRequest(msg.ID))
	if !errors.Is(err, dep) {
		t.Fatalf("dependency error lost: %v", err)
	}
	if authority.calls != 1 {
		t.Fatalf("unexpected authority calls: %d", authority.calls)
	}
}

func signalShareHTTPHandler(t *testing.T) (HTTPHandler, *signalShareAuthorityStub, Message) {
	t.Helper()
	mail, share, authority, msg := signalShareHarness(t)
	return HTTPHandler{
		Service:      mail,
		SignalShare:  share,
		Authenticate: func(r *http.Request) (string, error) { return r.Header.Get("X-Test-Actor"), nil },
	}, authority, msg
}

func TestHTTPSignalShareAndForward(t *testing.T) {
	h, authority, msg := signalShareHTTPHandler(t)
	reqBody := validSignalShareRequest(msg.ID)
	reqBody.Mode = SignalShareModeForward
	raw, _ := json.Marshal(reqBody)
	req := httptest.NewRequest(http.MethodPost, "/v1/connectors/signal/share", bytes.NewReader(raw))
	req.Header.Set("X-Test-Actor", "bob.420")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("status=%d body=%s", rec.Code, rec.Body.String())
	}
	if authority.payload.Mode != SignalShareModeForward || authority.payload.Subject != "private subject" {
		t.Fatalf("forward not delegated: %+v", authority.payload)
	}
}

func TestHTTPSignalShareRequiresAuthentication(t *testing.T) {
	h, authority, msg := signalShareHTTPHandler(t)
	raw, _ := json.Marshal(validSignalShareRequest(msg.ID))
	req := httptest.NewRequest(http.MethodPost, "/v1/connectors/signal/share", bytes.NewReader(raw))
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status=%d body=%s", rec.Code, rec.Body.String())
	}
	if authority.calls != 0 {
		t.Fatal("unauthenticated share reached authority")
	}
}

func TestHTTPSignalShareRejectsCredentialBearingFields(t *testing.T) {
	h, authority, msg := signalShareHTTPHandler(t)
	req := httptest.NewRequest(http.MethodPost, "/v1/connectors/signal/share", bytes.NewBufferString(
		`{"message_id":"`+msg.ID+`","destination_ref":"signal-destination:opaque-1","mode":"SHARE","idempotency_key":"k","phone_number":"+15555550100"}`))
	req.Header.Set("X-Test-Actor", "bob.420")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status=%d body=%s", rec.Code, rec.Body.String())
	}
	if authority.calls != 0 {
		t.Fatal("credential-bearing request reached Signal authority")
	}
}

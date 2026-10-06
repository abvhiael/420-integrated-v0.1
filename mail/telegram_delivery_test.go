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

type telegramDeliveryAuthorityStub struct {
	telegramLinkAuthorityStub
	receipt TelegramDeliveryReceipt
	err     error
	actor   string
	userID  string
	idem    string
	message TelegramDeliveryMessage
}

func (s *telegramDeliveryAuthorityStub) DeliverTelegram(_ context.Context, actor, userID, idem string, message TelegramDeliveryMessage) (TelegramDeliveryReceipt, error) {
	s.actor, s.userID, s.idem, s.message = actor, userID, idem, message
	if s.err != nil {
		return TelegramDeliveryReceipt{}, s.err
	}
	return s.receipt, nil
}

func validTelegramDeliveryAuthority() *telegramDeliveryAuthorityStub {
	return &telegramDeliveryAuthorityStub{
		telegramLinkAuthorityStub: telegramLinkAuthorityStub{account: validTelegramAccount()},
		receipt: TelegramDeliveryReceipt{
			MessageID: "84",
			ChatID: "-1001234567890",
			AcceptedAt: time.Unix(1700000900, 0).UTC(),
		},
	}
}

func validTelegramDeliveryRequest() TelegramDeliveryRequest {
	return TelegramDeliveryRequest{
		ConnectionID: "telegram:1234567890",
		ChatID: "-1001234567890",
		Content: "hello telegram",
		IdempotencyKey: "telegram-delivery-1",
	}
}

func TestTelegramDescriptorAddsPushOnlyWithDeliveryAuthority(t *testing.T) {
	d := NewTelegramConnectorAdapter(validTelegramDeliveryAuthority()).Descriptor()
	if !connectorHasCapability(d, ConnectorCapabilityLink) || !connectorHasCapability(d, ConnectorCapabilityPush) {
		t.Fatalf("Telegram delivery capability missing: %+v", d.Capabilities)
	}
	if connectorHasCapability(d, ConnectorCapabilityPull) || connectorHasCapability(d, ConnectorCapabilityWebhook) || connectorHasCapability(d, ConnectorCapabilityWalletVerify) {
		t.Fatalf("unconfigured Telegram capability advertised: %+v", d.Capabilities)
	}
}

func TestTelegramDeliveryUsesLinkedConnectionAndIdempotency(t *testing.T) {
	authority := validTelegramDeliveryAuthority()
	connectors, err := NewTelegramConnectorService(authority)
	if err != nil {
		t.Fatal(err)
	}
	out, err := NewTelegramDeliveryService(connectors).Deliver(context.Background(), "alice.420", validTelegramDeliveryRequest())
	if err != nil {
		t.Fatal(err)
	}
	if !out.Accepted || out.MessageID != authority.receipt.MessageID || out.ChatID != authority.receipt.ChatID {
		t.Fatalf("unexpected delivery: %+v", out)
	}
	if authority.actor != "alice.420" || authority.userID != "1234567890" || authority.idem != "telegram-delivery-1" || authority.message.Content != "hello telegram" {
		t.Fatalf("authority input mismatch: actor=%q user=%q idem=%q msg=%+v", authority.actor, authority.userID, authority.idem, authority.message)
	}
}

func TestTelegramDeliverySupportsReplyTarget(t *testing.T) {
	authority := validTelegramDeliveryAuthority()
	connectors, _ := NewTelegramConnectorService(authority)
	req := validTelegramDeliveryRequest()
	req.ReplyToMessageID = "83"
	if _, err := NewTelegramDeliveryService(connectors).Deliver(context.Background(), "alice.420", req); err != nil {
		t.Fatal(err)
	}
	if authority.message.ReplyToMessageID != "83" {
		t.Fatalf("reply target lost: %+v", authority.message)
	}
}

func TestTelegramDeliveryRejectsInvalidInputBeforeAuthority(t *testing.T) {
	cases := []func(*TelegramDeliveryRequest){
		func(r *TelegramDeliveryRequest) { r.ConnectionID = "bad" },
		func(r *TelegramDeliveryRequest) { r.ChatID = "--1" },
		func(r *TelegramDeliveryRequest) { r.Content = "" },
		func(r *TelegramDeliveryRequest) { r.Content = strings.Repeat("x", MaxTelegramDeliveryContentBytes+1) },
		func(r *TelegramDeliveryRequest) { r.IdempotencyKey = "" },
		func(r *TelegramDeliveryRequest) { r.ReplyToMessageID = "bad" },
	}
	for _, mutate := range cases {
		authority := validTelegramDeliveryAuthority()
		connectors, _ := NewTelegramConnectorService(authority)
		req := validTelegramDeliveryRequest()
		mutate(&req)
		if _, err := NewTelegramDeliveryService(connectors).Deliver(context.Background(), "alice.420", req); !errors.Is(err, ErrInvalidInput) {
			t.Fatalf("invalid request accepted: %+v err=%v", req, err)
		}
		if authority.actor != "" {
			t.Fatalf("invalid request reached authority: %+v", req)
		}
	}
}

func TestTelegramDeliveryRejectsInvalidProviderReceipt(t *testing.T) {
	cases := []func(*TelegramDeliveryReceipt){
		func(r *TelegramDeliveryReceipt) { r.MessageID = "bad" },
		func(r *TelegramDeliveryReceipt) { r.ChatID = "-1009999999999" },
		func(r *TelegramDeliveryReceipt) { r.AcceptedAt = time.Time{} },
	}
	for _, mutate := range cases {
		authority := validTelegramDeliveryAuthority()
		mutate(&authority.receipt)
		connectors, _ := NewTelegramConnectorService(authority)
		if _, err := NewTelegramDeliveryService(connectors).Deliver(context.Background(), "alice.420", validTelegramDeliveryRequest()); !errors.Is(err, ErrTelegramInvalidResult) && !errors.Is(err, ErrConnectorInvalidResult) {
			t.Fatalf("invalid provider receipt accepted: %+v err=%v", authority.receipt, err)
		}
	}
}

func TestTelegramDeliveryPropagatesAuthorityFailureWithoutFallback(t *testing.T) {
	authority := validTelegramDeliveryAuthority()
	authority.err = errors.New("telegram unavailable")
	connectors, _ := NewTelegramConnectorService(authority)
	if _, err := NewTelegramDeliveryService(connectors).Deliver(context.Background(), "alice.420", validTelegramDeliveryRequest()); err == nil {
		t.Fatal("authority failure unexpectedly succeeded")
	}
}

func TestTelegramLinkSyncOnlyAuthorityRejectsPush(t *testing.T) {
	authority := &telegramFullAuthorityStub{}
	connectors, err := NewTelegramConnectorService(authority)
	if err != nil {
		t.Fatal(err)
	}
	_, err = connectors.Push(context.Background(), "alice.420", ConnectorPushRequest{
		Provider: TelegramProvider, ConnectionID: "telegram:1234567890",
		Kind: TelegramDeliveryKind, Payload: `{"chat_id":"-1001234567890","content":"x"}`, IdempotencyKey: "k",
	})
	if !errors.Is(err, ErrConnectorUnsupported) {
		t.Fatalf("non-delivery authority unexpectedly pushed: %v", err)
	}
}

func telegramDeliveryHTTPHandler(t *testing.T, authority *telegramDeliveryAuthorityStub) HTTPHandler {
	t.Helper()
	connectors, err := NewTelegramConnectorService(authority)
	if err != nil {
		t.Fatal(err)
	}
	return HTTPHandler{
		Service: NewService(testIDs{"alice.420": true}, testPolicy{}, &testBlobs{}, &testNotify{}, NewMemoryStore()),
		Connectors: connectors,
		TelegramDelivery: NewTelegramDeliveryService(connectors),
		Authenticate: func(r *http.Request) (string, error) { return r.Header.Get("X-Test-Actor"), nil },
	}
}

func TestHTTPTelegramDelivery(t *testing.T) {
	authority := validTelegramDeliveryAuthority()
	h := telegramDeliveryHTTPHandler(t, authority)
	raw, _ := json.Marshal(validTelegramDeliveryRequest())
	req := httptest.NewRequest(http.MethodPost, "/v1/connectors/telegram/deliver", bytes.NewReader(raw))
	req.Header.Set("X-Test-Actor", "alice.420")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("status=%d body=%s", rec.Code, rec.Body.String())
	}
	var out TelegramDeliveryResult
	if err := json.Unmarshal(rec.Body.Bytes(), &out); err != nil {
		t.Fatal(err)
	}
	if !out.Accepted || out.MessageID != authority.receipt.MessageID {
		t.Fatalf("unexpected response: %+v", out)
	}
}

func TestHTTPTelegramDeliveryRequiresAuthentication(t *testing.T) {
	authority := validTelegramDeliveryAuthority()
	h := telegramDeliveryHTTPHandler(t, authority)
	raw, _ := json.Marshal(validTelegramDeliveryRequest())
	req := httptest.NewRequest(http.MethodPost, "/v1/connectors/telegram/deliver", bytes.NewReader(raw))
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusUnauthorized || authority.actor != "" {
		t.Fatalf("unauthenticated delivery status=%d actor=%q", rec.Code, authority.actor)
	}
}

func TestHTTPTelegramDeliveryRejectsSecretBearingFields(t *testing.T) {
	authority := validTelegramDeliveryAuthority()
	h := telegramDeliveryHTTPHandler(t, authority)
	req := httptest.NewRequest(http.MethodPost, "/v1/connectors/telegram/deliver", bytes.NewBufferString(
		`{"connection_id":"telegram:1234567890","chat_id":"-1001234567890","content":"x","idempotency_key":"k","bot_token":"secret"}`))
	req.Header.Set("X-Test-Actor", "alice.420")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusBadRequest || authority.actor != "" {
		t.Fatalf("secret-bearing request status=%d actor=%q", rec.Code, authority.actor)
	}
}

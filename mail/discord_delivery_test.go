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

type discordDeliveryAuthorityStub struct {
	discordLinkAuthorityStub
	receipt DiscordDeliveryReceipt
	err     error
	actor   string
	userID  string
	idem    string
	message DiscordDeliveryMessage
}

func (s *discordDeliveryAuthorityStub) DeliverDiscord(_ context.Context, actor, userID, idem string, message DiscordDeliveryMessage) (DiscordDeliveryReceipt, error) {
	s.actor, s.userID, s.idem, s.message = actor, userID, idem, message
	if s.err != nil {
		return DiscordDeliveryReceipt{}, s.err
	}
	return s.receipt, nil
}

func validDiscordDeliveryAuthority() *discordDeliveryAuthorityStub {
	return &discordDeliveryAuthorityStub{
		discordLinkAuthorityStub: discordLinkAuthorityStub{account: validDiscordAccount()},
		receipt: DiscordDeliveryReceipt{
			MessageID:  "523456789012345678",
			ChannelID:  "423456789012345678",
			AcceptedAt: time.Unix(1700000300, 0).UTC(),
		},
	}
}

func validDiscordDeliveryRequest() DiscordDeliveryRequest {
	return DiscordDeliveryRequest{
		ConnectionID:   "discord:123456789012345678",
		ChannelID:      "423456789012345678",
		Content:        "hello discord",
		IdempotencyKey: "delivery-1",
	}
}

func TestDiscordDescriptorAddsPushWithDeliveryAuthority(t *testing.T) {
	d := NewDiscordConnectorAdapter(validDiscordDeliveryAuthority()).Descriptor()
	if !connectorHasCapability(d, ConnectorCapabilityLink) || !connectorHasCapability(d, ConnectorCapabilityPush) || !connectorHasCapability(d, ConnectorCapabilityWalletVerify) {
		t.Fatalf("Discord delivery/wallet capabilities missing: %+v", d.Capabilities)
	}
	if connectorHasCapability(d, ConnectorCapabilityWebhook) {
		t.Fatalf("unconfigured Discord webhook capability advertised: %+v", d.Capabilities)
	}
}

func TestDiscordDeliveryUsesLinkedConnectionAndIdempotency(t *testing.T) {
	authority := validDiscordDeliveryAuthority()
	connectors, err := NewDiscordConnectorService(authority)
	if err != nil {
		t.Fatal(err)
	}
	svc := NewDiscordDeliveryService(connectors)
	req := validDiscordDeliveryRequest()
	out, err := svc.Deliver(context.Background(), "alice.420", req)
	if err != nil {
		t.Fatal(err)
	}
	if !out.Accepted || out.MessageID != authority.receipt.MessageID || out.ChannelID != req.ChannelID {
		t.Fatalf("unexpected delivery: %+v", out)
	}
	if authority.actor != "alice.420" || authority.userID != "123456789012345678" || authority.idem != req.IdempotencyKey || authority.message.Content != req.Content {
		t.Fatalf("authority input mismatch: actor=%q user=%q idem=%q msg=%+v", authority.actor, authority.userID, authority.idem, authority.message)
	}
}

func TestDiscordDeliverySupportsReplyTarget(t *testing.T) {
	authority := validDiscordDeliveryAuthority()
	connectors, _ := NewDiscordConnectorService(authority)
	req := validDiscordDeliveryRequest()
	req.ReplyToMessageID = "623456789012345678"
	if _, err := NewDiscordDeliveryService(connectors).Deliver(context.Background(), "alice.420", req); err != nil {
		t.Fatal(err)
	}
	if authority.message.ReplyToMessageID != req.ReplyToMessageID {
		t.Fatalf("reply target lost: %+v", authority.message)
	}
}

func TestDiscordDeliveryRejectsInvalidInputBeforeAuthority(t *testing.T) {
	cases := []func(*DiscordDeliveryRequest){
		func(r *DiscordDeliveryRequest) { r.ConnectionID = "bad" },
		func(r *DiscordDeliveryRequest) { r.ChannelID = "bad" },
		func(r *DiscordDeliveryRequest) { r.Content = "" },
		func(r *DiscordDeliveryRequest) { r.Content = strings.Repeat("x", MaxDiscordDeliveryContentBytes+1) },
		func(r *DiscordDeliveryRequest) { r.IdempotencyKey = "" },
		func(r *DiscordDeliveryRequest) { r.ReplyToMessageID = "bad" },
	}
	for _, mutate := range cases {
		authority := validDiscordDeliveryAuthority()
		connectors, _ := NewDiscordConnectorService(authority)
		req := validDiscordDeliveryRequest()
		mutate(&req)
		if _, err := NewDiscordDeliveryService(connectors).Deliver(context.Background(), "alice.420", req); !errors.Is(err, ErrInvalidInput) {
			t.Fatalf("invalid request accepted: %+v err=%v", req, err)
		}
		if authority.actor != "" {
			t.Fatalf("invalid request reached authority: %+v", req)
		}
	}
}

func TestDiscordDeliveryRejectsInvalidProviderReceipt(t *testing.T) {
	cases := []func(*DiscordDeliveryReceipt){
		func(r *DiscordDeliveryReceipt) { r.MessageID = "bad" },
		func(r *DiscordDeliveryReceipt) { r.ChannelID = "723456789012345678" },
		func(r *DiscordDeliveryReceipt) { r.AcceptedAt = time.Time{} },
	}
	for _, mutate := range cases {
		authority := validDiscordDeliveryAuthority()
		mutate(&authority.receipt)
		connectors, _ := NewDiscordConnectorService(authority)
		if _, err := NewDiscordDeliveryService(connectors).Deliver(context.Background(), "alice.420", validDiscordDeliveryRequest()); !errors.Is(err, ErrDiscordInvalidResult) && !errors.Is(err, ErrConnectorInvalidResult) {
			t.Fatalf("invalid provider result accepted: %+v err=%v", authority.receipt, err)
		}
	}
}

func TestDiscordDeliveryPropagatesAuthorityFailure(t *testing.T) {
	authority := validDiscordDeliveryAuthority()
	authority.err = errors.New("discord unavailable")
	connectors, _ := NewDiscordConnectorService(authority)
	if _, err := NewDiscordDeliveryService(connectors).Deliver(context.Background(), "alice.420", validDiscordDeliveryRequest()); err == nil {
		t.Fatal("authority failure unexpectedly succeeded")
	}
}

func TestDiscordLinkOnlyAuthorityStillRejectsPush(t *testing.T) {
	connectors, err := NewDiscordConnectorService(&discordLinkAuthorityStub{account: validDiscordAccount()})
	if err != nil {
		t.Fatal(err)
	}
	_, err = connectors.Push(context.Background(), "alice.420", ConnectorPushRequest{
		Provider: DiscordProvider, ConnectionID: "discord:123456789012345678",
		Kind: DiscordDeliveryKind, Payload: `{"channel_id":"423456789012345678","content":"x"}`, IdempotencyKey: "k",
	})
	if !errors.Is(err, ErrConnectorUnsupported) {
		t.Fatalf("link-only authority unexpectedly pushed: %v", err)
	}
}

func discordDeliveryHTTPHandler(t *testing.T, authority *discordDeliveryAuthorityStub) HTTPHandler {
	t.Helper()
	connectors, err := NewDiscordConnectorService(authority)
	if err != nil {
		t.Fatal(err)
	}
	return HTTPHandler{
		Service:         NewService(testIDs{"alice.420": true}, testPolicy{}, &testBlobs{}, &testNotify{}, NewMemoryStore()),
		Connectors:      connectors,
		DiscordDelivery: NewDiscordDeliveryService(connectors),
		Authenticate: func(r *http.Request) (string, error) {
			return r.Header.Get("X-Test-Actor"), nil
		},
	}
}

func TestHTTPDiscordDelivery(t *testing.T) {
	authority := validDiscordDeliveryAuthority()
	h := discordDeliveryHTTPHandler(t, authority)
	raw, _ := json.Marshal(validDiscordDeliveryRequest())
	req := httptest.NewRequest(http.MethodPost, "/v1/connectors/discord/deliver", bytes.NewReader(raw))
	req.Header.Set("X-Test-Actor", "alice.420")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("status=%d body=%s", rec.Code, rec.Body.String())
	}
	var out DiscordDeliveryResult
	if err := json.Unmarshal(rec.Body.Bytes(), &out); err != nil {
		t.Fatal(err)
	}
	if !out.Accepted || out.MessageID != authority.receipt.MessageID {
		t.Fatalf("unexpected response: %+v", out)
	}
}

func TestHTTPDiscordDeliveryRequiresAuthentication(t *testing.T) {
	authority := validDiscordDeliveryAuthority()
	h := discordDeliveryHTTPHandler(t, authority)
	raw, _ := json.Marshal(validDiscordDeliveryRequest())
	req := httptest.NewRequest(http.MethodPost, "/v1/connectors/discord/deliver", bytes.NewReader(raw))
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status=%d body=%s", rec.Code, rec.Body.String())
	}
	if authority.actor != "" {
		t.Fatal("unauthenticated delivery reached authority")
	}
}

func TestHTTPDiscordDeliveryRejectsSecretBearingFields(t *testing.T) {
	authority := validDiscordDeliveryAuthority()
	h := discordDeliveryHTTPHandler(t, authority)
	req := httptest.NewRequest(http.MethodPost, "/v1/connectors/discord/deliver", bytes.NewBufferString(
		`{"connection_id":"discord:123456789012345678","channel_id":"423456789012345678","content":"x","idempotency_key":"k","access_token":"secret"}`))
	req.Header.Set("X-Test-Actor", "alice.420")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status=%d body=%s", rec.Code, rec.Body.String())
	}
	if authority.actor != "" {
		t.Fatal("secret-bearing request reached authority")
	}
}

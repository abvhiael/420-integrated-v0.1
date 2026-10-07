package mail

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

type telegramLinkAuthorityStub struct {
	account      TelegramAccount
	err          error
	unlinkErr    error
	linkActor    string
	authRef      string
	unlinkActor  string
	unlinkUserID string
	linkCalls    int
	unlinkCalls  int
}

func (s *telegramLinkAuthorityStub) LinkTelegram(_ context.Context, actor, authorizationRef string) (TelegramAccount, error) {
	s.linkCalls++
	s.linkActor = actor
	s.authRef = authorizationRef
	if s.err != nil {
		return TelegramAccount{}, s.err
	}
	return s.account, nil
}

func (s *telegramLinkAuthorityStub) UnlinkTelegram(_ context.Context, actor, userID string) error {
	s.unlinkCalls++
	s.unlinkActor = actor
	s.unlinkUserID = userID
	return s.unlinkErr
}

func validTelegramAccount() TelegramAccount {
	return TelegramAccount{
		UserID:       "1234567890",
		Username:     "alice_telegram",
		FirstName:    "Alice",
		LastName:     "Example",
		Verified:     true,
		NonCustodial: true,
		LinkedAt:     time.Unix(1700000600, 0).UTC(),
	}
}

func TestTelegramConnectorDescriptorIsLinkOnly(t *testing.T) {
	d := NewTelegramConnectorAdapter(nil).Descriptor()
	if d.Provider != TelegramProvider || d.DisplayName != "Telegram" {
		t.Fatalf("unexpected descriptor: %+v", d)
	}
	if len(d.Capabilities) != 1 || d.Capabilities[0] != ConnectorCapabilityLink {
		t.Fatalf("MAIL-2.23 must remain link-only: %+v", d.Capabilities)
	}
}

func TestTelegramLinkDelegatesAuthorizationAndNormalizesConnection(t *testing.T) {
	authority := &telegramLinkAuthorityStub{account: validTelegramAccount()}
	svc, err := NewTelegramConnectorService(authority)
	if err != nil {
		t.Fatal(err)
	}
	out, err := svc.Link(context.Background(), "alice.420", ConnectorLinkRequest{
		Provider:         TelegramProvider,
		AuthorizationRef: "telegram-auth-ref-1",
		AccountHint:      "@alice_telegram",
	})
	if err != nil {
		t.Fatal(err)
	}
	if authority.linkCalls != 1 || authority.linkActor != "alice.420" || authority.authRef != "telegram-auth-ref-1" {
		t.Fatalf("authority input mismatch: calls=%d actor=%q ref=%q", authority.linkCalls, authority.linkActor, authority.authRef)
	}
	if out.ID != "telegram:1234567890" ||
		out.Provider != TelegramProvider ||
		out.Identity != "alice.420" ||
		out.ExternalID != "1234567890" ||
		out.DisplayName != "Alice Example" ||
		!out.Active ||
		!out.NonCustodial ||
		!out.LinkedAt.Equal(authority.account.LinkedAt) ||
		!out.UpdatedAt.Equal(authority.account.LinkedAt) {
		t.Fatalf("unexpected connection: %+v", out)
	}
}

func TestTelegramLinkFallsBackToUsernameDisplay(t *testing.T) {
	account := validTelegramAccount()
	account.FirstName = ""
	account.LastName = ""
	authority := &telegramLinkAuthorityStub{account: account}
	svc, _ := NewTelegramConnectorService(authority)
	out, err := svc.Link(context.Background(), "alice.420", ConnectorLinkRequest{
		Provider: TelegramProvider, AuthorizationRef: "telegram-auth-ref-1",
	})
	if err != nil {
		t.Fatal(err)
	}
	if out.DisplayName != "@alice_telegram" {
		t.Fatalf("unexpected display name: %q", out.DisplayName)
	}
}

func TestTelegramLinkRejectsMalformedInputBeforeAuthority(t *testing.T) {
	cases := []ConnectorLinkRequest{
		{Provider: "discord", AuthorizationRef: "x"},
		{Provider: TelegramProvider},
		{Provider: TelegramProvider, AuthorizationRef: string(bytes.Repeat([]byte{'x'}, MaxConnectorOpaqueBytes+1))},
	}
	for _, req := range cases {
		authority := &telegramLinkAuthorityStub{account: validTelegramAccount()}
		adapter := NewTelegramConnectorAdapter(authority)
		_, err := adapter.Link(context.Background(), "alice.420", req)
		if !errors.Is(err, ErrInvalidInput) {
			t.Fatalf("invalid request accepted: %+v err=%v", req, err)
		}
		if authority.linkCalls != 0 {
			t.Fatalf("invalid request reached authority: %+v", req)
		}
	}
}

func TestTelegramLinkRejectsInvalidAuthorityResults(t *testing.T) {
	cases := []func(*TelegramAccount){
		func(a *TelegramAccount) { a.UserID = "bad" },
		func(a *TelegramAccount) { a.UserID = "0" },
		func(a *TelegramAccount) { a.Username = ""; a.FirstName = "" },
		func(a *TelegramAccount) { a.Verified = false },
		func(a *TelegramAccount) { a.NonCustodial = false },
		func(a *TelegramAccount) { a.LinkedAt = time.Time{} },
	}
	for _, mutate := range cases {
		account := validTelegramAccount()
		mutate(&account)
		authority := &telegramLinkAuthorityStub{account: account}
		svc, _ := NewTelegramConnectorService(authority)
		_, err := svc.Link(context.Background(), "alice.420", ConnectorLinkRequest{
			Provider: TelegramProvider, AuthorizationRef: "telegram-auth-ref-1",
		})
		if !errors.Is(err, ErrTelegramInvalidResult) && !errors.Is(err, ErrConnectorInvalidResult) {
			t.Fatalf("invalid authority result accepted: %+v err=%v", account, err)
		}
	}
}

func TestTelegramLinkPropagatesAuthorityFailureWithoutFallback(t *testing.T) {
	dep := errors.New("telegram identity unavailable")
	authority := &telegramLinkAuthorityStub{account: validTelegramAccount(), err: dep}
	svc, _ := NewTelegramConnectorService(authority)
	_, err := svc.Link(context.Background(), "alice.420", ConnectorLinkRequest{
		Provider: TelegramProvider, AuthorizationRef: "telegram-auth-ref-1",
	})
	if !errors.Is(err, dep) {
		t.Fatalf("dependency error lost: %v", err)
	}
	if authority.linkCalls != 1 {
		t.Fatalf("unexpected calls: %d", authority.linkCalls)
	}
}

func TestTelegramUnlinkDelegatesBoundUserID(t *testing.T) {
	authority := &telegramLinkAuthorityStub{account: validTelegramAccount()}
	svc, _ := NewTelegramConnectorService(authority)
	if err := svc.Unlink(context.Background(), "alice.420", TelegramProvider, "telegram:1234567890"); err != nil {
		t.Fatal(err)
	}
	if authority.unlinkCalls != 1 || authority.unlinkActor != "alice.420" || authority.unlinkUserID != "1234567890" {
		t.Fatalf("unlink authority mismatch: calls=%d actor=%q user=%q", authority.unlinkCalls, authority.unlinkActor, authority.unlinkUserID)
	}
}

func TestTelegramUnlinkRejectsMalformedConnectionBeforeAuthority(t *testing.T) {
	authority := &telegramLinkAuthorityStub{account: validTelegramAccount()}
	adapter := NewTelegramConnectorAdapter(authority)
	for _, connectionID := range []string{"discord:1234567890", "telegram:", "telegram:abc", "telegram:0"} {
		if err := adapter.Unlink(context.Background(), "alice.420", connectionID); !errors.Is(err, ErrInvalidInput) {
			t.Fatalf("invalid connection accepted: %q err=%v", connectionID, err)
		}
	}
	if authority.unlinkCalls != 0 {
		t.Fatalf("invalid unlink reached authority: %d", authority.unlinkCalls)
	}
}

func TestTelegramLaterCapabilitiesRemainUnsupported(t *testing.T) {
	adapter := NewTelegramConnectorAdapter(&telegramLinkAuthorityStub{account: validTelegramAccount()})
	if _, err := adapter.Pull(context.Background(), "alice.420", ConnectorPullRequest{}); !errors.Is(err, ErrConnectorUnsupported) {
		t.Fatalf("Telegram pull unexpectedly enabled: %v", err)
	}
	if _, err := adapter.Push(context.Background(), "alice.420", ConnectorPushRequest{}); !errors.Is(err, ErrConnectorUnsupported) {
		t.Fatalf("Telegram push unexpectedly enabled: %v", err)
	}
	if _, err := adapter.VerifyWebhook(context.Background(), ConnectorWebhookRequest{}); !errors.Is(err, ErrConnectorUnsupported) {
		t.Fatalf("Telegram webhook unexpectedly enabled: %v", err)
	}
}

func telegramLinkHTTPHandler(t *testing.T, authority *telegramLinkAuthorityStub) HTTPHandler {
	t.Helper()
	connectors, err := NewTelegramConnectorService(authority)
	if err != nil {
		t.Fatal(err)
	}
	return HTTPHandler{
		Service:    &Service{},
		Connectors: connectors,
		Authenticate: func(r *http.Request) (string, error) {
			return r.Header.Get("X-Test-Actor"), nil
		},
	}
}

func TestHTTPTelegramLinkAndUnlink(t *testing.T) {
	authority := &telegramLinkAuthorityStub{account: validTelegramAccount()}
	h := telegramLinkHTTPHandler(t, authority)

	raw, _ := json.Marshal(ConnectorLinkRequest{
		Provider: TelegramProvider, AuthorizationRef: "telegram-auth-ref-1",
	})
	req := httptest.NewRequest(http.MethodPost, "/v1/connectors/link", bytes.NewReader(raw))
	req.Header.Set("X-Test-Actor", "alice.420")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("link status=%d body=%s", rec.Code, rec.Body.String())
	}

	unlinkRaw, _ := json.Marshal(map[string]string{
		"provider": TelegramProvider, "connection_id": "telegram:1234567890",
	})
	req = httptest.NewRequest(http.MethodPost, "/v1/connectors/unlink", bytes.NewReader(unlinkRaw))
	req.Header.Set("X-Test-Actor", "alice.420")
	rec = httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusNoContent {
		t.Fatalf("unlink status=%d body=%s", rec.Code, rec.Body.String())
	}
}

func TestHTTPTelegramLinkRequiresAuthentication(t *testing.T) {
	authority := &telegramLinkAuthorityStub{account: validTelegramAccount()}
	h := telegramLinkHTTPHandler(t, authority)
	raw, _ := json.Marshal(ConnectorLinkRequest{
		Provider: TelegramProvider, AuthorizationRef: "telegram-auth-ref-1",
	})
	req := httptest.NewRequest(http.MethodPost, "/v1/connectors/link", bytes.NewReader(raw))
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status=%d body=%s", rec.Code, rec.Body.String())
	}
	if authority.linkCalls != 0 {
		t.Fatal("unauthenticated Telegram link reached authority")
	}
}

func TestHTTPTelegramLinkRejectsSecretBearingFields(t *testing.T) {
	authority := &telegramLinkAuthorityStub{account: validTelegramAccount()}
	h := telegramLinkHTTPHandler(t, authority)
	req := httptest.NewRequest(http.MethodPost, "/v1/connectors/link", bytes.NewBufferString(
		`{"provider":"telegram","authorization_ref":"telegram-auth-ref-1","bot_token":"secret"}`))
	req.Header.Set("X-Test-Actor", "alice.420")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status=%d body=%s", rec.Code, rec.Body.String())
	}
	if authority.linkCalls != 0 {
		t.Fatal("secret-bearing Telegram link reached authority")
	}
}

func TestTelegramAndDiscordCanCoexistInProviderRegistry(t *testing.T) {
	telegram := NewTelegramConnectorAdapter(&telegramLinkAuthorityStub{account: validTelegramAccount()})
	discord := NewDiscordConnectorAdapter(&discordLinkAuthorityStub{account: validDiscordAccount()})
	registry, err := NewConnectorRegistry(telegram, discord)
	if err != nil {
		t.Fatal(err)
	}
	descriptors := registry.Descriptors()
	if len(descriptors) != 2 || descriptors[0].Provider != DiscordProvider || descriptors[1].Provider != TelegramProvider {
		t.Fatalf("unexpected provider registry: %+v", descriptors)
	}
}

package mail

import (
	"context"
	"errors"
	"testing"
	"time"
)

type discordLinkAuthorityStub struct {
	account DiscordAccount
	err     error
	calls   []string
	lastRef string
	lastID  string
}

func (s *discordLinkAuthorityStub) LinkDiscord(_ context.Context, actor, authorizationRef string) (DiscordAccount, error) {
	s.calls = append(s.calls, "link:"+actor)
	s.lastRef = authorizationRef
	return s.account, s.err
}

func (s *discordLinkAuthorityStub) UnlinkDiscord(_ context.Context, actor, userID string) error {
	s.calls = append(s.calls, "unlink:"+actor)
	s.lastID = userID
	return s.err
}

func validDiscordAccount() DiscordAccount {
	return DiscordAccount{
		UserID:       "123456789012345678",
		Username:     "alice",
		GlobalName:   "Alice",
		Scopes:       []string{"identify"},
		Verified:     true,
		NonCustodial: true,
		LinkedAt:     time.Unix(1700000000, 0).UTC(),
	}
}

func TestDiscordConnectorServiceConstructorRegistersDiscord(t *testing.T) {
	svc, err := NewDiscordConnectorService(&discordLinkAuthorityStub{account: validDiscordAccount()})
	if err != nil {
		t.Fatal(err)
	}
	providers := svc.Providers()
	if len(providers) != 1 || providers[0].Provider != DiscordProvider {
		t.Fatalf("discord provider not registered: %+v", providers)
	}
}

func TestDiscordConnectorDescriptorIsLinkOnly(t *testing.T) {
	d := NewDiscordConnectorAdapter(nil).Descriptor()
	if d.Provider != DiscordProvider || d.DisplayName != "Discord" {
		t.Fatalf("unexpected descriptor: %+v", d)
	}
	if len(d.Capabilities) != 1 || d.Capabilities[0] != ConnectorCapabilityLink {
		t.Fatalf("MAIL-2.15 must not pull later Discord capabilities forward: %+v", d.Capabilities)
	}
}

func TestDiscordConnectorLinksVerifiedIdentifyAccount(t *testing.T) {
	authority := &discordLinkAuthorityStub{account: validDiscordAccount()}
	adapter := NewDiscordConnectorAdapter(authority)
	got, err := adapter.Link(context.Background(), "alice.420", ConnectorLinkRequest{
		Provider: DiscordProvider, AuthorizationRef: "broker:discord:opaque-ref",
	})
	if err != nil {
		t.Fatal(err)
	}
	if got.Provider != DiscordProvider || got.Identity != "alice.420" || got.ExternalID != "123456789012345678" ||
		got.ID != "discord:123456789012345678" || got.DisplayName != "Alice" || !got.Active || !got.NonCustodial {
		t.Fatalf("unexpected connection: %+v", got)
	}
	if authority.lastRef != "broker:discord:opaque-ref" {
		t.Fatalf("authorization reference changed: %q", authority.lastRef)
	}
}

func TestDiscordConnectorUsesUsernameWhenGlobalNameMissing(t *testing.T) {
	account := validDiscordAccount()
	account.GlobalName = ""
	authority := &discordLinkAuthorityStub{account: account}
	got, err := NewDiscordConnectorAdapter(authority).Link(context.Background(), "alice.420", ConnectorLinkRequest{
		Provider: DiscordProvider, AuthorizationRef: "broker-ref",
	})
	if err != nil {
		t.Fatal(err)
	}
	if got.DisplayName != "alice" {
		t.Fatalf("username fallback missing: %+v", got)
	}
}

func TestDiscordConnectorRejectsInvalidAuthorityResults(t *testing.T) {
	cases := []func(*DiscordAccount){
		func(a *DiscordAccount) { a.UserID = "not-a-snowflake" },
		func(a *DiscordAccount) { a.Username = "" },
		func(a *DiscordAccount) { a.Scopes = nil },
		func(a *DiscordAccount) { a.Scopes = []string{"guilds"} },
		func(a *DiscordAccount) { a.Scopes = []string{"identify", "identify"} },
		func(a *DiscordAccount) { a.Verified = false },
		func(a *DiscordAccount) { a.NonCustodial = false },
		func(a *DiscordAccount) { a.LinkedAt = time.Time{} },
	}
	for _, mutate := range cases {
		account := validDiscordAccount()
		mutate(&account)
		authority := &discordLinkAuthorityStub{account: account}
		_, err := NewDiscordConnectorAdapter(authority).Link(context.Background(), "alice.420", ConnectorLinkRequest{
			Provider: DiscordProvider, AuthorizationRef: "broker-ref",
		})
		if !errors.Is(err, ErrDiscordInvalidResult) {
			t.Fatalf("invalid Discord result accepted: %+v err=%v", account, err)
		}
	}
}

func TestDiscordConnectorRejectsWrongProviderAndMissingActorBeforeAuthority(t *testing.T) {
	authority := &discordLinkAuthorityStub{account: validDiscordAccount()}
	adapter := NewDiscordConnectorAdapter(authority)
	if _, err := adapter.Link(context.Background(), "alice.420", ConnectorLinkRequest{
		Provider: "telegram", AuthorizationRef: "broker-ref",
	}); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("wrong provider accepted: %v", err)
	}
	if _, err := adapter.Link(context.Background(), "", ConnectorLinkRequest{
		Provider: DiscordProvider, AuthorizationRef: "broker-ref",
	}); !errors.Is(err, ErrUnauthorized) {
		t.Fatalf("missing actor accepted: %v", err)
	}
	if len(authority.calls) != 0 {
		t.Fatalf("invalid request reached authority: %+v", authority.calls)
	}
}

func TestDiscordConnectorUnlinkBindsConnectionSnowflake(t *testing.T) {
	authority := &discordLinkAuthorityStub{}
	adapter := NewDiscordConnectorAdapter(authority)
	if err := adapter.Unlink(context.Background(), "alice.420", "discord:123456789012345678"); err != nil {
		t.Fatal(err)
	}
	if authority.lastID != "123456789012345678" {
		t.Fatalf("wrong Discord user ID: %q", authority.lastID)
	}
	if err := adapter.Unlink(context.Background(), "alice.420", "discord:not-valid"); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("invalid connection accepted: %v", err)
	}
}

func TestDiscordConnectorDoesNotImplementSyncDeliveryOrWebhookEarly(t *testing.T) {
	adapter := NewDiscordConnectorAdapter(&discordLinkAuthorityStub{})
	if _, err := adapter.Pull(context.Background(), "alice.420", ConnectorPullRequest{}); !errors.Is(err, ErrConnectorUnsupported) {
		t.Fatalf("pull unexpectedly implemented: %v", err)
	}
	if _, err := adapter.Push(context.Background(), "alice.420", ConnectorPushRequest{}); !errors.Is(err, ErrConnectorUnsupported) {
		t.Fatalf("push unexpectedly implemented: %v", err)
	}
	if _, err := adapter.VerifyWebhook(context.Background(), ConnectorWebhookRequest{}); !errors.Is(err, ErrConnectorUnsupported) {
		t.Fatalf("webhook unexpectedly implemented: %v", err)
	}
}

func TestDiscordConnectorDependencyFailureHasNoFallback(t *testing.T) {
	dep := errors.New("discord broker unavailable")
	authority := &discordLinkAuthorityStub{account: validDiscordAccount(), err: dep}
	adapter := NewDiscordConnectorAdapter(authority)
	_, err := adapter.Link(context.Background(), "alice.420", ConnectorLinkRequest{
		Provider: DiscordProvider, AuthorizationRef: "broker-ref",
	})
	if !errors.Is(err, dep) {
		t.Fatalf("dependency error lost: %v", err)
	}
}

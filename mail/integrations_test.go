package mail

import (
	"context"
	"errors"
	"fmt"
	"testing"
	"time"
)

type connectorAdapterStub struct {
	desc       ConnectorDescriptor
	connection ConnectorConnection
	pull       ConnectorPullResult
	push       ConnectorPushResult
	webhook    ConnectorWebhookResult
	err        error
	calls      []string
}

func (s *connectorAdapterStub) Descriptor() ConnectorDescriptor { return s.desc }
func (s *connectorAdapterStub) Link(context.Context, string, ConnectorLinkRequest) (ConnectorConnection, error) {
	s.calls = append(s.calls, "link")
	return s.connection, s.err
}
func (s *connectorAdapterStub) Unlink(context.Context, string, string) error {
	s.calls = append(s.calls, "unlink")
	return s.err
}
func (s *connectorAdapterStub) Pull(context.Context, string, ConnectorPullRequest) (ConnectorPullResult, error) {
	s.calls = append(s.calls, "pull")
	return s.pull, s.err
}
func (s *connectorAdapterStub) Push(context.Context, string, ConnectorPushRequest) (ConnectorPushResult, error) {
	s.calls = append(s.calls, "push")
	return s.push, s.err
}
func (s *connectorAdapterStub) VerifyWebhook(context.Context, ConnectorWebhookRequest) (ConnectorWebhookResult, error) {
	s.calls = append(s.calls, "webhook")
	return s.webhook, s.err
}

func testConnectorAdapter(provider string, caps ...ConnectorCapability) *connectorAdapterStub {
	now := time.Unix(1700000000, 0).UTC()
	return &connectorAdapterStub{
		desc: ConnectorDescriptor{Provider: provider, DisplayName: "Test " + provider, Capabilities: caps},
		connection: ConnectorConnection{
			ID: "conn-1", Provider: provider, Identity: "alice.420", ExternalID: "external-1",
			LinkedAt: now, UpdatedAt: now, Active: true, NonCustodial: true,
		},
		pull: ConnectorPullResult{
			Provider: provider, ConnectionID: "conn-1",
			Items:      []ConnectorItem{{ExternalID: "msg-1", OccurredAt: now, Kind: "MESSAGE", Payload: "opaque-provider-payload"}},
			NextCursor: "next-1",
		},
		push: ConnectorPushResult{
			Provider: provider, ConnectionID: "conn-1", ExternalID: "sent-1", AcceptedAt: now, Accepted: true,
		},
		webhook: ConnectorWebhookResult{
			Provider: provider, Identity: "alice.420", ConnectionID: "conn-1", Verified: true,
			Items: []ConnectorItem{{ExternalID: "event-1", OccurredAt: now, Kind: "MESSAGE", Payload: "opaque-provider-payload"}},
		},
	}
}

func TestConnectorRegistryIsProviderNeutralAndDeterministic(t *testing.T) {
	a := testConnectorAdapter("zeta", ConnectorCapabilityLink)
	b := testConnectorAdapter("alpha", ConnectorCapabilityLink, ConnectorCapabilityPull)
	reg, err := NewConnectorRegistry(a, b)
	if err != nil {
		t.Fatal(err)
	}
	got := reg.Descriptors()
	if len(got) != 2 || got[0].Provider != "alpha" || got[1].Provider != "zeta" {
		t.Fatalf("unexpected provider ordering: %+v", got)
	}
}

func TestConnectorRegistryRejectsDuplicateOrInvalidProviders(t *testing.T) {
	a := testConnectorAdapter("discord", ConnectorCapabilityLink)
	reg, err := NewConnectorRegistry(a)
	if err != nil {
		t.Fatal(err)
	}
	if err := reg.Register(testConnectorAdapter("DISCORD", ConnectorCapabilityLink)); !errors.Is(err, ErrConnectorConflict) {
		t.Fatalf("duplicate provider accepted: %v", err)
	}
	if _, err := NewConnectorRegistry(testConnectorAdapter("bad/provider", ConnectorCapabilityLink)); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("invalid provider accepted: %v", err)
	}
}

func TestConnectorServiceLinkUnlinkPullPushAndWebhook(t *testing.T) {
	adapter := testConnectorAdapter("example",
		ConnectorCapabilityLink, ConnectorCapabilityPull, ConnectorCapabilityPush, ConnectorCapabilityWebhook)
	reg, err := NewConnectorRegistry(adapter)
	if err != nil {
		t.Fatal(err)
	}
	svc := NewConnectorService(reg)

	conn, err := svc.Link(context.Background(), "alice.420", ConnectorLinkRequest{
		Provider: "EXAMPLE", AuthorizationRef: "vault-ref-opaque", AccountHint: "alice@example",
	})
	if err != nil {
		t.Fatal(err)
	}
	if conn.Identity != "alice.420" || conn.Provider != "example" || !conn.NonCustodial {
		t.Fatalf("unexpected connection: %+v", conn)
	}
	if err := svc.Unlink(context.Background(), "alice.420", "example", "conn-1"); err != nil {
		t.Fatal(err)
	}
	pull, err := svc.Pull(context.Background(), "alice.420", ConnectorPullRequest{Provider: "example", ConnectionID: "conn-1"})
	if err != nil {
		t.Fatal(err)
	}
	if len(pull.Items) != 1 || pull.NextCursor != "next-1" {
		t.Fatalf("unexpected pull: %+v", pull)
	}
	push, err := svc.Push(context.Background(), "alice.420", ConnectorPushRequest{
		Provider: "example", ConnectionID: "conn-1", Kind: "MESSAGE", Payload: "payload", IdempotencyKey: "idem-1",
	})
	if err != nil {
		t.Fatal(err)
	}
	if !push.Accepted || push.ExternalID != "sent-1" {
		t.Fatalf("unexpected push: %+v", push)
	}
	webhook, err := svc.VerifyWebhook(context.Background(), ConnectorWebhookRequest{Provider: "example", Payload: "signed-webhook"})
	if err != nil {
		t.Fatal(err)
	}
	if !webhook.Verified || webhook.Identity != "alice.420" {
		t.Fatalf("unexpected webhook: %+v", webhook)
	}
}

func TestConnectorServiceEnforcesCapabilitiesBeforeAdapterCall(t *testing.T) {
	adapter := testConnectorAdapter("link-only", ConnectorCapabilityLink)
	reg, _ := NewConnectorRegistry(adapter)
	svc := NewConnectorService(reg)
	if _, err := svc.Pull(context.Background(), "alice.420", ConnectorPullRequest{Provider: "link-only", ConnectionID: "conn-1"}); !errors.Is(err, ErrConnectorUnsupported) {
		t.Fatalf("unsupported pull accepted: %v", err)
	}
	if len(adapter.calls) != 0 {
		t.Fatalf("unsupported operation reached adapter: %+v", adapter.calls)
	}
}

func TestConnectorServiceRejectsCrossIdentityOrProviderResults(t *testing.T) {
	for _, mutate := range []func(*ConnectorConnection){
		func(c *ConnectorConnection) { c.Identity = "mallory.420" },
		func(c *ConnectorConnection) { c.Provider = "other" },
		func(c *ConnectorConnection) { c.NonCustodial = false },
		func(c *ConnectorConnection) { c.Active = false },
	} {
		adapter := testConnectorAdapter("example", ConnectorCapabilityLink)
		mutate(&adapter.connection)
		reg, _ := NewConnectorRegistry(adapter)
		svc := NewConnectorService(reg)
		if _, err := svc.Link(context.Background(), "alice.420", ConnectorLinkRequest{Provider: "example", AuthorizationRef: "ref"}); !errors.Is(err, ErrConnectorInvalidResult) {
			t.Fatalf("invalid connection accepted: %+v err=%v", adapter.connection, err)
		}
	}
}

func TestConnectorServiceRejectsMalformedAndOversizedPayloads(t *testing.T) {
	adapter := testConnectorAdapter("example", ConnectorCapabilityLink, ConnectorCapabilityPush, ConnectorCapabilityWebhook)
	reg, _ := NewConnectorRegistry(adapter)
	svc := NewConnectorService(reg)
	if _, err := svc.Link(context.Background(), "", ConnectorLinkRequest{Provider: "example", AuthorizationRef: "ref"}); !errors.Is(err, ErrUnauthorized) {
		t.Fatalf("missing actor: %v", err)
	}
	if _, err := svc.Push(context.Background(), "alice.420", ConnectorPushRequest{Provider: "example", ConnectionID: "conn-1"}); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("empty push accepted: %v", err)
	}
	huge := make([]byte, MaxConnectorPayloadBytes+1)
	if _, err := svc.VerifyWebhook(context.Background(), ConnectorWebhookRequest{Provider: "example", Payload: string(huge)}); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("oversized webhook accepted: %v", err)
	}
}

func TestConnectorServiceDependencyFailureHasNoFallback(t *testing.T) {
	dep := errors.New("provider unavailable")
	adapter := testConnectorAdapter("example", ConnectorCapabilityLink)
	adapter.err = dep
	reg, _ := NewConnectorRegistry(adapter)
	svc := NewConnectorService(reg)
	_, err := svc.Link(context.Background(), "alice.420", ConnectorLinkRequest{Provider: "example", AuthorizationRef: "ref"})
	if !errors.Is(err, dep) {
		t.Fatalf("dependency error lost: %v", err)
	}
}

type mutableDescriptorAdapter struct {
	*connectorAdapterStub
	current     ConnectorDescriptor
	panicOn     string
	seenHeaders map[string]string
}

func (a *mutableDescriptorAdapter) Descriptor() ConnectorDescriptor { return a.current }

func (a *mutableDescriptorAdapter) Pull(ctx context.Context, actor string, req ConnectorPullRequest) (ConnectorPullResult, error) {
	if a.panicOn == "pull" {
		panic("provider pull panic")
	}
	return a.connectorAdapterStub.Pull(ctx, actor, req)
}

func (a *mutableDescriptorAdapter) Push(ctx context.Context, actor string, req ConnectorPushRequest) (ConnectorPushResult, error) {
	if a.panicOn == "push" {
		panic("provider push panic")
	}
	return a.connectorAdapterStub.Push(ctx, actor, req)
}

func (a *mutableDescriptorAdapter) VerifyWebhook(ctx context.Context, req ConnectorWebhookRequest) (ConnectorWebhookResult, error) {
	if a.panicOn == "webhook" {
		panic("provider webhook panic")
	}
	a.seenHeaders = req.Headers
	if req.Headers != nil {
		req.Headers["X-Mutated-By-Adapter"] = "yes"
	}
	return a.connectorAdapterStub.VerifyWebhook(ctx, req)
}

func TestConnectorRegistryFreezesDescriptorAtRegistration(t *testing.T) {
	base := testConnectorAdapter("example", ConnectorCapabilityLink)
	adapter := &mutableDescriptorAdapter{connectorAdapterStub: base, current: base.desc}
	reg, err := NewConnectorRegistry(adapter)
	if err != nil {
		t.Fatal(err)
	}

	adapter.current = ConnectorDescriptor{Provider: "other", DisplayName: "Mutated", Capabilities: []ConnectorCapability{ConnectorCapabilityPush}}
	got := reg.Descriptors()
	if len(got) != 1 || got[0].Provider != "example" || got[0].DisplayName != "Test example" || len(got[0].Capabilities) != 1 || got[0].Capabilities[0] != ConnectorCapabilityLink {
		t.Fatalf("registered descriptor drifted with adapter mutation: %+v", got)
	}
	if _, err := NewConnectorService(reg).Push(context.Background(), "alice.420", ConnectorPushRequest{
		Provider: "example", ConnectionID: "conn-1", Kind: "MESSAGE", Payload: "x", IdempotencyKey: "i",
	}); !errors.Is(err, ErrConnectorUnsupported) {
		t.Fatalf("post-registration capability escalation accepted: %v", err)
	}
}

func TestConnectorRegistryDescriptorCopiesCannotMutateAuthority(t *testing.T) {
	adapter := testConnectorAdapter("example", ConnectorCapabilityLink)
	reg, err := NewConnectorRegistry(adapter)
	if err != nil {
		t.Fatal(err)
	}
	first := reg.Descriptors()
	first[0].Provider = "other"
	first[0].Capabilities[0] = ConnectorCapabilityPush
	second := reg.Descriptors()
	if second[0].Provider != "example" || second[0].Capabilities[0] != ConnectorCapabilityLink {
		t.Fatalf("descriptor caller mutated registry authority: %+v", second[0])
	}
}

func TestConnectorAdapterPanicsAreContained(t *testing.T) {
	for _, op := range []string{"pull", "push", "webhook"} {
		base := testConnectorAdapter("example", ConnectorCapabilityPull, ConnectorCapabilityPush, ConnectorCapabilityWebhook)
		adapter := &mutableDescriptorAdapter{connectorAdapterStub: base, current: base.desc, panicOn: op}
		reg, err := NewConnectorRegistry(adapter)
		if err != nil {
			t.Fatal(err)
		}
		svc := NewConnectorService(reg)
		var callErr error
		switch op {
		case "pull":
			_, callErr = svc.Pull(context.Background(), "alice.420", ConnectorPullRequest{Provider: "example", ConnectionID: "conn-1"})
		case "push":
			_, callErr = svc.Push(context.Background(), "alice.420", ConnectorPushRequest{
				Provider: "example", ConnectionID: "conn-1", Kind: "MESSAGE", Payload: "x", IdempotencyKey: "i",
			})
		case "webhook":
			_, callErr = svc.VerifyWebhook(context.Background(), ConnectorWebhookRequest{Provider: "example", Payload: "signed"})
		}
		if !errors.Is(callErr, ErrConnectorIsolated) {
			t.Fatalf("%s panic escaped isolation: %v", op, callErr)
		}
	}
}

func TestConnectorWebhookHeadersAreIsolatedFromAdapterMutation(t *testing.T) {
	base := testConnectorAdapter("example", ConnectorCapabilityWebhook)
	adapter := &mutableDescriptorAdapter{connectorAdapterStub: base, current: base.desc}
	reg, err := NewConnectorRegistry(adapter)
	if err != nil {
		t.Fatal(err)
	}
	headers := map[string]string{"X-Signature": "original"}
	if _, err := NewConnectorService(reg).VerifyWebhook(context.Background(), ConnectorWebhookRequest{
		Provider: "example", Headers: headers, Payload: "signed",
	}); err != nil {
		t.Fatal(err)
	}
	if _, exists := headers["X-Mutated-By-Adapter"]; exists {
		t.Fatalf("adapter mutated caller-owned webhook headers: %+v", headers)
	}
	if adapter.seenHeaders == nil || adapter.seenHeaders["X-Signature"] != "original" {
		t.Fatalf("isolated header copy not delivered: %+v", adapter.seenHeaders)
	}
}

func TestConnectorItemCountIsBounded(t *testing.T) {
	items := make([]ConnectorItem, MaxConnectorItems+1)
	for i := range items {
		items[i] = ConnectorItem{
			ExternalID: fmt.Sprintf("item-%d", i),
			OccurredAt: time.Unix(1700000000+int64(i), 0).UTC(),
			Kind:       "MESSAGE",
			Payload:    "x",
		}
	}
	if err := validateConnectorItems(items); !errors.Is(err, ErrConnectorInvalidResult) {
		t.Fatalf("oversized connector result accepted: %v", err)
	}
	if err := validateConnectorItems(items[:MaxConnectorItems]); err != nil {
		t.Fatalf("bounded connector result rejected: %v", err)
	}
}

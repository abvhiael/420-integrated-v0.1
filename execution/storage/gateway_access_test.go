package storage

import (
	"context"
	"errors"
	"testing"
)

type gatewayAuthorizerFunc func(context.Context, GatewayAccess, GatewayRequest) error

func (f gatewayAuthorizerFunc) AuthorizeGatewayAccess(ctx context.Context, access GatewayAccess, req GatewayRequest) error {
	return f(ctx, access, req)
}

func TestGatewayPrivateAccessFailsClosedWithoutAuthorizer(t *testing.T) {
	payload := []byte("abcd")
	req := gatewayRequest(payload)
	req.Access = GatewayAccess{Mode: GatewayAccessPrivate, Subject: "alice", SessionID: "session-1", Capability: GatewayAccessRead}
	called := false
	g := GatewayRouter{Cache: []GatewaySource{gatewaySourceFunc(func(context.Context, GatewayRequest) ([]byte, error) {
		called = true
		return payload, nil
	})}}
	_, err := g.Route(context.Background(), req)
	if !errors.Is(err, ErrGatewayUnauthorized) { t.Fatalf("err=%v", err) }
	if called { t.Fatal("source called before authorization") }
}

func TestGatewayPrivateAccessRequiresReadCapabilityAndSessionIdentity(t *testing.T) {
	payload := []byte("abcd")
	base := gatewayRequest(payload)
	cases := []GatewayAccess{
		{Mode: GatewayAccessPrivate, Subject: "", SessionID: "session-1", Capability: GatewayAccessRead},
		{Mode: GatewayAccessPrivate, Subject: "alice", SessionID: "", Capability: GatewayAccessRead},
		{Mode: GatewayAccessPrivate, Subject: "alice", SessionID: "session-1", Capability: "write"},
		{Mode: GatewayAccessMode("unknown"), Subject: "alice", SessionID: "session-1", Capability: GatewayAccessRead},
	}
	g := GatewayRouter{Authorizer: gatewayAuthorizerFunc(func(context.Context, GatewayAccess, GatewayRequest) error { return nil })}
	for _, access := range cases {
		req := base
		req.Access = access
		if _, err := g.Route(context.Background(), req); !errors.Is(err, ErrGatewayUnauthorized) {
			t.Fatalf("access=%+v err=%v", access, err)
		}
	}
}

func TestGatewayPrivateAccessAuthorizerRunsBeforeDiscoveryAndFetch(t *testing.T) {
	payload := []byte("abcd")
	req := gatewayRequest(payload)
	req.Access = GatewayAccess{Mode: GatewayAccessPrivate, Subject: " alice ", SessionID: " session-1 ", Capability: " READ "}
	discoveryCalled := false
	fetchCalled := false
	g := GatewayRouter{
		Authorizer: gatewayAuthorizerFunc(func(_ context.Context, access GatewayAccess, got GatewayRequest) error {
			if access.Subject != "alice" || access.SessionID != "session-1" || access.Capability != GatewayAccessRead {
				t.Fatalf("normalized access=%+v", access)
			}
			if got.CommitmentID != req.CommitmentID { t.Fatalf("bad request %+v", got) }
			return errors.New("denied")
		}),
		Discovery: gatewayDiscoveryFunc(func(context.Context, GatewayRequest) ([]GatewayCandidate, error) {
			discoveryCalled = true
			return nil, nil
		}),
		Cache: []GatewaySource{gatewaySourceFunc(func(context.Context, GatewayRequest) ([]byte, error) {
			fetchCalled = true
			return payload, nil
		})},
	}
	_, err := g.Route(context.Background(), req)
	if !errors.Is(err, ErrGatewayUnauthorized) { t.Fatalf("err=%v", err) }
	if discoveryCalled || fetchCalled { t.Fatalf("discovery=%v fetch=%v", discoveryCalled, fetchCalled) }
}

func TestGatewayPrivateAccessAuthorizedRoutesNormally(t *testing.T) {
	payload := []byte("abcd")
	req := gatewayRequest(payload)
	req.Access = GatewayAccess{Mode: GatewayAccessPrivate, Subject: "alice", SessionID: "session-1", Capability: GatewayAccessRead}
	authorized := false
	g := GatewayRouter{
		Authorizer: gatewayAuthorizerFunc(func(context.Context, GatewayAccess, GatewayRequest) error {
			authorized = true
			return nil
		}),
		Store: []GatewaySource{gatewaySourceFunc(func(context.Context, GatewayRequest) ([]byte, error) { return payload, nil })},
	}
	res, err := g.Route(context.Background(), req)
	if err != nil { t.Fatal(err) }
	if !authorized || res.Tier != "store" || string(res.Payload) != "abcd" { t.Fatalf("authorized=%v result=%+v", authorized, res) }
}

func TestGatewayPublicAccessDoesNotRequireAuthorizer(t *testing.T) {
	payload := []byte("abcd")
	req := gatewayRequest(payload)
	req.Access = GatewayAccess{Mode: GatewayAccessPublic}
	g := GatewayRouter{Cache: []GatewaySource{gatewaySourceFunc(func(context.Context, GatewayRequest) ([]byte, error) { return payload, nil })}}
	res, err := g.Route(context.Background(), req)
	if err != nil { t.Fatal(err) }
	if res.Tier != "cache" { t.Fatalf("result=%+v", res) }
}

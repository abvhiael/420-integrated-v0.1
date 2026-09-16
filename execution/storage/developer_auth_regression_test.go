package storage

import (
	"context"
	"errors"
	"testing"
)

func TestDeveloperPrivateReadRejectsIncompleteOrInvalidAuthMetadata(t *testing.T) {
	payload := []byte("private-auth-regression")
	object := developerObjectRef(payload)
	api := GatewayDeveloperAPI{Router: GatewayRouter{
		Cache:      []GatewaySource{developerGatewaySourceStub{payload: payload}},
		Authorizer: developerGatewayAuthorizerStub{},
	}}

	cases := []struct {
		name   string
		access DeveloperReadAccess
	}{
		{"missing-subject", DeveloperReadAccess{Mode: DeveloperAccessPrivate, SessionID: "session", Capability: GatewayAccessRead}},
		{"missing-session", DeveloperReadAccess{Mode: DeveloperAccessPrivate, Subject: "subject", Capability: GatewayAccessRead}},
		{"missing-capability", DeveloperReadAccess{Mode: DeveloperAccessPrivate, Subject: "subject", SessionID: "session"}},
		{"wrong-capability", DeveloperReadAccess{Mode: DeveloperAccessPrivate, Subject: "subject", SessionID: "session", Capability: "write"}},
		{"whitespace-subject", DeveloperReadAccess{Mode: DeveloperAccessPrivate, Subject: "   ", SessionID: "session", Capability: GatewayAccessRead}},
		{"whitespace-session", DeveloperReadAccess{Mode: DeveloperAccessPrivate, Subject: "subject", SessionID: "   ", Capability: GatewayAccessRead}},
		{"unknown-mode", DeveloperReadAccess{Mode: DeveloperAccessMode("trusted"), Subject: "subject", SessionID: "session", Capability: GatewayAccessRead}},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			_, err := api.Retrieve(context.Background(), DeveloperRetrieveRequest{Object: object, Access: tc.access})
			if !errors.Is(err, ErrDeveloperAPI) {
				t.Fatalf("expected developer API validation failure, got %v", err)
			}
		})
	}
}

func TestDeveloperPrivateReadPreservesAuthorizerDeny(t *testing.T) {
	payload := []byte("private-authorizer-deny")
	deny := errors.New("session revoked")
	api := GatewayDeveloperAPI{Router: GatewayRouter{
		Cache:      []GatewaySource{developerGatewaySourceStub{payload: payload}},
		Authorizer: developerGatewayAuthorizerStub{err: deny},
	}}

	_, err := api.Retrieve(context.Background(), DeveloperRetrieveRequest{
		Object: objectRefForAuth(payload),
		Access: DeveloperReadAccess{
			Mode:       DeveloperAccessPrivate,
			Subject:    "subject",
			SessionID:  "session",
			Capability: GatewayAccessRead,
		},
	})
	if err == nil {
		t.Fatal("expected denied private read")
	}
	if !errors.Is(err, ErrGatewayUnauthorized) {
		t.Fatalf("expected gateway unauthorized, got %v", err)
	}
}

func TestDeveloperPublicReadDoesNotPromotePrivateMetadata(t *testing.T) {
	payload := []byte("public-read")
	api := GatewayDeveloperAPI{Router: GatewayRouter{Cache: []GatewaySource{developerGatewaySourceStub{payload: payload}}}}
	result, err := api.Retrieve(context.Background(), DeveloperRetrieveRequest{
		Object: objectRefForAuth(payload),
		Access: DeveloperReadAccess{
			Mode:       DeveloperAccessPublic,
			Subject:    "should-be-ignored",
			SessionID:  "should-be-ignored",
			Capability: "write",
		},
	})
	if err != nil {
		t.Fatal(err)
	}
	if string(result.Payload) != string(payload) {
		t.Fatalf("unexpected payload %q", result.Payload)
	}
}

func objectRefForAuth(payload []byte) DeveloperObjectRef {
	return developerObjectRef(payload)
}

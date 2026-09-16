package storage

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"testing"
)

type developerGatewaySourceStub struct {
	payload []byte
	err     error
}

func (s developerGatewaySourceStub) FetchGatewayObject(context.Context, GatewayRequest) ([]byte, error) {
	if s.err != nil {
		return nil, s.err
	}
	return append([]byte(nil), s.payload...), nil
}

type developerGatewayAuthorizerStub struct {
	err error
}

func (s developerGatewayAuthorizerStub) AuthorizeGatewayAccess(context.Context, GatewayAccess, GatewayRequest) error {
	return s.err
}

func developerObjectRef(payload []byte) DeveloperObjectRef {
	digest := sha256.Sum256(payload)
	return DeveloperObjectRef{
		ObjectID:     "object-1",
		ManifestID:   "manifest-1",
		ShardIndex:   0,
		ShardRoot:    hex.EncodeToString(digest[:]),
		SizeBytes:    uint64(len(payload)),
		CommitmentID: "commitment-1",
	}
}

func TestGatewayDeveloperAPIRetrievesPublicObject(t *testing.T) {
	payload := []byte("developer-api-payload")
	api := GatewayDeveloperAPI{Router: GatewayRouter{Cache: []GatewaySource{developerGatewaySourceStub{payload: payload}}}}

	result, err := api.Retrieve(context.Background(), DeveloperRetrieveRequest{
		Version: DeveloperAPIVersion,
		Object:  developerObjectRef(payload),
		Access:  DeveloperReadAccess{Mode: DeveloperAccessPublic},
	})
	if err != nil {
		t.Fatal(err)
	}
	if result.Version != DeveloperAPIVersion {
		t.Fatalf("unexpected version %q", result.Version)
	}
	if result.Route.Tier != "cache" {
		t.Fatalf("unexpected route tier %q", result.Route.Tier)
	}
	if string(result.Payload) != string(payload) {
		t.Fatalf("unexpected payload %q", string(result.Payload))
	}
	result.Payload[0] = 'X'
	if string(payload) != "developer-api-payload" {
		t.Fatal("result payload aliases source payload")
	}
}

func TestGatewayDeveloperAPIRejectsInvalidObjectReference(t *testing.T) {
	api := GatewayDeveloperAPI{}
	_, err := api.Retrieve(context.Background(), DeveloperRetrieveRequest{
		Object: DeveloperObjectRef{ObjectID: "object-1"},
	})
	if !errors.Is(err, ErrDeveloperAPI) {
		t.Fatalf("expected developer api error, got %v", err)
	}
}

func TestGatewayDeveloperAPIRejectsUnsupportedVersion(t *testing.T) {
	payload := []byte("versioned")
	api := GatewayDeveloperAPI{Router: GatewayRouter{Cache: []GatewaySource{developerGatewaySourceStub{payload: payload}}}}
	_, err := api.Retrieve(context.Background(), DeveloperRetrieveRequest{
		Version: "v2",
		Object:  developerObjectRef(payload),
	})
	if !errors.Is(err, ErrDeveloperAPI) {
		t.Fatalf("expected developer api error, got %v", err)
	}
}

func TestGatewayDeveloperAPIPrivateAccessRemainsDefaultDeny(t *testing.T) {
	payload := []byte("private")
	api := GatewayDeveloperAPI{Router: GatewayRouter{Cache: []GatewaySource{developerGatewaySourceStub{payload: payload}}}}
	_, err := api.Retrieve(context.Background(), DeveloperRetrieveRequest{
		Object: developerObjectRef(payload),
		Access: DeveloperReadAccess{
			Mode:       DeveloperAccessPrivate,
			Subject:    "subject-1",
			SessionID:  "session-1",
			Capability: GatewayAccessRead,
		},
	})
	if !errors.Is(err, ErrGatewayUnauthorized) {
		t.Fatalf("expected gateway unauthorized, got %v", err)
	}
}

func TestGatewayDeveloperAPIPrivateAccessUsesExistingAuthorizer(t *testing.T) {
	payload := []byte("private-authorized")
	api := GatewayDeveloperAPI{Router: GatewayRouter{
		Cache:      []GatewaySource{developerGatewaySourceStub{payload: payload}},
		Authorizer: developerGatewayAuthorizerStub{},
	}}
	result, err := api.Retrieve(context.Background(), DeveloperRetrieveRequest{
		Object: developerObjectRef(payload),
		Access: DeveloperReadAccess{
			Mode:       DeveloperAccessPrivate,
			Subject:    "subject-1",
			SessionID:  "session-1",
			Capability: GatewayAccessRead,
		},
	})
	if err != nil {
		t.Fatal(err)
	}
	if string(result.Payload) != string(payload) {
		t.Fatalf("unexpected payload %q", string(result.Payload))
	}
}

func TestGatewayDeveloperAPIPreservesSelectedProviderMetadata(t *testing.T) {
	payload := []byte("discovered")
	discovery := staticGatewayDiscovery{candidates: []GatewayCandidate{{
		ProviderID: "provider-9",
		NodeID:     "node-9",
		Capability: GatewayCapabilityCache,
		Active:     true,
		Source:     developerGatewaySourceStub{payload: payload},
	}}}
	api := GatewayDeveloperAPI{Router: GatewayRouter{Discovery: discovery}}
	result, err := api.Retrieve(context.Background(), DeveloperRetrieveRequest{Object: developerObjectRef(payload)})
	if err != nil {
		t.Fatal(err)
	}
	if result.Route.ProviderID != "provider-9" || result.Route.NodeID != "node-9" {
		t.Fatalf("unexpected route metadata %#v", result.Route)
	}
}

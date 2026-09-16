package storage_test

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"net/http/httptest"
	"testing"

	storage "github.com/420integrated/420-integrated/execution/storage"
	"github.com/420integrated/420-integrated/sdk/storage420"
)

type developerE2EAPI struct {
	payload []byte
	seen    storage.DeveloperRetrieveRequest
}

func (a *developerE2EAPI) Retrieve(_ context.Context, req storage.DeveloperRetrieveRequest) (storage.DeveloperRetrieveResult, error) {
	a.seen = req
	return storage.DeveloperRetrieveResult{
		Version: storage.DeveloperAPIVersion,
		Object:  req.Object,
		Route: storage.DeveloperRouteMetadata{
			Tier:       "store",
			ProviderID: "provider-e2e",
			NodeID:     "node-e2e",
		},
		Payload: append([]byte(nil), a.payload...),
	}, nil
}

func TestReferenceSDKAgainstDeveloperHTTPHandler(t *testing.T) {
	payload := []byte("sr-9.10-sdk-http-e2e")
	root := sha256.Sum256(payload)
	shardRoot := hex.EncodeToString(root[:])
	api := &developerE2EAPI{payload: payload}
	handler := storage.NewDeveloperHTTPHandler(api)
	server := httptest.NewServer(handler)
	defer server.Close()

	transport, err := storage420.NewHTTPTransport(server.URL, server.Client())
	if err != nil {
		t.Fatal(err)
	}
	client := storage420.NewClient(transport)
	result, err := client.Retrieve(context.Background(), storage420.RetrieveRequest{
		Version: storage420.APIVersion,
		Object: storage420.ObjectRef{
			ObjectID:     "object-e2e",
			ManifestID:   "manifest-e2e",
			ShardIndex:   4,
			ShardRoot:    shardRoot,
			SizeBytes:    uint64(len(payload)),
			CommitmentID: "commitment-e2e",
		},
		Access: storage420.ReadAccess{
			Mode:       storage420.AccessPrivate,
			Subject:    "alice",
			SessionID:  "session-e2e",
			Capability: "read",
		},
	})
	if err != nil {
		t.Fatal(err)
	}
	if string(result.Payload) != string(payload) || result.Route.Tier != "store" || result.Route.ProviderID != "provider-e2e" || result.Route.NodeID != "node-e2e" {
		t.Fatalf("result=%#v", result)
	}
	if api.seen.Object.ObjectID != "object-e2e" || api.seen.Object.ManifestID != "manifest-e2e" || api.seen.Object.ShardRoot != shardRoot || api.seen.Object.CommitmentID != "commitment-e2e" {
		t.Fatalf("handler object=%#v", api.seen.Object)
	}
	if api.seen.Access.Mode != storage.DeveloperAccessPrivate || api.seen.Access.Subject != "alice" || api.seen.Access.SessionID != "session-e2e" || api.seen.Access.Capability != "read" {
		t.Fatalf("handler access=%#v", api.seen.Access)
	}
}

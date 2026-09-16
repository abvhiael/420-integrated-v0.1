package storage420

import (
	"bytes"
	"encoding/json"
	"os"
	"testing"
)

func TestRetrieveRequestGoldenFixture(t *testing.T) {
	fixture, err := os.ReadFile("testdata/retrieve_request.json")
	if err != nil { t.Fatal(err) }
	value := RetrieveRequest{
		Version: APIVersion,
		Object: ObjectRef{ObjectID:"object-1", ManifestID:"manifest-1", ShardIndex:3, ShardRoot:"root-1", SizeBytes:42, CommitmentID:"commitment-1"},
		Access: ReadAccess{Mode:AccessPrivate, Subject:"alice", SessionID:"session-1", Capability:"read"},
	}
	encoded, err := json.Marshal(value)
	if err != nil { t.Fatal(err) }
	if !bytes.Equal(append(encoded, '\n'), fixture) { t.Fatalf("wire drift\n got: %s\nwant: %s", encoded, fixture) }
}

func TestDiscoveryResultGoldenFixture(t *testing.T) {
	fixture, err := os.ReadFile("testdata/discovery_result.json")
	if err != nil { t.Fatal(err) }
	value := DiscoveryResult{Version:APIVersion, Authoritative:false, Resources:[]ResourceDescriptor{{ProviderID:"provider-a", NodeID:"node-a", ServiceID:"store-a", Capability:"store", Priority:1, Endpoint:"https://store-a.invalid", State:"running", Health:"healthy", Authoritative:false}}}
	encoded, err := json.Marshal(value)
	if err != nil { t.Fatal(err) }
	if !bytes.Equal(append(encoded, '\n'), fixture) { t.Fatalf("wire drift\n got: %s\nwant: %s", encoded, fixture) }
}

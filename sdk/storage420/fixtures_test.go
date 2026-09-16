package storage420

import (
	"bytes"
	"encoding/json"
	"os"
	"testing"
)

func assertGoldenJSON(t *testing.T, path string, value any) {
	t.Helper()
	fixture, err := os.ReadFile(path)
	if err != nil { t.Fatal(err) }
	encoded, err := json.Marshal(value)
	if err != nil { t.Fatal(err) }
	if !bytes.Equal(append(encoded, '\n'), fixture) { t.Fatalf("wire drift in %s\n got: %s\nwant: %s", path, encoded, fixture) }
}

func TestRetrieveRequestGoldenFixture(t *testing.T) {
	assertGoldenJSON(t, "testdata/retrieve_request.json", RetrieveRequest{
		Version: APIVersion,
		Object: ObjectRef{ObjectID:"object-1", ManifestID:"manifest-1", ShardIndex:3, ShardRoot:"root-1", SizeBytes:42, CommitmentID:"commitment-1"},
		Access: ReadAccess{Mode:AccessPrivate, Subject:"alice", SessionID:"session-1", Capability:"read"},
	})
}

func TestUploadPrepareRequestGoldenFixture(t *testing.T) {
	assertGoldenJSON(t, "testdata/upload_prepare_request.json", UploadPrepareRequest{
		Version: APIVersion,
		Object: ObjectRef{ObjectID:"object-1", ManifestID:"manifest-1", ShardIndex:3, ShardRoot:"root-1", SizeBytes:42, CommitmentID:"commitment-1"},
		IdempotencyKey: "idem-1",
		Preconditions: UploadPreconditions{AgreementID:"agreement-1", CapacityReservationID:"capacity-1", CommitmentID:"commitment-1"},
	})
}

func TestManifestDescriptorGoldenFixture(t *testing.T) {
	assertGoldenJSON(t, "testdata/manifest_descriptor.json", ManifestDescriptor{
		Version:APIVersion,
		ManifestID:"manifest-1",
		ObjectID:"object-1",
		ObjectContentRoot:"object-root-1",
		ManifestHash:"manifest-hash-1",
		EncryptionCommitment:"enc-1",
		ErasureRoot:"erasure-1",
		ObjectSizeBytes:42,
		SegmentCount:1,
		DataShards:1,
		TotalShards:1,
		PlacedShards:1,
		SealReady:true,
		Sealed:true,
		Retrievable:true,
		Shards:[]ShardSpec{{ShardIndex:0, ShardRoot:"root-1", SizeBytes:42, AgreementID:"agreement-1", CommitmentID:"commitment-1", NodeID:"node-a", Live:true}},
	})
}

func TestDiscoveryResultGoldenFixture(t *testing.T) {
	assertGoldenJSON(t, "testdata/discovery_result.json", DiscoveryResult{Version:APIVersion, Authoritative:false, Resources:[]ResourceDescriptor{{ProviderID:"provider-a", NodeID:"node-a", ServiceID:"store-a", Capability:"store", Priority:1, Endpoint:"https://store-a.invalid", State:"running", Health:"healthy", Authoritative:false}}})
}

func TestV1CompatibilityVersionFrozen(t *testing.T) {
	if APIVersion != "v1" { t.Fatalf("unexpected API version drift: %q", APIVersion) }
}

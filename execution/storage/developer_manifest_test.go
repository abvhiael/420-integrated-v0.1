package storage

import (
	"bytes"
	"errors"
	"testing"
)

func developerManifestSpec() DeveloperManifestSpec {
	shard0 := []byte("shard-zero")
	shard1 := []byte("shard-one")
	return DeveloperManifestSpec{
		Version: DeveloperAPIVersion,
		ObjectID: "object-manifest-1",
		ObjectContentRoot: DeveloperShardRoot([]byte("object-content")),
		EncryptionCommitment: DeveloperShardRoot([]byte("encryption-metadata")),
		ErasureRoot: DeveloperShardRoot([]byte("erasure-root")),
		ObjectSizeBytes: uint64(len(shard0)+len(shard1)),
		SegmentCount: 2,
		DataShards: 1,
		TotalShards: 2,
		Shards: []DeveloperShardSpec{
			{ShardIndex: 1, ShardRoot: DeveloperShardRoot(shard1), SizeBytes: uint64(len(shard1)), AgreementID: "agreement-1", CommitmentID: "commitment-1", NodeID: "node-1", Live: true},
			{ShardIndex: 0, ShardRoot: DeveloperShardRoot(shard0), SizeBytes: uint64(len(shard0)), AgreementID: "agreement-0", CommitmentID: "commitment-0", NodeID: "node-0", Live: true},
		},
	}
}

func TestBuildDeveloperManifestIsDeterministicAcrossShardOrder(t *testing.T) {
	a := developerManifestSpec()
	b := developerManifestSpec()
	b.Shards[0], b.Shards[1] = b.Shards[1], b.Shards[0]
	first, err := BuildDeveloperManifest(a)
	if err != nil { t.Fatal(err) }
	second, err := BuildDeveloperManifest(b)
	if err != nil { t.Fatal(err) }
	if first.ManifestHash != second.ManifestHash {
		t.Fatalf("manifest hash changed with input order: %q != %q", first.ManifestHash, second.ManifestHash)
	}
	if first.Shards[0].ShardIndex != 0 || first.Shards[1].ShardIndex != 1 {
		t.Fatalf("shards not canonicalized by index: %#v", first.Shards)
	}
}

func TestManifestHashIgnoresPlacementAndLivenessRotation(t *testing.T) {
	firstSpec := developerManifestSpec()
	secondSpec := developerManifestSpec()
	secondSpec.Shards[0].AgreementID = "replacement-agreement"
	secondSpec.Shards[0].CommitmentID = "replacement-commitment"
	secondSpec.Shards[0].NodeID = "replacement-node"
	secondSpec.Shards[0].Live = false
	first, err := BuildDeveloperManifest(firstSpec)
	if err != nil { t.Fatal(err) }
	second, err := BuildDeveloperManifest(secondSpec)
	if err != nil { t.Fatal(err) }
	if first.ManifestHash != second.ManifestHash {
		t.Fatalf("placement rotation changed immutable manifest hash: %q != %q", first.ManifestHash, second.ManifestHash)
	}
}

func TestDeveloperShardRootMatchesSHA256(t *testing.T) {
	payload := []byte("root me")
	if got := DeveloperShardRoot(payload); got != DeveloperShardRoot(bytes.Clone(payload)) {
		t.Fatalf("non-deterministic shard root %q", got)
	}
}

func TestBuildDeveloperManifestRejectsDuplicateShardIndex(t *testing.T) {
	spec := developerManifestSpec()
	spec.Shards[1].ShardIndex = spec.Shards[0].ShardIndex
	if _, err := BuildDeveloperManifest(spec); !errors.Is(err, ErrDeveloperManifest) {
		t.Fatalf("expected duplicate rejection, got %v", err)
	}
}

func TestBuildDeveloperManifestRejectsPartialBackingIdentity(t *testing.T) {
	spec := developerManifestSpec()
	spec.Shards[0].CommitmentID = ""
	if _, err := BuildDeveloperManifest(spec); !errors.Is(err, ErrDeveloperManifest) {
		t.Fatalf("expected partial placement rejection, got %v", err)
	}
}

func TestSealReadinessIsSeparateFromRetrievability(t *testing.T) {
	spec := developerManifestSpec()
	manifest, err := BuildDeveloperManifest(spec)
	if err != nil { t.Fatal(err) }
	if !manifest.SealReady { t.Fatal("complete placement set should be seal-ready") }
	if manifest.Retrievable { t.Fatal("unsealed manifest must not be retrievable") }

	spec.Sealed = true
	for i := range spec.Shards { spec.Shards[i].Live = false }
	manifest, err = BuildDeveloperManifest(spec)
	if err != nil { t.Fatal(err) }
	if manifest.Retrievable { t.Fatal("sealed manifest with no live data shards must not be retrievable") }

	spec.Shards[1].Live = true
	manifest, err = BuildDeveloperManifest(spec)
	if err != nil { t.Fatal(err) }
	if !manifest.Retrievable { t.Fatal("sealed manifest with one live shard should satisfy data_shards=1") }
}

func TestSealedIncompleteManifestRejected(t *testing.T) {
	spec := developerManifestSpec()
	spec.Shards = spec.Shards[:1]
	spec.Sealed = true
	if _, err := BuildDeveloperManifest(spec); !errors.Is(err, ErrDeveloperManifest) {
		t.Fatalf("expected sealed-incomplete rejection, got %v", err)
	}
}

func TestIncompleteManifestIsNotSealReady(t *testing.T) {
	spec := developerManifestSpec()
	spec.Shards = spec.Shards[:1]
	manifest, err := BuildDeveloperManifest(spec)
	if err != nil { t.Fatal(err) }
	if manifest.SealReady || manifest.Retrievable {
		t.Fatalf("incomplete manifest reported ready: %#v", manifest)
	}
}

func TestDeveloperPlacementCompatiblePreservesShardIdentity(t *testing.T) {
	manifest, err := BuildDeveloperManifest(developerManifestSpec())
	if err != nil { t.Fatal(err) }
	shard := manifest.Shards[0]
	if !DeveloperPlacementCompatible(manifest, shard) { t.Fatal("expected compatible placement") }
	shard.ShardRoot = DeveloperShardRoot([]byte("different"))
	if DeveloperPlacementCompatible(manifest, shard) { t.Fatal("replacement root must not be accepted") }
}

func TestDeveloperObjectRefFromManifestRequiresCanonicalManifestID(t *testing.T) {
	manifest, err := BuildDeveloperManifest(developerManifestSpec())
	if err != nil { t.Fatal(err) }
	ref, err := DeveloperObjectRefFromManifest(manifest, "canonical-manifest-1", 0)
	if err != nil { t.Fatal(err) }
	if ref.ObjectID != manifest.ObjectID || ref.ManifestID != "canonical-manifest-1" || ref.CommitmentID != "commitment-0" || ref.ShardIndex != 0 {
		t.Fatalf("unexpected object ref %#v", ref)
	}
	if _, err := DeveloperObjectRefFromManifest(manifest, "", 0); !errors.Is(err, ErrDeveloperManifest) {
		t.Fatalf("expected missing canonical manifest id error, got %v", err)
	}
}

func TestDeveloperObjectRefRequiresBackedShard(t *testing.T) {
	spec := developerManifestSpec()
	spec.Shards[0].AgreementID = ""
	spec.Shards[0].CommitmentID = ""
	spec.Shards[0].NodeID = ""
	manifest, err := BuildDeveloperManifest(spec)
	if err != nil { t.Fatal(err) }
	if _, err := DeveloperObjectRefFromManifest(manifest, "canonical-manifest-1", 1); !errors.Is(err, ErrDeveloperManifest) {
		t.Fatalf("expected unbacked shard error, got %v", err)
	}
}

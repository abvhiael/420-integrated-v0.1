package storage

import (
	"errors"
	"math/rand"
	"strings"
	"testing"
)

func TestDeveloperManifestRejectsMalformedDigests(t *testing.T) {
	cases := []struct {
		name   string
		mutate func(*DeveloperManifestSpec)
	}{
		{"object-content-root", func(s *DeveloperManifestSpec) { s.ObjectContentRoot = "not-a-digest" }},
		{"encryption-commitment", func(s *DeveloperManifestSpec) { s.EncryptionCommitment = strings.Repeat("g", 64) }},
		{"erasure-root", func(s *DeveloperManifestSpec) { s.ErasureRoot = strings.Repeat("0", 63) }},
		{"shard-root", func(s *DeveloperManifestSpec) { s.Shards[0].ShardRoot = "abcd" }},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			spec := developerManifestSpec()
			tc.mutate(&spec)
			if _, err := BuildDeveloperManifest(spec); !errors.Is(err, ErrDeveloperManifest) {
				t.Fatalf("expected malformed digest rejection, got %v", err)
			}
		})
	}
}

func TestDeveloperManifestHashStableAcrossManyShardPermutations(t *testing.T) {
	base := developerManifestSpec()
	first, err := BuildDeveloperManifest(base)
	if err != nil { t.Fatal(err) }

	for seed := int64(0); seed < 64; seed++ {
		spec := developerManifestSpec()
		rand.New(rand.NewSource(seed)).Shuffle(len(spec.Shards), func(i, j int) {
			spec.Shards[i], spec.Shards[j] = spec.Shards[j], spec.Shards[i]
		})
		got, err := BuildDeveloperManifest(spec)
		if err != nil { t.Fatalf("seed %d: %v", seed, err) }
		if got.ManifestHash != first.ManifestHash {
			t.Fatalf("seed %d changed manifest hash: %s != %s", seed, got.ManifestHash, first.ManifestHash)
		}
	}
}

func TestDeveloperManifestImmutableFieldsChangeHash(t *testing.T) {
	base, err := BuildDeveloperManifest(developerManifestSpec())
	if err != nil { t.Fatal(err) }

	cases := []struct {
		name   string
		mutate func(*DeveloperManifestSpec)
	}{
		{"object", func(s *DeveloperManifestSpec) { s.ObjectID += "-changed" }},
		{"content-root", func(s *DeveloperManifestSpec) { s.ObjectContentRoot = DeveloperShardRoot([]byte("changed-content")) }},
		{"encryption", func(s *DeveloperManifestSpec) { s.EncryptionCommitment = DeveloperShardRoot([]byte("changed-encryption")) }},
		{"erasure", func(s *DeveloperManifestSpec) { s.ErasureRoot = DeveloperShardRoot([]byte("changed-erasure")) }},
		{"shard-root", func(s *DeveloperManifestSpec) { s.Shards[0].ShardRoot = DeveloperShardRoot([]byte("changed-shard")) }},
		{"shard-size", func(s *DeveloperManifestSpec) { s.Shards[0].SizeBytes++ }},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			spec := developerManifestSpec()
			tc.mutate(&spec)
			got, err := BuildDeveloperManifest(spec)
			if err != nil { t.Fatal(err) }
			if got.ManifestHash == base.ManifestHash {
				t.Fatalf("immutable mutation %s did not change manifest hash", tc.name)
			}
		})
	}
}

func TestDeveloperObjectRefRejectsPartiallyBackedDescriptor(t *testing.T) {
	manifest, err := BuildDeveloperManifest(developerManifestSpec())
	if err != nil { t.Fatal(err) }
	manifest.Shards[0].AgreementID = ""
	if _, err := DeveloperObjectRefFromManifest(manifest, "canonical-manifest", manifest.Shards[0].ShardIndex); !errors.Is(err, ErrDeveloperManifest) {
		t.Fatalf("expected partially backed descriptor rejection, got %v", err)
	}
}

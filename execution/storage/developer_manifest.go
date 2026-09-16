package storage

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"sort"
	"strings"
)

var ErrDeveloperManifest = errors.New("developer manifest helper failure")

type DeveloperShardSpec struct {
	ShardIndex   uint32 `json:"shard_index"`
	ShardRoot    string `json:"shard_root"`
	SizeBytes    uint64 `json:"size_bytes"`
	AgreementID  string `json:"agreement_id,omitempty"`
	CommitmentID string `json:"commitment_id,omitempty"`
	NodeID       string `json:"node_id,omitempty"`
	Live         bool   `json:"live"`
}

type DeveloperManifestSpec struct {
	Version              string               `json:"version"`
	ObjectID             string               `json:"object_id"`
	ObjectContentRoot    string               `json:"object_content_root"`
	EncryptionCommitment string               `json:"encryption_commitment"`
	ErasureRoot          string               `json:"erasure_root"`
	ObjectSizeBytes      uint64               `json:"object_size_bytes"`
	SegmentCount         uint32               `json:"segment_count"`
	DataShards           uint32               `json:"data_shards"`
	TotalShards          uint32               `json:"total_shards"`
	Sealed               bool                 `json:"sealed"`
	Shards               []DeveloperShardSpec `json:"shards"`
}

type DeveloperManifestDescriptor struct {
	Version              string               `json:"version"`
	ObjectID             string               `json:"object_id"`
	ObjectContentRoot    string               `json:"object_content_root"`
	ManifestHash         string               `json:"manifest_hash"`
	EncryptionCommitment string               `json:"encryption_commitment"`
	ErasureRoot          string               `json:"erasure_root"`
	ObjectSizeBytes      uint64               `json:"object_size_bytes"`
	SegmentCount         uint32               `json:"segment_count"`
	DataShards           uint32               `json:"data_shards"`
	TotalShards          uint32               `json:"total_shards"`
	PlacedShards         uint32               `json:"placed_shards"`
	Sealed               bool                 `json:"sealed"`
	SealReady            bool                 `json:"seal_ready"`
	Retrievable          bool                 `json:"retrievable"`
	Shards               []DeveloperShardSpec `json:"shards"`
}

func DeveloperShardRoot(payload []byte) string {
	sum := sha256.Sum256(payload)
	return hex.EncodeToString(sum[:])
}

func BuildDeveloperManifest(spec DeveloperManifestSpec) (DeveloperManifestDescriptor, error) {
	version := strings.TrimSpace(spec.Version)
	if version == "" {
		version = DeveloperAPIVersion
	}
	if version != DeveloperAPIVersion {
		return DeveloperManifestDescriptor{}, ErrDeveloperManifest
	}
	objectID := strings.TrimSpace(spec.ObjectID)
	contentRoot := strings.ToLower(strings.TrimSpace(spec.ObjectContentRoot))
	encryption := strings.ToLower(strings.TrimSpace(spec.EncryptionCommitment))
	erasure := strings.ToLower(strings.TrimSpace(spec.ErasureRoot))
	if objectID == "" || contentRoot == "" || encryption == "" || erasure == "" || spec.ObjectSizeBytes == 0 || spec.SegmentCount == 0 || spec.DataShards == 0 || spec.TotalShards == 0 || spec.DataShards > spec.TotalShards {
		return DeveloperManifestDescriptor{}, ErrDeveloperManifest
	}
	if len(spec.Shards) > int(spec.TotalShards) {
		return DeveloperManifestDescriptor{}, ErrDeveloperManifest
	}
	shards := append([]DeveloperShardSpec(nil), spec.Shards...)
	seen := make(map[uint32]struct{}, len(shards))
	for i := range shards {
		shards[i].ShardRoot = strings.ToLower(strings.TrimSpace(shards[i].ShardRoot))
		shards[i].AgreementID = strings.TrimSpace(shards[i].AgreementID)
		shards[i].CommitmentID = strings.TrimSpace(shards[i].CommitmentID)
		shards[i].NodeID = strings.TrimSpace(shards[i].NodeID)
		if shards[i].ShardIndex >= spec.TotalShards || shards[i].ShardRoot == "" || shards[i].SizeBytes == 0 {
			return DeveloperManifestDescriptor{}, ErrDeveloperManifest
		}
		if _, ok := seen[shards[i].ShardIndex]; ok {
			return DeveloperManifestDescriptor{}, ErrDeveloperManifest
		}
		seen[shards[i].ShardIndex] = struct{}{}
		backingFields := 0
		if shards[i].AgreementID != "" { backingFields++ }
		if shards[i].CommitmentID != "" { backingFields++ }
		if shards[i].NodeID != "" { backingFields++ }
		if backingFields != 0 && backingFields != 3 {
			return DeveloperManifestDescriptor{}, ErrDeveloperManifest
		}
	}
	sort.Slice(shards, func(i, j int) bool { return shards[i].ShardIndex < shards[j].ShardIndex })

	type immutableShard struct {
		ShardIndex uint32 `json:"shard_index"`
		ShardRoot  string `json:"shard_root"`
		SizeBytes  uint64 `json:"size_bytes"`
	}
	immutable := make([]immutableShard, 0, len(shards))
	for _, shard := range shards {
		immutable = append(immutable, immutableShard{ShardIndex: shard.ShardIndex, ShardRoot: shard.ShardRoot, SizeBytes: shard.SizeBytes})
	}
	type hashEnvelope struct {
		Version              string           `json:"version"`
		ObjectID             string           `json:"object_id"`
		ObjectContentRoot    string           `json:"object_content_root"`
		EncryptionCommitment string           `json:"encryption_commitment"`
		ErasureRoot          string           `json:"erasure_root"`
		ObjectSizeBytes      uint64           `json:"object_size_bytes"`
		SegmentCount         uint32           `json:"segment_count"`
		DataShards           uint32           `json:"data_shards"`
		TotalShards          uint32           `json:"total_shards"`
		Shards               []immutableShard `json:"shards"`
	}
	encoded, err := json.Marshal(hashEnvelope{version, objectID, contentRoot, encryption, erasure, spec.ObjectSizeBytes, spec.SegmentCount, spec.DataShards, spec.TotalShards, immutable})
	if err != nil {
		return DeveloperManifestDescriptor{}, err
	}
	hash := sha256.Sum256(encoded)
	placed := uint32(0)
	live := uint32(0)
	for _, shard := range shards {
		if shard.AgreementID != "" && shard.CommitmentID != "" && shard.NodeID != "" {
			placed++
			if shard.Live { live++ }
		}
	}
	sealReady := placed == spec.TotalShards && uint32(len(shards)) == spec.TotalShards
	if spec.Sealed && !sealReady {
		return DeveloperManifestDescriptor{}, ErrDeveloperManifest
	}
	return DeveloperManifestDescriptor{
		Version: version, ObjectID: objectID, ObjectContentRoot: contentRoot,
		ManifestHash: hex.EncodeToString(hash[:]), EncryptionCommitment: encryption, ErasureRoot: erasure,
		ObjectSizeBytes: spec.ObjectSizeBytes, SegmentCount: spec.SegmentCount, DataShards: spec.DataShards, TotalShards: spec.TotalShards,
		PlacedShards: placed, Sealed: spec.Sealed, SealReady: sealReady, Retrievable: spec.Sealed && live >= spec.DataShards, Shards: shards,
	}, nil
}

func DeveloperPlacementCompatible(manifest DeveloperManifestDescriptor, shard DeveloperShardSpec) bool {
	if manifest.Version != DeveloperAPIVersion || shard.ShardIndex >= manifest.TotalShards || strings.TrimSpace(shard.ShardRoot) == "" || shard.SizeBytes == 0 {
		return false
	}
	for _, expected := range manifest.Shards {
		if expected.ShardIndex == shard.ShardIndex {
			return strings.EqualFold(strings.TrimSpace(expected.ShardRoot), strings.TrimSpace(shard.ShardRoot)) && expected.SizeBytes == shard.SizeBytes
		}
	}
	return false
}

func DeveloperObjectRefFromManifest(manifest DeveloperManifestDescriptor, manifestID string, shardIndex uint32) (DeveloperObjectRef, error) {
	manifestID = strings.TrimSpace(manifestID)
	if manifestID == "" {
		return DeveloperObjectRef{}, ErrDeveloperManifest
	}
	for _, shard := range manifest.Shards {
		if shard.ShardIndex != shardIndex {
			continue
		}
		if shard.CommitmentID == "" {
			return DeveloperObjectRef{}, ErrDeveloperManifest
		}
		return DeveloperObjectRef{ObjectID: manifest.ObjectID, ManifestID: manifestID, ShardIndex: shard.ShardIndex, ShardRoot: shard.ShardRoot, SizeBytes: shard.SizeBytes, CommitmentID: shard.CommitmentID}, nil
	}
	return DeveloperObjectRef{}, ErrDeveloperManifest
}

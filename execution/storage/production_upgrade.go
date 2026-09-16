package storage

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"sort"
	"strings"
)

var ErrProductionUpgrade = errors.New("production resource upgrade failure")

const ProductionConfigSchemaVersion = "storage-topology-v1"

type ProductionReleaseSpec struct {
	ProviderID          string `json:"provider_id"`
	NodeID              string `json:"node_id"`
	SoftwareVersion     string `json:"software_version"`
	APIVersion          string `json:"api_version"`
	ConfigSchemaVersion string `json:"config_schema_version"`
}

type ProductionUpgradeStep struct {
	ProviderID      string `json:"provider_id"`
	NodeID          string `json:"node_id"`
	FromVersion     string `json:"from_version"`
	ToVersion       string `json:"to_version"`
	CompatibilityID string `json:"compatibility_id"`
}

type ProductionUpgradePlan struct {
	APIVersion          string                  `json:"api_version"`
	ConfigSchemaVersion string                  `json:"config_schema_version"`
	Steps               []ProductionUpgradeStep `json:"steps"`
}

// BuildProductionUpgradePlan produces a deterministic rolling plan while keeping
// the public storage API and topology schema fixed. Software releases may differ;
// protocol compatibility may not silently drift during SR-10 rolling upgrades.
func BuildProductionUpgradePlan(current, target []ProductionReleaseSpec) (ProductionUpgradePlan, error) {
	if len(current) < 2 || len(current) != len(target) {
		return ProductionUpgradePlan{}, ErrProductionUpgrade
	}
	cur := make(map[string]ProductionReleaseSpec, len(current))
	providers := make(map[string]struct{})
	for _, spec := range current {
		n, key, err := normalizeProductionRelease(spec)
		if err != nil {
			return ProductionUpgradePlan{}, err
		}
		if _, exists := cur[key]; exists {
			return ProductionUpgradePlan{}, ErrProductionUpgrade
		}
		cur[key] = n
		providers[strings.ToLower(n.ProviderID)] = struct{}{}
	}
	if len(providers) < 2 {
		return ProductionUpgradePlan{}, ErrProductionUpgrade
	}

	steps := make([]ProductionUpgradeStep, 0, len(target))
	seenTarget := make(map[string]struct{}, len(target))
	for _, spec := range target {
		n, key, err := normalizeProductionRelease(spec)
		if err != nil {
			return ProductionUpgradePlan{}, err
		}
		if _, exists := seenTarget[key]; exists {
			return ProductionUpgradePlan{}, ErrProductionUpgrade
		}
		seenTarget[key] = struct{}{}
		old, ok := cur[key]
		if !ok || old.APIVersion != n.APIVersion || old.ConfigSchemaVersion != n.ConfigSchemaVersion {
			return ProductionUpgradePlan{}, ErrProductionUpgrade
		}
		if old.SoftwareVersion == n.SoftwareVersion {
			continue
		}
		steps = append(steps, ProductionUpgradeStep{
			ProviderID: old.ProviderID,
			NodeID: old.NodeID,
			FromVersion: old.SoftwareVersion,
			ToVersion: n.SoftwareVersion,
			CompatibilityID: productionCompatibilityID(n.APIVersion, n.ConfigSchemaVersion),
		})
	}
	if len(seenTarget) != len(cur) {
		return ProductionUpgradePlan{}, ErrProductionUpgrade
	}
	sort.Slice(steps, func(i, j int) bool {
		if !strings.EqualFold(steps[i].ProviderID, steps[j].ProviderID) {
			return strings.ToLower(steps[i].ProviderID) < strings.ToLower(steps[j].ProviderID)
		}
		return strings.ToLower(steps[i].NodeID) < strings.ToLower(steps[j].NodeID)
	})
	return ProductionUpgradePlan{APIVersion: DeveloperAPIVersion, ConfigSchemaVersion: ProductionConfigSchemaVersion, Steps: steps}, nil
}

func normalizeProductionRelease(spec ProductionReleaseSpec) (ProductionReleaseSpec, string, error) {
	spec.ProviderID = strings.TrimSpace(spec.ProviderID)
	spec.NodeID = strings.TrimSpace(spec.NodeID)
	spec.SoftwareVersion = strings.TrimSpace(spec.SoftwareVersion)
	spec.APIVersion = strings.TrimSpace(spec.APIVersion)
	spec.ConfigSchemaVersion = strings.TrimSpace(spec.ConfigSchemaVersion)
	if spec.ProviderID == "" || spec.NodeID == "" || spec.SoftwareVersion == "" || spec.APIVersion != DeveloperAPIVersion || spec.ConfigSchemaVersion != ProductionConfigSchemaVersion {
		return ProductionReleaseSpec{}, "", ErrProductionUpgrade
	}
	return spec, strings.ToLower(spec.ProviderID + "\x00" + spec.NodeID), nil
}

func productionCompatibilityID(apiVersion, schemaVersion string) string {
	sum := sha256.Sum256([]byte(strings.TrimSpace(apiVersion) + "\n" + strings.TrimSpace(schemaVersion)))
	return hex.EncodeToString(sum[:])
}

// ProductionManifestIdentityFingerprint binds the immutable storage identity used
// to prove that rolling upgrade/rollback has not rewritten canonical object data.
func ProductionManifestIdentityFingerprint(manifest DeveloperManifestDescriptor) (string, error) {
	if manifest.Version != DeveloperAPIVersion || strings.TrimSpace(manifest.ObjectID) == "" || !validDeveloperDigest(strings.ToLower(strings.TrimSpace(manifest.ManifestHash))) {
		return "", ErrProductionUpgrade
	}
	type shardIdentity struct {
		ShardIndex   uint32 `json:"shard_index"`
		ShardRoot    string `json:"shard_root"`
		SizeBytes    uint64 `json:"size_bytes"`
		AgreementID  string `json:"agreement_id"`
		CommitmentID string `json:"commitment_id"`
		NodeID       string `json:"node_id"`
	}
	shards := make([]shardIdentity, 0, len(manifest.Shards))
	for _, shard := range manifest.Shards {
		if !validDeveloperDigest(strings.ToLower(strings.TrimSpace(shard.ShardRoot))) || shard.SizeBytes == 0 {
			return "", ErrProductionUpgrade
		}
		shards = append(shards, shardIdentity{ShardIndex: shard.ShardIndex, ShardRoot: strings.ToLower(strings.TrimSpace(shard.ShardRoot)), SizeBytes: shard.SizeBytes, AgreementID: strings.TrimSpace(shard.AgreementID), CommitmentID: strings.TrimSpace(shard.CommitmentID), NodeID: strings.TrimSpace(shard.NodeID)})
	}
	sort.Slice(shards, func(i, j int) bool { return shards[i].ShardIndex < shards[j].ShardIndex })
	envelope := struct {
		Version      string          `json:"version"`
		ObjectID     string          `json:"object_id"`
		ManifestHash string          `json:"manifest_hash"`
		Shards       []shardIdentity `json:"shards"`
	}{manifest.Version, strings.TrimSpace(manifest.ObjectID), strings.ToLower(strings.TrimSpace(manifest.ManifestHash)), shards}
	encoded, err := json.Marshal(envelope)
	if err != nil {
		return "", err
	}
	sum := sha256.Sum256(encoded)
	return hex.EncodeToString(sum[:]), nil
}

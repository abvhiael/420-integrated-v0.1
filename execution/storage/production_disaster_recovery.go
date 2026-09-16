package storage

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"sort"
	"strconv"
	"strings"
	"time"
)

var ErrProductionDisasterRecovery = errors.New("production disaster recovery failure")

const ProductionDRSchemaVersion = "storage-dr-v1"

type ProductionDRManifestIdentity struct {
	ManifestID   string `json:"manifest_id"`
	ObjectID     string `json:"object_id"`
	ManifestHash string `json:"manifest_hash"`
	Fingerprint  string `json:"fingerprint"`
}

type ProductionDRServiceState struct {
	ProviderID string               `json:"provider_id"`
	NodeID     string               `json:"node_id"`
	ServiceID  string               `json:"service_id"`
	State      ResourceServiceState `json:"state"`
}

type ProductionDRBackup struct {
	SchemaVersion       string                          `json:"schema_version"`
	CapturedAt          time.Time                       `json:"captured_at"`
	TopologyFingerprint string                          `json:"topology_fingerprint"`
	Manifests           []ProductionDRManifestIdentity `json:"manifests"`
	Services            []ProductionDRServiceState     `json:"services"`
}

type ProductionDRRestorePolicy struct {
	MaxRecoveryPointAge time.Duration
	MaxRecoveryTime     time.Duration
}

type ProductionDRRestoreEvidence struct {
	SchemaVersion       string        `json:"schema_version"`
	BackupAge           time.Duration `json:"backup_age"`
	RecoveryDuration    time.Duration `json:"recovery_duration"`
	ManifestCount       int           `json:"manifest_count"`
	ServiceCount        int           `json:"service_count"`
	TopologyFingerprint string        `json:"topology_fingerprint"`
	Reconciled          bool          `json:"reconciled"`
}

// BuildProductionDRBackup captures only derived operational state and identity
// fingerprints. It does not serialize credentials, payloads, agreements, proofs,
// settlement state, or any replacement source of canonical authority.
func BuildProductionDRBackup(capturedAt time.Time, topologyFingerprint string, topology *ProductionResourceTopology, manifests map[string]DeveloperManifestDescriptor) (ProductionDRBackup, error) {
	if capturedAt.IsZero() || topology == nil || strings.TrimSpace(topologyFingerprint) == "" {
		return ProductionDRBackup{}, ErrProductionDisasterRecovery
	}
	backup := ProductionDRBackup{SchemaVersion: ProductionDRSchemaVersion, CapturedAt: capturedAt.UTC(), TopologyFingerprint: strings.TrimSpace(topologyFingerprint)}
	for manifestID, manifest := range manifests {
		identity, err := productionDRManifestIdentity(manifestID, manifest)
		if err != nil {
			return ProductionDRBackup{}, err
		}
		backup.Manifests = append(backup.Manifests, identity)
	}
	sort.Slice(backup.Manifests, func(i, j int) bool { return strings.ToLower(backup.Manifests[i].ManifestID) < strings.ToLower(backup.Manifests[j].ManifestID) })
	for _, node := range topology.Nodes() {
		for _, service := range node.Runtime.Snapshot() {
			backup.Services = append(backup.Services, ProductionDRServiceState{ProviderID: service.Descriptor.ProviderID, NodeID: service.Descriptor.NodeID, ServiceID: service.Descriptor.ServiceID, State: service.State})
		}
	}
	sort.Slice(backup.Services, func(i, j int) bool {
		left := strings.ToLower(backup.Services[i].ProviderID + "\x00" + backup.Services[i].NodeID + "\x00" + backup.Services[i].ServiceID)
		right := strings.ToLower(backup.Services[j].ProviderID + "\x00" + backup.Services[j].NodeID + "\x00" + backup.Services[j].ServiceID)
		return left < right
	})
	return backup, nil
}

// ReconcileProductionDRRestore validates a restore against current canonical
// manifest identities and the target topology fingerprint. Backup state is
// advisory and cannot overwrite canonical storage history.
func ReconcileProductionDRRestore(now time.Time, recoveryDuration time.Duration, backup ProductionDRBackup, targetTopologyFingerprint string, canonicalManifests map[string]DeveloperManifestDescriptor, policy ProductionDRRestorePolicy) (ProductionDRRestoreEvidence, error) {
	if now.IsZero() || backup.SchemaVersion != ProductionDRSchemaVersion || backup.CapturedAt.IsZero() || recoveryDuration < 0 || strings.TrimSpace(targetTopologyFingerprint) == "" || policy.MaxRecoveryPointAge <= 0 || policy.MaxRecoveryTime <= 0 {
		return ProductionDRRestoreEvidence{}, ErrProductionDisasterRecovery
	}
	age := now.UTC().Sub(backup.CapturedAt.UTC())
	if age < 0 || age > policy.MaxRecoveryPointAge || recoveryDuration > policy.MaxRecoveryTime || !strings.EqualFold(strings.TrimSpace(backup.TopologyFingerprint), strings.TrimSpace(targetTopologyFingerprint)) {
		return ProductionDRRestoreEvidence{}, ErrProductionDisasterRecovery
	}
	if len(backup.Manifests) != len(canonicalManifests) {
		return ProductionDRRestoreEvidence{}, ErrProductionDisasterRecovery
	}
	for _, saved := range backup.Manifests {
		manifest, ok := canonicalManifests[saved.ManifestID]
		if !ok {
			return ProductionDRRestoreEvidence{}, ErrProductionDisasterRecovery
		}
		current, err := productionDRManifestIdentity(saved.ManifestID, manifest)
		if err != nil || current.ObjectID != saved.ObjectID || !strings.EqualFold(current.ManifestHash, saved.ManifestHash) || current.Fingerprint != saved.Fingerprint {
			return ProductionDRRestoreEvidence{}, ErrProductionDisasterRecovery
		}
	}
	return ProductionDRRestoreEvidence{SchemaVersion: backup.SchemaVersion, BackupAge: age, RecoveryDuration: recoveryDuration, ManifestCount: len(backup.Manifests), ServiceCount: len(backup.Services), TopologyFingerprint: strings.TrimSpace(targetTopologyFingerprint), Reconciled: true}, nil
}

func productionDRManifestIdentity(manifestID string, manifest DeveloperManifestDescriptor) (ProductionDRManifestIdentity, error) {
	manifestID = strings.TrimSpace(manifestID)
	if manifestID == "" || manifest.Version != DeveloperAPIVersion || strings.TrimSpace(manifest.ObjectID) == "" || !validDeveloperDigest(strings.ToLower(strings.TrimSpace(manifest.ManifestHash))) {
		return ProductionDRManifestIdentity{}, ErrProductionDisasterRecovery
	}
	parts := []string{manifest.Version, manifestID, manifest.ObjectID, strings.ToLower(strings.TrimSpace(manifest.ManifestHash))}
	shards := append([]DeveloperShardSpec(nil), manifest.Shards...)
	sort.Slice(shards, func(i, j int) bool { return shards[i].ShardIndex < shards[j].ShardIndex })
	for _, shard := range shards {
		parts = append(parts, strings.Join([]string{strconv.FormatUint(uint64(shard.ShardIndex), 10), strings.ToLower(strings.TrimSpace(shard.ShardRoot)), strings.TrimSpace(shard.AgreementID), strings.TrimSpace(shard.CommitmentID), strings.TrimSpace(shard.NodeID)}, "\x00"))
	}
	sum := sha256.Sum256([]byte(strings.Join(parts, "\n")))
	return ProductionDRManifestIdentity{ManifestID: manifestID, ObjectID: manifest.ObjectID, ManifestHash: strings.ToLower(strings.TrimSpace(manifest.ManifestHash)), Fingerprint: hex.EncodeToString(sum[:])}, nil
}

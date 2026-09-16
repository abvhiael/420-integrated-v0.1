package storage

import (
	"errors"
	"testing"
	"time"
)

func productionDRTestManifest(t *testing.T) DeveloperManifestDescriptor {
	t.Helper()
	root := DeveloperShardRoot([]byte("shard-zero"))
	digestA := DeveloperShardRoot([]byte("object"))
	digestB := DeveloperShardRoot([]byte("encryption"))
	digestC := DeveloperShardRoot([]byte("erasure"))
	manifest, err := BuildDeveloperManifest(DeveloperManifestSpec{
		ObjectID: "object-a", ObjectContentRoot: digestA, EncryptionCommitment: digestB, ErasureRoot: digestC,
		ObjectSizeBytes: 10, SegmentCount: 1, DataShards: 1, TotalShards: 1, Sealed: true,
		Shards: []DeveloperShardSpec{{ShardIndex: 0, ShardRoot: root, SizeBytes: uint64(len("shard-zero")), AgreementID: "agreement-a", CommitmentID: "commitment-a", NodeID: "node-a", Live: true}},
	})
	if err != nil {
		t.Fatal(err)
	}
	return manifest
}

func TestProductionDRBackupAndRestoreReconcilesCanonicalIdentity(t *testing.T) {
	topology := buildProductionTestTopology(t, []byte("payload"))
	if err := topology.StartAll(); err != nil {
		t.Fatal(err)
	}
	manifest := productionDRTestManifest(t)
	captured := time.Date(2026, 9, 16, 17, 0, 0, 0, time.UTC)
	backup, err := BuildProductionDRBackup(captured, "topology-fingerprint-a", topology, map[string]DeveloperManifestDescriptor{"manifest-a": manifest})
	if err != nil {
		t.Fatal(err)
	}
	if len(backup.Services) != 4 || len(backup.Manifests) != 1 {
		t.Fatalf("unexpected backup evidence: %#v", backup)
	}
	evidence, err := ReconcileProductionDRRestore(captured.Add(20*time.Minute), 4*time.Minute, backup, "topology-fingerprint-a", map[string]DeveloperManifestDescriptor{"manifest-a": manifest}, ProductionDRRestorePolicy{MaxRecoveryPointAge: time.Hour, MaxRecoveryTime: 10 * time.Minute})
	if err != nil {
		t.Fatal(err)
	}
	if !evidence.Reconciled || evidence.BackupAge != 20*time.Minute || evidence.RecoveryDuration != 4*time.Minute {
		t.Fatalf("unexpected restore evidence: %#v", evidence)
	}
}

func TestProductionDRRestoreRejectsCanonicalPlacementRewrite(t *testing.T) {
	topology := buildProductionTestTopology(t, []byte("payload"))
	manifest := productionDRTestManifest(t)
	captured := time.Date(2026, 9, 16, 17, 0, 0, 0, time.UTC)
	backup, err := BuildProductionDRBackup(captured, "topology-fingerprint-a", topology, map[string]DeveloperManifestDescriptor{"manifest-a": manifest})
	if err != nil {
		t.Fatal(err)
	}
	rewritten := manifest
	rewritten.Shards = append([]DeveloperShardSpec(nil), manifest.Shards...)
	rewritten.Shards[0].CommitmentID = "replacement-commitment"
	_, err = ReconcileProductionDRRestore(captured.Add(10*time.Minute), time.Minute, backup, "topology-fingerprint-a", map[string]DeveloperManifestDescriptor{"manifest-a": rewritten}, ProductionDRRestorePolicy{MaxRecoveryPointAge: time.Hour, MaxRecoveryTime: 10 * time.Minute})
	if !errors.Is(err, ErrProductionDisasterRecovery) {
		t.Fatalf("expected canonical identity mismatch rejection, got %v", err)
	}
}

func TestProductionDRRestoreEnforcesRPOAndRTO(t *testing.T) {
	topology := buildProductionTestTopology(t, []byte("payload"))
	manifest := productionDRTestManifest(t)
	captured := time.Date(2026, 9, 16, 17, 0, 0, 0, time.UTC)
	backup, err := BuildProductionDRBackup(captured, "topology-fingerprint-a", topology, map[string]DeveloperManifestDescriptor{"manifest-a": manifest})
	if err != nil {
		t.Fatal(err)
	}
	policy := ProductionDRRestorePolicy{MaxRecoveryPointAge: 30 * time.Minute, MaxRecoveryTime: 5 * time.Minute}
	if _, err := ReconcileProductionDRRestore(captured.Add(31*time.Minute), time.Minute, backup, "topology-fingerprint-a", map[string]DeveloperManifestDescriptor{"manifest-a": manifest}, policy); !errors.Is(err, ErrProductionDisasterRecovery) {
		t.Fatalf("expected RPO rejection, got %v", err)
	}
	if _, err := ReconcileProductionDRRestore(captured.Add(10*time.Minute), 6*time.Minute, backup, "topology-fingerprint-a", map[string]DeveloperManifestDescriptor{"manifest-a": manifest}, policy); !errors.Is(err, ErrProductionDisasterRecovery) {
		t.Fatalf("expected RTO rejection, got %v", err)
	}
}

func TestProductionDRRestoreRejectsTopologySubstitution(t *testing.T) {
	topology := buildProductionTestTopology(t, []byte("payload"))
	manifest := productionDRTestManifest(t)
	captured := time.Date(2026, 9, 16, 17, 0, 0, 0, time.UTC)
	backup, err := BuildProductionDRBackup(captured, "topology-fingerprint-a", topology, map[string]DeveloperManifestDescriptor{"manifest-a": manifest})
	if err != nil {
		t.Fatal(err)
	}
	_, err = ReconcileProductionDRRestore(captured.Add(10*time.Minute), time.Minute, backup, "topology-fingerprint-b", map[string]DeveloperManifestDescriptor{"manifest-a": manifest}, ProductionDRRestorePolicy{MaxRecoveryPointAge: time.Hour, MaxRecoveryTime: 10 * time.Minute})
	if !errors.Is(err, ErrProductionDisasterRecovery) {
		t.Fatalf("expected topology mismatch rejection, got %v", err)
	}
}

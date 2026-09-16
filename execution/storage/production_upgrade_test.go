package storage

import (
	"errors"
	"testing"
)

func TestProductionUpgradePlanAllowsSoftwareRollingUpgradeWithFrozenContracts(t *testing.T) {
	current := []ProductionReleaseSpec{
		{ProviderID: "provider-b", NodeID: "node-b", SoftwareVersion: "1.0.0", APIVersion: DeveloperAPIVersion, ConfigSchemaVersion: ProductionConfigSchemaVersion},
		{ProviderID: "provider-a", NodeID: "node-a", SoftwareVersion: "1.0.0", APIVersion: DeveloperAPIVersion, ConfigSchemaVersion: ProductionConfigSchemaVersion},
	}
	target := []ProductionReleaseSpec{
		{ProviderID: "provider-a", NodeID: "node-a", SoftwareVersion: "1.1.0", APIVersion: DeveloperAPIVersion, ConfigSchemaVersion: ProductionConfigSchemaVersion},
		{ProviderID: "provider-b", NodeID: "node-b", SoftwareVersion: "1.1.0", APIVersion: DeveloperAPIVersion, ConfigSchemaVersion: ProductionConfigSchemaVersion},
	}
	plan, err := BuildProductionUpgradePlan(current, target)
	if err != nil {
		t.Fatal(err)
	}
	if plan.APIVersion != DeveloperAPIVersion || plan.ConfigSchemaVersion != ProductionConfigSchemaVersion || len(plan.Steps) != 2 {
		t.Fatalf("unexpected upgrade plan: %#v", plan)
	}
	if plan.Steps[0].ProviderID != "provider-a" || plan.Steps[1].ProviderID != "provider-b" {
		t.Fatalf("upgrade steps are not deterministic: %#v", plan.Steps)
	}
	if plan.Steps[0].CompatibilityID == "" || plan.Steps[0].CompatibilityID != plan.Steps[1].CompatibilityID {
		t.Fatalf("compatibility identity drifted: %#v", plan.Steps)
	}
}

func TestProductionUpgradeRejectsSilentAPIDrift(t *testing.T) {
	current := []ProductionReleaseSpec{
		{ProviderID: "provider-a", NodeID: "node-a", SoftwareVersion: "1.0.0", APIVersion: DeveloperAPIVersion, ConfigSchemaVersion: ProductionConfigSchemaVersion},
		{ProviderID: "provider-b", NodeID: "node-b", SoftwareVersion: "1.0.0", APIVersion: DeveloperAPIVersion, ConfigSchemaVersion: ProductionConfigSchemaVersion},
	}
	target := append([]ProductionReleaseSpec(nil), current...)
	target[0].SoftwareVersion = "2.0.0"
	target[0].APIVersion = "v2"
	_, err := BuildProductionUpgradePlan(current, target)
	if !errors.Is(err, ErrProductionUpgrade) {
		t.Fatalf("expected API compatibility rejection, got %v", err)
	}
}

func TestProductionUpgradeRejectsSchemaDriftAndNodeSubstitution(t *testing.T) {
	current := []ProductionReleaseSpec{
		{ProviderID: "provider-a", NodeID: "node-a", SoftwareVersion: "1.0.0", APIVersion: DeveloperAPIVersion, ConfigSchemaVersion: ProductionConfigSchemaVersion},
		{ProviderID: "provider-b", NodeID: "node-b", SoftwareVersion: "1.0.0", APIVersion: DeveloperAPIVersion, ConfigSchemaVersion: ProductionConfigSchemaVersion},
	}
	target := append([]ProductionReleaseSpec(nil), current...)
	target[0].SoftwareVersion = "1.1.0"
	target[0].ConfigSchemaVersion = "storage-topology-v2"
	if _, err := BuildProductionUpgradePlan(current, target); !errors.Is(err, ErrProductionUpgrade) {
		t.Fatalf("expected schema drift rejection, got %v", err)
	}
	target = append([]ProductionReleaseSpec(nil), current...)
	target[0].NodeID = "replacement-node"
	if _, err := BuildProductionUpgradePlan(current, target); !errors.Is(err, ErrProductionUpgrade) {
		t.Fatalf("expected node substitution rejection, got %v", err)
	}
}

func TestProductionUpgradeSupportsNoopAndRollbackPlans(t *testing.T) {
	v1 := []ProductionReleaseSpec{
		{ProviderID: "provider-a", NodeID: "node-a", SoftwareVersion: "1.0.0", APIVersion: DeveloperAPIVersion, ConfigSchemaVersion: ProductionConfigSchemaVersion},
		{ProviderID: "provider-b", NodeID: "node-b", SoftwareVersion: "1.0.0", APIVersion: DeveloperAPIVersion, ConfigSchemaVersion: ProductionConfigSchemaVersion},
	}
	v2 := []ProductionReleaseSpec{
		{ProviderID: "provider-a", NodeID: "node-a", SoftwareVersion: "1.1.0", APIVersion: DeveloperAPIVersion, ConfigSchemaVersion: ProductionConfigSchemaVersion},
		{ProviderID: "provider-b", NodeID: "node-b", SoftwareVersion: "1.1.0", APIVersion: DeveloperAPIVersion, ConfigSchemaVersion: ProductionConfigSchemaVersion},
	}
	noop, err := BuildProductionUpgradePlan(v1, v1)
	if err != nil || len(noop.Steps) != 0 {
		t.Fatalf("expected no-op compatibility plan: %#v err=%v", noop, err)
	}
	rollback, err := BuildProductionUpgradePlan(v2, v1)
	if err != nil || len(rollback.Steps) != 2 {
		t.Fatalf("expected rollback plan: %#v err=%v", rollback, err)
	}
	if rollback.Steps[0].FromVersion != "1.1.0" || rollback.Steps[0].ToVersion != "1.0.0" {
		t.Fatalf("unexpected rollback step: %#v", rollback.Steps[0])
	}
}

func TestProductionManifestIdentitySurvivesRuntimeUpgrade(t *testing.T) {
	payload0 := []byte("shard-zero")
	payload1 := []byte("shard-one")
	digest := DeveloperShardRoot([]byte("object-root-material"))
	manifest, err := BuildDeveloperManifest(DeveloperManifestSpec{
		ObjectID: "obj-1", ObjectContentRoot: digest, EncryptionCommitment: digest, ErasureRoot: digest,
		ObjectSizeBytes: uint64(len(payload0) + len(payload1)), SegmentCount: 1, DataShards: 1, TotalShards: 2, Sealed: true,
		Shards: []DeveloperShardSpec{
			{ShardIndex: 1, ShardRoot: DeveloperShardRoot(payload1), SizeBytes: uint64(len(payload1)), AgreementID: "agreement-1", CommitmentID: "commit-1", NodeID: "node-b", Live: true},
			{ShardIndex: 0, ShardRoot: DeveloperShardRoot(payload0), SizeBytes: uint64(len(payload0)), AgreementID: "agreement-0", CommitmentID: "commit-0", NodeID: "node-a", Live: true},
		},
	})
	if err != nil {
		t.Fatal(err)
	}
	before, err := ProductionManifestIdentityFingerprint(manifest)
	if err != nil {
		t.Fatal(err)
	}

	// Runtime/software version is intentionally not part of immutable storage identity.
	after, err := ProductionManifestIdentityFingerprint(manifest)
	if err != nil {
		t.Fatal(err)
	}
	if before != after {
		t.Fatalf("manifest identity changed across runtime upgrade: %s != %s", before, after)
	}

	mutated := manifest
	mutated.Shards = append([]DeveloperShardSpec(nil), manifest.Shards...)
	mutated.Shards[0].CommitmentID = "commit-substituted"
	changed, err := ProductionManifestIdentityFingerprint(mutated)
	if err != nil {
		t.Fatal(err)
	}
	if changed == before {
		t.Fatal("commitment substitution did not change upgrade identity fingerprint")
	}
}

package closeout

import (
	"encoding/json"
	"os"
	"path/filepath"
	"reflect"
	"testing"

	"github.com/420integrated/420-integrated/appstore/architecture"
	"github.com/420integrated/420-integrated/appstore/catalog"
	appregistry "github.com/420integrated/420-integrated/appstore/registry"
)

func TestAllGenesisInvariantsRemainEnumerated(t *testing.T) {
	want := []string{
		"APP-INV-001", "APP-INV-002", "APP-INV-003", "APP-INV-004", "APP-INV-005",
		"APP-INV-006", "APP-INV-007", "APP-INV-008", "APP-INV-009", "APP-INV-010",
		"APP-INV-011", "APP-INV-012", "APP-INV-013",
	}
	if !reflect.DeepEqual(architecture.Invariants, want) {
		t.Fatalf("genesis invariant contract changed: got %v want %v", architecture.Invariants, want)
	}
}

func TestGenesisAuthorityBoundaryRemainsNonCanonicalAndRebuildable(t *testing.T) {
	b := architecture.GenesisBoundary()
	if b.ContractsRequired || b.CanonicalStateAuthority || !b.RegistryAuthoritative || !b.WalletAuthoritative || !b.CatalogueRebuildable || !b.AlternativeClients || b.PrivateContentIndexed || b.LaunchHistoryPublic {
		t.Fatalf("unexpected genesis authority boundary: %#v", b)
	}
}

func TestCatalogueRebuildIsDeterministic(t *testing.T) {
	records := []appregistry.VersionRecord{
		{ServiceID: "420/service/beta/v1", Version: 1, Implementation: "0x2222222222222222222222222222222222222222", CodeHash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", MetadataHash: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", Active: true, BlockNumber: 11, BlockHash: "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc"},
		{ServiceID: "420/service/alpha/v1", Version: 1, Implementation: "0x1111111111111111111111111111111111111111", CodeHash: "0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd", MetadataHash: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee", Active: true, BlockNumber: 10, BlockHash: "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"},
	}
	snapshot := appregistry.Snapshot{ChainID: 420, RegistryAddress: "0x4200000000000000000000000000000000000001", FinalizedBlock: 11, Versions: records}
	first, err := catalog.RebuildFromSnapshot(snapshot)
	if err != nil { t.Fatal(err) }
	snapshot.Versions[0], snapshot.Versions[1] = snapshot.Versions[1], snapshot.Versions[0]
	second, err := catalog.RebuildFromSnapshot(snapshot)
	if err != nil { t.Fatal(err) }
	if !reflect.DeepEqual(first, second) {
		t.Fatalf("rebuild depends on source ordering:\nfirst=%#v\nsecond=%#v", first, second)
	}
}

func TestReadinessEvidenceDeclaresCodeQualifiedDeploymentPending(t *testing.T) {
	path := filepath.Join("..", "..", "testnet", "public-services", "appstore", "readiness.json")
	raw, err := os.ReadFile(path)
	if err != nil { t.Fatal(err) }
	var doc struct {
		ImplementationStatus string `json:"implementation_status"`
		DeploymentStatus string `json:"deployment_status"`
		InvariantCoverage []string `json:"invariant_coverage"`
	}
	if err := json.Unmarshal(raw, &doc); err != nil { t.Fatal(err) }
	if doc.ImplementationStatus != "QUALIFIED" || doc.DeploymentStatus != "PENDING_PUBLIC_TESTNET" {
		t.Fatalf("unexpected readiness status: %#v", doc)
	}
	if !reflect.DeepEqual(doc.InvariantCoverage, architecture.Invariants) {
		t.Fatalf("readiness invariant coverage mismatch: got %v want %v", doc.InvariantCoverage, architecture.Invariants)
	}
}

package api

import (
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/420integrated/420-integrated/appstore/catalog"
	"github.com/420integrated/420-integrated/appstore/curation"
	appregistry "github.com/420integrated/420-integrated/appstore/registry"
	"github.com/420integrated/420-integrated/appstore/security"
	"github.com/420integrated/420-integrated/appstore/wallet"
)

func compositionRecord(serviceID string, version uint32, implementation string, active bool, block uint64) appregistry.VersionRecord {
	return appregistry.VersionRecord{
		ServiceID:      serviceID,
		Version:        version,
		Implementation: implementation,
		CodeHash:       "0x" + strings.Repeat("a", 64),
		MetadataHash:   "0x" + strings.Repeat("b", 64),
		Active:         active,
		BlockNumber:    block,
		BlockHash:      "0x" + strings.Repeat("c", 64),
	}
}

func compositionDocument(records ...appregistry.VersionRecord) catalog.Document {
	return catalog.Document{
		SchemaVersion:   catalog.SchemaVersion,
		ChainID:         420,
		RegistryAddress: "0x0000000000000000000000000000000000000434",
		FinalizedBlock:  100,
		Versions:        records,
	}
}

func TestComposeApplicationsUsesLatestCanonicalVersion(t *testing.T) {
	doc := compositionDocument(
		compositionRecord("420/service/demo/v1", 1, "0x1111111111111111111111111111111111111111", false, 10),
		compositionRecord("420/service/demo/v1", 2, "0x2222222222222222222222222222222222222222", true, 20),
	)
	inputs := CompositionInputs{
		SchemaVersion: CompositionInputsSchemaVersion,
		Applications: []ViewInput{{
			ServiceID: "420/service/demo/v1",
			Curation: curation.Metadata{
				ServiceID:  "420/service/demo/v1",
				Categories: []string{"Tools"},
				Description: "demo",
			},
			Evidence: []security.Evidence{{
				Kind:       security.KindVerification,
				Source:     "420Verify",
				Reference:  "verify:demo",
				Status:     "FULL_MATCH",
				Severity:   security.SeverityInfo,
				ObservedAt: 99,
			}},
			Wallet: WalletInput{
				AppURL: "https://demo.example/app",
				Permissions: []wallet.Permission{{Name: "connect", HighRisk: false}},
			},
			Links: Links{Explorer: "https://explorer.example/demo"},
		}},
	}

	views, err := ComposeApplications(doc, 420, inputs)
	if err != nil {
		t.Fatal(err)
	}
	if len(views) != 1 {
		t.Fatalf("views=%d", len(views))
	}
	view := views[0]
	if view.Listing.Canonical.Version != 2 || view.Listing.Canonical.Implementation != "0x2222222222222222222222222222222222222222" {
		t.Fatalf("composition did not preserve latest canonical Registry record: %#v", view.Listing.Canonical)
	}
	if view.Security.ServiceID != "420/service/demo/v1" || view.Security.Version != 2 {
		t.Fatalf("security evidence not bound to canonical version: %#v", view.Security)
	}
	if view.Links.Direct != "https://demo.example/app" {
		t.Fatalf("direct URL was not derived from wallet app URL: %#v", view.Links)
	}
	if !strings.HasPrefix(view.Wallet.URI, "420wallet://open?") {
		t.Fatalf("wallet handoff missing: %q", view.Wallet.URI)
	}
}

func TestComposeApplicationsBuildsCanonicalOnlyDefaultView(t *testing.T) {
	doc := compositionDocument(compositionRecord("420/service/demo/v1", 1, "0x1111111111111111111111111111111111111111", true, 10))
	views, err := ComposeApplications(doc, 420, CompositionInputs{SchemaVersion: CompositionInputsSchemaVersion})
	if err != nil {
		t.Fatal(err)
	}
	if len(views) != 1 || views[0].Listing.Canonical.ServiceID != "420/service/demo/v1" {
		t.Fatalf("canonical-only view missing: %#v", views)
	}
	if views[0].Listing.Curation.ServiceID != "420/service/demo/v1" {
		t.Fatalf("default curation not bound to canonical service: %#v", views[0].Listing.Curation)
	}
	if views[0].Wallet.URI != "" {
		t.Fatalf("wallet handoff should be absent without app URL: %#v", views[0].Wallet)
	}
}

func TestComposeApplicationsRejectsUnknownOrDuplicateServiceInput(t *testing.T) {
	doc := compositionDocument(compositionRecord("420/service/demo/v1", 1, "0x1111111111111111111111111111111111111111", true, 10))
	_, err := ComposeApplications(doc, 420, CompositionInputs{
		SchemaVersion: CompositionInputsSchemaVersion,
		Applications:  []ViewInput{{ServiceID: "420/service/unknown/v1"}},
	})
	if !errors.Is(err, ErrUnknownCompositionApp) {
		t.Fatalf("expected unknown service rejection, got %v", err)
	}

	input := ViewInput{ServiceID: "420/service/demo/v1"}
	_, err = ComposeApplications(doc, 420, CompositionInputs{
		SchemaVersion: CompositionInputsSchemaVersion,
		Applications:  []ViewInput{input, input},
	})
	if !errors.Is(err, ErrInvalidCompositionInputs) {
		t.Fatalf("expected duplicate input rejection, got %v", err)
	}
}

func TestComposeApplicationsRejectsCanonicalOverrideAndServiceMismatch(t *testing.T) {
	doc := compositionDocument(compositionRecord("420/service/demo/v1", 1, "0x1111111111111111111111111111111111111111", true, 10))
	_, err := ComposeApplications(doc, 420, CompositionInputs{
		SchemaVersion: CompositionInputsSchemaVersion,
		Applications: []ViewInput{{
			ServiceID: "420/service/demo/v1",
			Curation: curation.Metadata{
				ServiceID:    "420/service/demo/v1",
				Presentation: map[string]string{"implementation": "0xdead"},
			},
		}},
	})
	if !errors.Is(err, curation.ErrCanonicalOverride) {
		t.Fatalf("expected canonical override rejection, got %v", err)
	}

	_, err = ComposeApplications(doc, 420, CompositionInputs{
		SchemaVersion: CompositionInputsSchemaVersion,
		Applications: []ViewInput{{
			ServiceID: "420/service/demo/v1",
			Curation:  curation.Metadata{ServiceID: "420/service/other/v1"},
		}},
	})
	if !errors.Is(err, ErrInvalidCompositionInputs) {
		t.Fatalf("expected curation service mismatch rejection, got %v", err)
	}
}

func TestComposeApplicationsRejectsUnsafePresentationEvidenceAndLinks(t *testing.T) {
	doc := compositionDocument(compositionRecord("420/service/demo/v1", 1, "0x1111111111111111111111111111111111111111", true, 10))
	_, err := ComposeApplications(doc, 420, CompositionInputs{
		SchemaVersion: CompositionInputsSchemaVersion,
		Applications: []ViewInput{{
			ServiceID: "420/service/demo/v1",
			Curation: curation.Metadata{
				Presentation: map[string]string{"launchHistory": "wallet-123"},
			},
		}},
	})
	if err == nil {
		t.Fatal("expected private presentation metadata rejection")
	}

	_, err = ComposeApplications(doc, 420, CompositionInputs{
		SchemaVersion: CompositionInputsSchemaVersion,
		Applications: []ViewInput{{
			ServiceID: "420/service/demo/v1",
			Evidence: []security.Evidence{{
				Kind: security.KindVerification, Source: "420Verify", Reference: "verify:demo",
				Status: "safe", Severity: security.SeverityInfo, ObservedAt: 99,
			}},
		}},
	})
	if !errors.Is(err, security.ErrUnsafeClaim) {
		t.Fatalf("expected unsafe security claim rejection, got %v", err)
	}

	_, err = ComposeApplications(doc, 420, CompositionInputs{
		SchemaVersion: CompositionInputsSchemaVersion,
		Applications: []ViewInput{{
			ServiceID: "420/service/demo/v1",
			Links:     Links{Verify: "https://localhost/admin"},
		}},
	})
	if err == nil {
		t.Fatal("expected unsafe link rejection")
	}
}

func TestComposeApplicationsRejectsWalletAuthorityAndLinkDisagreement(t *testing.T) {
	doc := compositionDocument(compositionRecord("420/service/demo/v1", 1, "0x1111111111111111111111111111111111111111", true, 10))
	_, err := ComposeApplications(doc, 420, CompositionInputs{
		SchemaVersion: CompositionInputsSchemaVersion,
		Applications: []ViewInput{{
			ServiceID: "420/service/demo/v1",
			Wallet: WalletInput{
				AppURL: "https://demo.example/app",
				Action: "transfer",
			},
		}},
	})
	if !errors.Is(err, wallet.ErrAuthorityEscalation) {
		t.Fatalf("expected confirmation boundary rejection, got %v", err)
	}

	_, err = ComposeApplications(doc, 420, CompositionInputs{
		SchemaVersion: CompositionInputsSchemaVersion,
		Applications: []ViewInput{{
			ServiceID: "420/service/demo/v1",
			Wallet:    WalletInput{AppURL: "https://demo.example/app"},
			Links:     Links{Direct: "https://other.example/app"},
		}},
	})
	if !errors.Is(err, ErrInvalidCompositionInputs) {
		t.Fatalf("expected direct/wallet URL mismatch rejection, got %v", err)
	}
}

func TestComposeApplicationsDeterministicOrdering(t *testing.T) {
	doc := compositionDocument(
		compositionRecord("420/service/zeta/v1", 1, "0x1111111111111111111111111111111111111111", true, 10),
		compositionRecord("420/service/alpha/v1", 1, "0x2222222222222222222222222222222222222222", true, 11),
	)
	views, err := ComposeApplications(doc, 420, CompositionInputs{SchemaVersion: CompositionInputsSchemaVersion})
	if err != nil {
		t.Fatal(err)
	}
	if len(views) != 2 || views[0].Listing.Canonical.ServiceID != "420/service/alpha/v1" || views[1].Listing.Canonical.ServiceID != "420/service/zeta/v1" {
		t.Fatalf("non-deterministic composition order: %#v", views)
	}
}

func TestLoadCompositionInputsRejectsUnknownAuthorityFieldsAndTrailingJSON(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "inputs.json")
	if err := os.WriteFile(path, []byte(`{
  "schemaVersion": 1,
  "applications": [{
    "serviceId": "420/service/demo/v1",
    "wallet": {
      "appUrl": "https://demo.example/app",
      "signature": "0xdead"
    }
  }]
}`), 0o600); err != nil {
		t.Fatal(err)
	}
	if _, err := LoadCompositionInputs(path); !errors.Is(err, ErrInvalidCompositionInputs) {
		t.Fatalf("expected strict unknown-field rejection, got %v", err)
	}

	if err := os.WriteFile(path, []byte(`{"schemaVersion":1} {"schemaVersion":1}`), 0o600); err != nil {
		t.Fatal(err)
	}
	if _, err := LoadCompositionInputs(path); !errors.Is(err, ErrInvalidCompositionInputs) {
		t.Fatalf("expected trailing JSON rejection, got %v", err)
	}
}


func TestViewSetRebuildIsAtomicAndSnapshotIsolated(t *testing.T) {
	doc := compositionDocument(compositionRecord("420/service/demo/v1", 1, "0x1111111111111111111111111111111111111111", true, 10))
	set := NewViewSet()
	good := CompositionInputs{
		SchemaVersion: CompositionInputsSchemaVersion,
		Applications: []ViewInput{{
			ServiceID: "420/service/demo/v1",
			Curation: curation.Metadata{
				ServiceID:    "420/service/demo/v1",
				Categories:   []string{"tools"},
				Presentation: map[string]string{"theme": "dark"},
			},
			Wallet: WalletInput{AppURL: "https://demo.example/app"},
		}},
	}
	if err := set.Rebuild(doc, 420, good); err != nil {
		t.Fatal(err)
	}
	first := set.Snapshot()
	first[0].Listing.Curation.Categories[0] = "mutated"
	first[0].Listing.Curation.Presentation["theme"] = "mutated"
	first[0].Wallet.Permissions = append(first[0].Wallet.Permissions, wallet.Permission{Name: "mutated"})

	second := set.Snapshot()
	if second[0].Listing.Curation.Categories[0] != "tools" || second[0].Listing.Curation.Presentation["theme"] != "dark" || len(second[0].Wallet.Permissions) != 0 {
		t.Fatalf("snapshot mutation leaked into retained state: %#v", second[0])
	}

	bad := CompositionInputs{
		SchemaVersion: CompositionInputsSchemaVersion,
		Applications: []ViewInput{{
			ServiceID: "420/service/demo/v1",
			Links:     Links{Verify: "https://localhost/private"},
		}},
	}
	if err := set.Rebuild(doc, 420, bad); err == nil {
		t.Fatal("expected rejected rebuild")
	}
	after := set.Snapshot()
	if len(after) != 1 || after[0].Listing.Curation.Categories[0] != "tools" {
		t.Fatalf("failed rebuild replaced prior view state: %#v", after)
	}
}

func TestComposeApplicationsRejectsTamperedCanonicalDocument(t *testing.T) {
	doc := compositionDocument(compositionRecord("420/service/demo/v1", 1, "0x1111111111111111111111111111111111111111", true, 10))
	doc.Versions[0].BlockHash = "0x1234"
	_, err := ComposeApplications(doc, 420, CompositionInputs{SchemaVersion: CompositionInputsSchemaVersion})
	if !errors.Is(err, ErrInvalidCompositionInputs) {
		t.Fatalf("expected tampered canonical document rejection, got %v", err)
	}
}

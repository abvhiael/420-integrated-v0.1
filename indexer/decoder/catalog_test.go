package decoder

import (
	"errors"
	"testing"
)

func TestCatalogResolvesHistoricalImplementationVersion(t *testing.T) {
	c := NewCatalog()
	if err := c.ApplyVersion(VersionPublished{ServiceID: "swap", Version: 1, Implementation: "0xAbC", CodeHash: "0x01", Active: true, BlockNumber: 10, BlockHash: "0xaa"}); err != nil { t.Fatal(err) }
	if err := c.ApplyProfile(ProfilePublished{ServiceID: "swap", Version: 1, ComponentType: 1, ManifestHash: "0x11", InterfaceHash: "0x22"}); err != nil { t.Fatal(err) }
	if err := c.ApplyVersion(VersionPublished{ServiceID: "swap", Version: 2, Implementation: "0xDef", CodeHash: "0x02", Active: true, BlockNumber: 20, BlockHash: "0xbb"}); err != nil { t.Fatal(err) }

	v1, err := c.ResolveImplementationAt("0xabc", 15)
	if err != nil { t.Fatal(err) }
	if v1.Version != 1 || v1.InterfaceHash != "0x22" { t.Fatalf("unexpected v1: %+v", v1) }
	v2, err := c.ResolveImplementationAt("0xdef", 25)
	if err != nil { t.Fatal(err) }
	if v2.Version != 2 { t.Fatalf("want version 2 got %d", v2.Version) }
}

func TestCatalogDoesNotFallAcrossDeprecation(t *testing.T) {
	c := NewCatalog()
	if err := c.ApplyVersion(VersionPublished{ServiceID: "bridge", Version: 1, Implementation: "0x111", Active: true, BlockNumber: 10, BlockHash: "0xaa"}); err != nil { t.Fatal(err) }
	if err := c.ApplyDeprecated("bridge", 1, 30); err != nil { t.Fatal(err) }
	if _, err := c.ResolveImplementationAt("0x111", 30); !errors.Is(err, ErrUnknownImplementation) {
		t.Fatalf("expected deprecated implementation rejection, got %v", err)
	}
	if _, err := c.ResolveImplementationAt("0x111", 29); err != nil { t.Fatalf("pre-deprecation history must remain resolvable: %v", err) }
}

func TestCatalogRejectsVersionGap(t *testing.T) {
	c := NewCatalog()
	err := c.ApplyVersion(VersionPublished{ServiceID: "ai", Version: 2, Implementation: "0x222", Active: true, BlockNumber: 1, BlockHash: "0xaa"})
	if !errors.Is(err, ErrInvalidVersionHistory) { t.Fatalf("expected invalid history, got %v", err) }
}

func TestCatalogReplayIsIdempotentButConflictingReplayFails(t *testing.T) {
	c := NewCatalog()
	ev := VersionPublished{ServiceID: "token", Version: 1, Implementation: "0x333", Active: true, BlockNumber: 5, BlockHash: "0xaa"}
	if err := c.ApplyVersion(ev); err != nil { t.Fatal(err) }
	if err := c.ApplyVersion(ev); err != nil { t.Fatalf("idempotent replay failed: %v", err) }
	ev.BlockHash = "0xbb"
	if err := c.ApplyVersion(ev); !errors.Is(err, ErrInvalidVersionHistory) { t.Fatalf("expected conflicting replay rejection, got %v", err) }
}

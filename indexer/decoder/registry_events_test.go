package decoder

import "testing"

func TestApplyRegistryEventBuildsVersionAndProfile(t *testing.T) {
	c := NewCatalog()
	if err := c.ApplyRegistryEvent(RegistryEvent{Kind: RegistryEventVersionPublished, ServiceID: "registry", Version: 1, Implementation: "0x420", CodeHash: "0x01", Active: true, BlockNumber: 7, BlockHash: "0x07"}); err != nil { t.Fatal(err) }
	if err := c.ApplyRegistryEvent(RegistryEvent{Kind: RegistryEventProfilePublished, ServiceID: "registry", Version: 1, ComponentType: 4, ManifestHash: "0x11", DependencyRoot: "0x22", InterfaceHash: "0x33"}); err != nil { t.Fatal(err) }
	record, err := c.Version("registry", 1)
	if err != nil { t.Fatal(err) }
	if record.Implementation != "0x420" || record.InterfaceHash != "0x33" || record.ActivatedBlock != 7 { t.Fatalf("unexpected registry projection: %+v", record) }
}

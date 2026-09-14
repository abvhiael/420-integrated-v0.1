package decoder

import (
	"errors"
	"testing"

	"github.com/420integrated/420-integrated/indexer/model"
)

type testDecoder struct{ version string }
func (d testDecoder) Version() string { return d.version }
func (d testDecoder) Decode(address string, topics []string, data string) (any, error) {
	return map[string]any{"address": address, "data": data}, nil
}

func TestDispatcherPinsHistoricalDecoder(t *testing.T) {
	catalog := NewCatalog()
	if err := catalog.ApplyVersion(VersionPublished{ServiceID: "swap", Version: 1, Implementation: "0xaaa", Active: true, BlockNumber: 10, BlockHash: "0x10"}); err != nil { t.Fatal(err) }
	if err := catalog.ApplyVersion(VersionPublished{ServiceID: "swap", Version: 2, Implementation: "0xbbb", Active: true, BlockNumber: 20, BlockHash: "0x20"}); err != nil { t.Fatal(err) }
	registry := NewRegistry()
	registry.Register("swap", "1", testDecoder{version: "swap-decoder-v1"})
	registry.Register("swap", "2", testDecoder{version: "swap-decoder-v2"})
	d := NewDispatcher(catalog, registry)

	old, err := d.Decode(model.LogRecord{BlockNumber: 15, Address: "0xAAA", Data: "0x01"})
	if err != nil { t.Fatal(err) }
	if old.Service.Version != 1 || old.Decoder != "swap-decoder-v1" { t.Fatalf("historical decoder drifted: %+v", old) }
	current, err := d.Decode(model.LogRecord{BlockNumber: 25, Address: "0xbbb", Data: "0x02"})
	if err != nil { t.Fatal(err) }
	if current.Service.Version != 2 || current.Decoder != "swap-decoder-v2" { t.Fatalf("unexpected current decode: %+v", current) }
}

func TestDispatcherNeverFallsForwardWhenHistoricalDecoderMissing(t *testing.T) {
	catalog := NewCatalog()
	if err := catalog.ApplyVersion(VersionPublished{ServiceID: "bridge", Version: 1, Implementation: "0xaaa", Active: true, BlockNumber: 10, BlockHash: "0x10"}); err != nil { t.Fatal(err) }
	if err := catalog.ApplyVersion(VersionPublished{ServiceID: "bridge", Version: 2, Implementation: "0xbbb", Active: true, BlockNumber: 20, BlockHash: "0x20"}); err != nil { t.Fatal(err) }
	registry := NewRegistry()
	registry.Register("bridge", "2", testDecoder{version: "bridge-v2"})
	_, err := NewDispatcher(catalog, registry).Decode(model.LogRecord{BlockNumber: 15, Address: "0xaaa"})
	if !errors.Is(err, ErrDecoderNotFound) { t.Fatalf("expected fail-closed missing historical decoder, got %v", err) }
}

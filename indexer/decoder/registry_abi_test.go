package decoder

import (
	"strings"
	"testing"

	"github.com/420integrated/420-integrated/indexer/model"
)

func topicWord(hexTail string) string { return "0x" + strings.Repeat("0", 64-len(hexTail)) + hexTail }
func dataWords(words ...string) string { return "0x" + strings.Join(words, "") }
func padWord(hexTail string) string { return strings.Repeat("0", 64-len(hexTail)) + hexTail }

func TestRegistryABIDecoderVersionPublished(t *testing.T) {
	d := NewRegistryABIDecoder(RegistryTopics{VersionPublished: "0xaaa", ProfilePublished: "0xbbb", Deprecated: "0xccc"})
	log := model.LogRecord{
		BlockNumber: 42, BlockHash: "0x42",
		Topics: []string{"0xaaa", topicWord("11"), topicWord("02"), topicWord("1234567890abcdef1234567890abcdef12345678")},
		Data: dataWords(padWord("22"), padWord("33"), padWord("01")),
	}
	ev, err := d.Decode(log)
	if err != nil { t.Fatal(err) }
	if ev.Kind != RegistryEventVersionPublished || ev.Version != 2 || !ev.Active || ev.BlockNumber != 42 { t.Fatalf("unexpected event: %+v", ev) }
	if ev.Implementation != "0x1234567890abcdef1234567890abcdef12345678" { t.Fatalf("unexpected implementation: %s", ev.Implementation) }
}

func TestRegistryABIDecoderProfilePublished(t *testing.T) {
	d := NewRegistryABIDecoder(RegistryTopics{VersionPublished: "0xaaa", ProfilePublished: "0xbbb", Deprecated: "0xccc"})
	log := model.LogRecord{
		BlockNumber: 43, BlockHash: "0x43",
		Topics: []string{"0xbbb", topicWord("11"), topicWord("02")},
		Data: dataWords(padWord("04"), padWord("44"), padWord("55"), padWord("66")),
	}
	ev, err := d.Decode(log)
	if err != nil { t.Fatal(err) }
	if ev.Kind != RegistryEventProfilePublished || ev.Version != 2 || ev.ComponentType != 4 || ev.InterfaceHash != topicWord("66") { t.Fatalf("unexpected event: %+v", ev) }
}

func TestRegistryABIDecoderDeprecatedAndApply(t *testing.T) {
	d := NewRegistryABIDecoder(RegistryTopics{VersionPublished: "0xaaa", ProfilePublished: "0xbbb", Deprecated: "0xccc"})
	c := NewCatalog()
	service := topicWord("11")
	pub := model.LogRecord{BlockNumber: 10, BlockHash: "0x10", Topics: []string{"0xaaa", service, topicWord("01"), topicWord("1234567890abcdef1234567890abcdef12345678")}, Data: dataWords(padWord("22"), padWord("33"), padWord("01"))}
	if err := d.DecodeAndApply(c, pub); err != nil { t.Fatal(err) }
	dep := model.LogRecord{BlockNumber: 20, BlockHash: "0x20", Topics: []string{"0xccc", service, topicWord("01")}, Data: "0x"}
	if err := d.DecodeAndApply(c, dep); err != nil { t.Fatal(err) }
	record, err := c.Version(service, 1)
	if err != nil { t.Fatal(err) }
	if record.Active || record.DeprecatedBlock != 20 { t.Fatalf("expected deprecated record: %+v", record) }
}

func TestRegistryABIDecoderRejectsUnknownAndMalformed(t *testing.T) {
	d := NewRegistryABIDecoder(RegistryTopics{VersionPublished: "0xaaa", ProfilePublished: "0xbbb", Deprecated: "0xccc"})
	if _, err := d.Decode(model.LogRecord{Topics: []string{"0xddd"}}); err != ErrUnknownRegistryEvent { t.Fatalf("expected unknown event, got %v", err) }
	if _, err := d.Decode(model.LogRecord{Topics: []string{"0xaaa"}, Data: "0x"}); err != ErrMalformedRegistryLog { t.Fatalf("expected malformed event, got %v", err) }
}

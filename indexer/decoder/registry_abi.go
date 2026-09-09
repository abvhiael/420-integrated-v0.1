package decoder

import (
	"encoding/hex"
	"errors"
	"fmt"
	"strconv"
	"strings"

	"github.com/420integrated/420-integrated/indexer/model"
)

var ErrMalformedRegistryLog = errors.New("malformed protocol registry log")

// RegistryTopics pins the canonical ProtocolRegistry event topic0 values for a deployment.
// Keeping these explicit avoids coupling the indexer to a specific ABI library while still
// requiring exact event identity before decoding raw logs.
type RegistryTopics struct {
	VersionPublished string
	ProfilePublished string
	Deprecated       string
}

type RegistryABIDecoder struct {
	topics RegistryTopics
}

func NewRegistryABIDecoder(topics RegistryTopics) *RegistryABIDecoder {
	return &RegistryABIDecoder{topics: RegistryTopics{
		VersionPublished: strings.ToLower(topics.VersionPublished),
		ProfilePublished: strings.ToLower(topics.ProfilePublished),
		Deprecated:       strings.ToLower(topics.Deprecated),
	}}
}

func (d *RegistryABIDecoder) Decode(log model.LogRecord) (RegistryEvent, error) {
	if len(log.Topics) == 0 { return RegistryEvent{}, ErrUnknownRegistryEvent }
	topic0 := strings.ToLower(log.Topics[0])
	switch topic0 {
	case d.topics.VersionPublished:
		return decodeVersionPublished(log)
	case d.topics.ProfilePublished:
		return decodeProfilePublished(log)
	case d.topics.Deprecated:
		return decodeDeprecated(log)
	default:
		return RegistryEvent{}, ErrUnknownRegistryEvent
	}
}

func (d *RegistryABIDecoder) DecodeAndApply(c *Catalog, log model.LogRecord) error {
	ev, err := d.Decode(log)
	if err != nil { return err }
	return c.ApplyRegistryEvent(ev)
}

func decodeVersionPublished(log model.LogRecord) (RegistryEvent, error) {
	if len(log.Topics) != 4 { return RegistryEvent{}, ErrMalformedRegistryLog }
	words, err := abiWords(log.Data)
	if err != nil || len(words) != 3 { return RegistryEvent{}, ErrMalformedRegistryLog }
	version, err := uint32Topic(log.Topics[2]); if err != nil { return RegistryEvent{}, err }
	active, err := boolWord(words[2]); if err != nil { return RegistryEvent{}, err }
	return RegistryEvent{
		Kind: RegistryEventVersionPublished,
		ServiceID: normalizeWord(log.Topics[1]), Version: version,
		Implementation: addressFromTopic(log.Topics[3]),
		CodeHash: wordHex(words[0]), MetadataHash: wordHex(words[1]), Active: active,
		BlockNumber: log.BlockNumber, BlockHash: log.BlockHash,
	}, nil
}

func decodeProfilePublished(log model.LogRecord) (RegistryEvent, error) {
	if len(log.Topics) != 3 { return RegistryEvent{}, ErrMalformedRegistryLog }
	words, err := abiWords(log.Data)
	if err != nil || len(words) != 4 { return RegistryEvent{}, ErrMalformedRegistryLog }
	version, err := uint32Topic(log.Topics[2]); if err != nil { return RegistryEvent{}, err }
	component, err := uint8Word(words[0]); if err != nil { return RegistryEvent{}, err }
	return RegistryEvent{
		Kind: RegistryEventProfilePublished,
		ServiceID: normalizeWord(log.Topics[1]), Version: version, ComponentType: component,
		ManifestHash: wordHex(words[1]), DependencyRoot: wordHex(words[2]), InterfaceHash: wordHex(words[3]),
		BlockNumber: log.BlockNumber, BlockHash: log.BlockHash,
	}, nil
}

func decodeDeprecated(log model.LogRecord) (RegistryEvent, error) {
	if len(log.Topics) != 3 { return RegistryEvent{}, ErrMalformedRegistryLog }
	if strings.TrimPrefix(log.Data, "0x") != "" { return RegistryEvent{}, ErrMalformedRegistryLog }
	version, err := uint32Topic(log.Topics[2]); if err != nil { return RegistryEvent{}, err }
	return RegistryEvent{
		Kind: RegistryEventDeprecated, ServiceID: normalizeWord(log.Topics[1]), Version: version,
		BlockNumber: log.BlockNumber, BlockHash: log.BlockHash,
	}, nil
}

func abiWords(data string) ([][]byte, error) {
	raw := strings.TrimPrefix(data, "0x")
	if len(raw)%64 != 0 { return nil, ErrMalformedRegistryLog }
	if raw == "" { return nil, nil }
	b, err := hex.DecodeString(raw); if err != nil { return nil, err }
	out := make([][]byte, 0, len(b)/32)
	for i := 0; i < len(b); i += 32 { out = append(out, b[i:i+32]) }
	return out, nil
}

func normalizeWord(v string) string {
	raw := strings.ToLower(strings.TrimPrefix(v, "0x"))
	return "0x" + fmt.Sprintf("%064s", raw)
}

func wordHex(v []byte) string { return "0x" + hex.EncodeToString(v) }

func addressFromTopic(v string) string {
	raw := strings.ToLower(strings.TrimPrefix(v, "0x"))
	if len(raw) > 40 { raw = raw[len(raw)-40:] }
	return "0x" + fmt.Sprintf("%040s", raw)
}

func uint32Topic(v string) (uint32, error) {
	raw := strings.TrimPrefix(v, "0x")
	if len(raw) > 8 { raw = raw[len(raw)-8:] }
	n, err := strconv.ParseUint(raw, 16, 32)
	return uint32(n), err
}

func uint8Word(v []byte) (uint8, error) {
	for _, b := range v[:31] { if b != 0 { return 0, ErrMalformedRegistryLog } }
	return v[31], nil
}

func boolWord(v []byte) (bool, error) {
	for _, b := range v[:31] { if b != 0 { return false, ErrMalformedRegistryLog } }
	switch v[31] { case 0: return false, nil; case 1: return true, nil; default: return false, ErrMalformedRegistryLog }
}

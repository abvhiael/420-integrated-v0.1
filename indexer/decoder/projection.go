package decoder

import (
	"fmt"
	"strings"

	"github.com/420integrated/420-integrated/indexer/model"
)

const ProtocolRegistryCanonicalAddress420 = "0x0000000000000000000000000000000000000434"

var protocolRegistryTopics420 = RegistryTopics{
	VersionPublished: "0x19aa152c2c4c6794d89883e0808ea2365e3f6d5267840423debc9b08db5b3608",
	ProfilePublished: "0x19af5a8b78ed7364ffacb8ddf22ac42f4bb67c6d9532cb2b7504781867c550d9",
	Deprecated:       "0x63e20a29800a0d1cec5ae14b6dfceb2bc5cbfd523b7225bc649d3819c0f8780a",
}

type RegistryProjectionStore420 interface {
	Checkpoint() (model.ChainCheckpoint, bool, error)
	Block(uint64) (model.BlockRecord, bool, error)
	LogsByBlock(uint64) ([]model.LogRecord, error)
}

func ProtocolRegistryTopics420() RegistryTopics { return protocolRegistryTopics420 }

func trackedProtocolRegistryTopic420(topic string) bool {
	topic = strings.ToLower(strings.TrimSpace(topic))
	return topic == protocolRegistryTopics420.VersionPublished ||
		topic == protocolRegistryTopics420.ProfilePublished ||
		topic == protocolRegistryTopics420.Deprecated
}

// RebuildProtocolRegistryCatalog420 deterministically reconstructs the non-authoritative
// Registry projection from the store's current canonical indexed history. Rebuilding from
// canonical logs makes non-finalized rollback/replay naturally discard orphaned Registry events.
func RebuildProtocolRegistryCatalog420(store RegistryProjectionStore420) (*Catalog, error) {
	if store == nil { return nil, fmt.Errorf("registry projection store required") }
	cp, ok, err := store.Checkpoint()
	if err != nil { return nil, err }
	if !ok { return NewCatalog(), nil }
	if cp.ChainID == 0 || cp.IndexedHash == "" { return nil, fmt.Errorf("invalid registry projection checkpoint") }

	catalog := NewCatalog()
	decoder := NewRegistryABIDecoder(protocolRegistryTopics420)
	for height := uint64(0); height <= cp.IndexedHeight; height++ {
		block, found, err := store.Block(height)
		if err != nil { return nil, fmt.Errorf("registry projection block %d: %w", height, err) }
		if !found { return nil, fmt.Errorf("registry projection block %d missing", height) }
		if block.ChainID != cp.ChainID || block.Number != height || block.Hash == "" {
			return nil, fmt.Errorf("registry projection block %d provenance mismatch", height)
		}
		logs, err := store.LogsByBlock(height)
		if err != nil { return nil, fmt.Errorf("registry projection logs %d: %w", height, err) }
		for _, log := range logs {
			if !strings.EqualFold(log.Address, ProtocolRegistryCanonicalAddress420) { continue }
			if log.ChainID != cp.ChainID || log.BlockNumber != height || !strings.EqualFold(log.BlockHash, block.Hash) {
				return nil, fmt.Errorf("registry projection log provenance mismatch at block %d", height)
			}
			if len(log.Topics) == 0 || !trackedProtocolRegistryTopic420(log.Topics[0]) {
				// ProtocolRegistry emits other component/approval events that do not belong
				// to the service catalogue projection.
				continue
			}
			if err := decoder.DecodeAndApply(catalog, log); err != nil {
				return nil, fmt.Errorf("registry projection decode block %d log %d: %w", height, log.LogIndex, err)
			}
		}
	}
	return catalog, nil
}

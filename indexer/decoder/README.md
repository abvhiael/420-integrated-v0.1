# 420Indexer decoder boundary

420Indexer decoders are historical interpretation helpers only.

- 420Registry / ProtocolRegistry remains authoritative for registered service identity and implementation/version references.
- Decoder registration inside the indexer does not activate, deactivate, endorse or upgrade a protocol service.
- ProtocolRegistry `ServiceVersionPublished`, `ServiceRegistrationProfilePublished` and `ServiceDeprecated` events are projected into a rebuildable historical catalogue.
- Each catalogue record preserves service ID, implementation, version, code hash, metadata hash, manifest/interface commitments and activation provenance when available.
- Decoder dispatch resolves the implementation at the log's block height before choosing a decoder.
- Unknown protocol versions fail closed rather than being decoded using an incompatible schema.
- A missing historical decoder never falls forward to the latest decoder.
- Historical decoder versions remain available so past events can be reproduced after protocol upgrades.
- Decoded projections retain their source block/log provenance, registry service/version identity and decoder version.
- The catalogue is non-authoritative and may be discarded/rebuilt from canonical ProtocolRegistry events.

## GEN-11.1D resolution flow

`ProtocolRegistry events -> Catalog -> implementation@block resolution -> exact service/version -> Decoder Registry -> decoded projection`

This makes upgrades explicit and preserves historical reproducibility. Current-version lookup alone is insufficient because old logs must remain bound to the contract version and interface that emitted them.

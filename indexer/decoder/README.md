# 420Indexer decoder boundary

420Indexer decoders are historical interpretation helpers only.

- 420Registry / ProtocolRegistry remains authoritative for registered service identity and implementation/version references.
- Decoder registration inside the indexer does not activate, deactivate, endorse or upgrade a protocol service.
- Unknown protocol versions fail closed rather than being decoded using an incompatible schema.
- Historical decoder versions remain available so past events can be reproduced after protocol upgrades.
- Decoded projections retain their source block/log provenance and decoder version.

# 420 Registry architecture

The 420 Registry application reads canonical state from `ProtocolRegistry` and may use 420Indexer/Explorer/Search as convenience projections. Security-sensitive clients should recheck canonical chain state before acting.

Genesis service IDs are frozen through `ServiceIds420`; extension IDs require explicit governance approval and descriptor commitments. Registration profiles bind component type, manifest hash, dependency root and interface hash to the published implementation.

The frontend is replaceable. `ProtocolRegistry` is the canonical authority for this domain.
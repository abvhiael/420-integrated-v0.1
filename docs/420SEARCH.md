# 420Search — Genesis Profile

420Search is the reference discovery layer for the 420 Integrated ecosystem. It provides one search surface across public blockchain activity, registered services, addresses, contracts, names, identities, assets, validators, listings, rights records, public community spaces and other explicitly indexable protocol data.

## Authority model

420Search is intentionally contract-free. Search indexes, caches, relevance scores, snippets, categories, recommendations and ranking algorithms are replaceable presentation infrastructure. Canonical truth remains with the chain and the protocol that owns each record. 420Registry identifies official services and versions; 420Explorer-compatible indexing provides chain projections; 420 Names and 420 Identity may enrich results without replacing canonical addresses or identity records.

Every result should retain source provenance. On-chain results remain traceable to chain ID and their block, transaction or log reference. Public API responses expose indexed and finalized heights so clients can detect stale or wrong-network data.

## Search domains

Genesis Search covers blocks, transactions, addresses, contracts, registered services and versions, 420 Names, public Identity profiles, assets, validators, public 420 Market listings, public 420 Rights records, public Commons spaces and public Pulse publications/topics. Additional public protocol domains may be added through versioned 420Registry discovery.

## Ranking and sponsored discovery

Ranking is never protocol authority. Default ranking behavior must be documented and clients may use alternative rankers. Sponsored placement may exist, but it must be explicitly labeled and cannot alter canonical record fields or impersonate official registration, ownership, rights, trust or payment status.

## Privacy

Search excludes private Messenger content, private Commons content, encrypted Resource Protocol payloads, private Identity data and raw 420 Attention telemetry. A public commitment, hash or ciphertext reference never authorizes recovery or indexing of the protected payload.

420Search can fail, be replaced or be independently reimplemented without preventing direct use of wallets, RPC, Explorer, contracts or any underlying 420 Integrated protocol.

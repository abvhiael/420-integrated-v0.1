# 420Search — Genesis Closeout

**Phase:** SEARCH-10  
**Service:** `420/service/search/v1`  
**Closeout profile:** `420-search-genesis-closeout-v1`

420Search reaches genesis closeout only when the complete SEARCH-0 through SEARCH-10 stack is present on one reconciled branch and the final reconciled head passes repository qualification.

## Frozen genesis boundary

420Search is discovery infrastructure, not protocol authority. It owns no canonical chain or application state, requires no genesis contract, never performs direct node420 RPC crawling, and may be rebuilt or replaced without changing canonical protocol truth.

The only chain projection boundary is the qualified 420Indexer API. Search must fail closed when the Indexer is wrong-chain, stale, unavailable, not ready, or violates the non-authoritative consumer contract.

## Frozen public domains

Genesis Search may return only these public result domains:

- block
- transaction
- address
- contract
- service
- name
- public identity
- asset
- validator
- market listing
- rights record
- public Commons
- public Pulse

Private Messenger content, private Commons content, private Identity payloads, encrypted Resource Protocol payloads, and raw Attention telemetry remain excluded. Commitments, hashes, ciphertext references, or public transaction metadata do not authorize recovery of protected payloads.

## Frozen runtime contracts

The closeout manifest pins the versioned Search API, query schema, cursor schema, ranker, privacy-admission contract, and runtime profile. Snapshot pagination remains bound to the query, ranker, indexed height, and finalized height. Organic ranking is non-canonical. Sponsored placement is separately labeled and cannot rewrite canonical fields or trust state.

The deployed `search420` process serves the versioned API and embedded frontend from one runtime. Runtime configuration accepts a qualified Indexer URL and Search-specific operational settings; it does not accept a node RPC endpoint.

## Testnet evidence

SEARCH-9 supplies two deployment validators:

- `searchsmoke` — verifies deployed liveness/readiness/status, capabilities, Search API response shape, snapshot integrity, and public provenance.
- `searchlivevalidate` — verifies representative live Search behavior, domain allowlisting, snapshot/provenance bounds, privacy exclusions, and optional seeded probes across genesis result domains.

A deployment does not become genesis-qualified merely because code compiles. Testnet evidence must be captured against the intended deployment and chain.

## Final merge gate

Before PR #201 may merge:

1. SEARCH-0 through SEARCH-10 are present on the stacked Search branch.
2. Current `main` is reconciled into the Search branch.
3. The reconciled head remains mergeable with no unresolved conflicts.
4. 420 Integrated Qualification passes on the exact reconciled head.
5. 420Docs Qualification passes on the exact reconciled head.
6. Both required 420Indexer qualification workflows pass on the exact reconciled head.
7. No Search change introduces direct RPC, canonical-authority ownership, private-domain indexing, or sponsored canonical rewriting.

Once those gates are green, PR #201 is merged once into `main`. Phase-by-phase Search merges are intentionally forbidden.

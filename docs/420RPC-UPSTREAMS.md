# 420RPC upstream model

RPC-1 defines how 420RPC describes and qualifies the services it may route to. Upstream discovery is an ingress-safety mechanism only. It does not establish consensus, execution, ownership, balance, settlement, governance or finality authority.

## Upstream classes

### `execution-rpc`

Represents canonical EVM execution reads and transaction submission through compatible `node420`/execution RPC providers on chain ID 420. Execution upstreams may be routed only after their configured identity is structurally valid and runtime discovery proves the expected chain identity.

### `indexer-api`

Represents the 420Indexer read API. Indexer providers must explicitly remain non-authoritative, must not accept transaction submission, must report chain ID 420, and must report readiness before they are eligible. Their data remains derived and rebuildable.

## Descriptor contract

Each configured provider has:

- a unique stable ID;
- upstream class;
- endpoint and matching transport;
- expected chain ID;
- authoritative/derived declaration;
- transaction-submission declaration;
- enabled state;
- non-negative routing priority.

Registry validation requires at least one enabled execution provider and rejects duplicate IDs, wrong-chain configuration and invalid class semantics before runtime routing exists.

## Runtime capability discovery

Execution discovery probes transport-neutral JSON-RPC for:

- `eth_chainId` — mandatory identity proof;
- `web3_clientVersion` — optional implementation metadata;
- `eth_blockNumber` — head-read capability;
- `eth_getBlockByNumber` with `safe` and `finalized` — finality-tag read capability.

Transaction submission capability is declared by configuration rather than tested with a real transaction. WebSocket subscription capability is inferred from a WS/WSS transport declaration. RPC-2 will define the precise public JSON-RPC method profiles; RPC-1 only discovers enough capability to classify providers safely.

Indexer discovery uses a transport-neutral metadata reader and requires:

- expected chain ID;
- non-empty service identity;
- ready state;
- `authoritative: false`.

## Reachable versus eligible

A provider may be reachable but still ineligible. A wrong-chain node is the primary example: the endpoint answered, but 420RPC must never route application traffic to it. Disabled, malformed, unreachable, wrong-chain or semantically invalid providers remain outside the eligible pool.

## Failure behavior

Discovery fails closed. Network errors, malformed chain identity, wrong-chain responses, unready Indexer metadata or class/authority violations result in an ineligible provider report with reasons. Later routing phases consume eligible providers; they must not reinterpret an ineligible report as healthy.

## RPC-1 invariants

- **RPC1-001** — provider IDs are unique within a registry.
- **RPC1-002** — every configured upstream is pinned to the intended chain identity.
- **RPC1-003** — execution and derived Indexer classes remain distinguishable.
- **RPC1-004** — 420Indexer is never declared authoritative or transaction-submission capable.
- **RPC1-005** — runtime chain identity is proven before an upstream becomes eligible.
- **RPC1-006** — wrong-chain providers may be reachable but are never eligible.
- **RPC1-007** — discovery failure excludes a provider rather than guessing capability.
- **RPC1-008** — capability discovery does not create protocol authority.

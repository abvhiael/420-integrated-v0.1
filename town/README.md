# 420Town

420Town is the Genesis-facing community-board service defined by the GEN-SVC consumer-service architecture. It is not a frozen Genesis application and must not create parallel protocol authority.

## Package ownership

420Town application code lives under `town/` and uses the repository root Go module:

`github.com/420integrated/420-integrated`

Current packages:

- `town/model` — versioned Town object vocabulary and opaque ID envelope;
- `town/config` — canonical service identity and direct dependency declarations;
- `town/content` — posts, threads, comments/replies, votes, visibility, revisions, tombstones, idempotency and abuse controls;
- `town/schema/v1` — machine-readable object/schema, authority and content vocabulary.

Town-specific Solidity lives under `contracts/src/town`.

## Authoritative community state

`TownAuthority420` is the on-chain authority for:

- community ownership and metadata commitment;
- membership lifecycle;
- community-scoped roles;
- bounded Town permissions;
- subscriptions;
- entitlements;
- treasury-reference binding.

Search, 420Indexer, transport, Storage gateways, frontend and rewards remain replaceable/non-authoritative projections or integrations.

Treasury handling is reference-only. Town has no deposit, withdrawal, transfer or parallel balance-ledger authority.

## Content state

TOWN-AUDIT-4 implements replaceable off-chain Town content state for:

- posts;
- threads;
- comments and replies;
- revision history;
- tombstones;
- votes;
- visibility enforcement;
- idempotent/replay-safe writes;
- spam/Sybil/rate-abuse controls.

High-volume content body bytes remain off-chain by default. Town stores a content reference plus a SHA-256 digest, not the body itself.

Comments inherit the root post visibility so replies cannot widen a thread. Unknown visibility fails closed.

Every content mutation requires an idempotency key. Reusing the same key for a different payload is rejected.

The abuse baseline includes per-identity limits, vote limits, aggregate community limits, duplicate body-digest detection, and lower limits for unknown/unverified/young identities. Risk signals affect throttling only and never become identity authority.

## Build and qualification

From repository root:

```bash
go test ./town/...
python3 scripts/verify-420town-skeleton.py
python3 scripts/verify-420town-authority.py
python3 scripts/verify-420town-content.py
python3 scripts/verify-420town-audit.py
```

Focused Solidity and retained Town integration tests are owned by the dedicated 420Town audit workflow.

## Configuration

Copy `town/.env.example` for local development. It intentionally contains no credentials or production endpoints.

Canonical application configuration:

- `config/420town-genesis.json`
- `config/420town-authority-v1.json`
- `config/420town-content-v1.json`

## Current limitations

TOWN-AUDIT-4 does not implement moderation/appeals, production Identity/Search/Notifications/Storage adapters, public API/SDK/indexer/recovery, frontend workflows, live testnet deployment or production operations. Those remain later canonical roadmap steps.

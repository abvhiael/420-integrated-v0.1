# 420Town

420Town is the Genesis-facing community-board service defined by the GEN-SVC consumer-service architecture. It is not a frozen Genesis application and must not create parallel protocol authority.

## Package ownership

420Town application code lives under `town/` and uses the repository root Go module:

`github.com/420integrated/420-integrated`

Current packages:

- `town/model` — versioned Town object vocabulary and opaque ID envelope;
- `town/config` — canonical service identity and direct dependency declarations;
- `town/content` — posts, threads, comments/replies, votes, visibility, revisions, tombstones, idempotency and abuse controls;
- `town/moderation` — reports, hide/lock/suspend enforcement, block/mute, appeals, decisions, restoration and audit provenance;
- `town/integrations` — Identity, Storage, Search, Notifications, Messenger transport and Registry discovery adapters;
- `town/api` — authenticated `/v1` transport with validation, idempotency, pagination and observability;
- `town/projection` — rebuildable/reorg-safe derived public read model;
- `town/recovery` — atomic projection checkpoint persistence and restore;
- `town/web` — user-facing browser app for discovery, content, moderation and authority-bearing workflows;
- `town/schema/v1` — machine-readable object/schema, authority, content and moderation vocabulary.

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

The abuse baseline includes per-identity, trusted-device, trusted-network, vote and aggregate-community limits, duplicate body-digest detection, and lower limits for unknown/unverified/young identities. Risk signals affect throttling only and never become identity authority.

## Moderation and appeals

TOWN-AUDIT-5 implements the shared GEN-SVC moderation actions:

`REPORT, HIDE, BLOCK, MUTE, SUSPEND, APPEAL, MODERATOR_DECISION, RESTORE, LOCK`.

Community moderators and admins are domain-scoped. Block/mute are user-scoped. Suspension is Town/community scoped. Appeals preserve prior decision provenance and restoration releases enforcement without rewriting history.

The content service requires a moderation gate, so hide/lock/suspension cannot be bypassed through alternate read, edit, vote, thread, reply or revision-history paths.

Moderation never gains asset, treasury/payment, protocol identity, wallet, Rights, Governance, Registry or Arbitration authority.

## Build and qualification

From repository root:

```bash
go test ./town/...
python3 scripts/verify-420town-skeleton.py
python3 scripts/verify-420town-authority.py
python3 scripts/verify-420town-content.py
python3 scripts/verify-420town-moderation.py
python3 scripts/verify-420town-integrations.py
python3 scripts/verify-420town-api.py
python3 scripts/verify-420town-audit.py
python3 scripts/verify-420town-web.py
python3 scripts/verify-420town-security.py
python3 scripts/verify-420town-docs.py
```

Focused Solidity and retained Town integration tests are owned by the dedicated 420Town audit workflow.

## Configuration

Copy `town/.env.example` for local development. It intentionally contains no credentials or production endpoints.

Canonical application configuration:

- `config/420town-genesis.json`
- `config/420town-authority-v1.json`
- `config/420town-content-v1.json`
- `config/420town-moderation-v1.json`
- `config/420town-integrations-v1.json`
- `config/420town-api-v1.json`
- `config/420town-web-v1.json`

## Service integrations

TOWN-AUDIT-6 implements the repository-side integration baseline for 420Identity, 420Storage/Resource Protocol, 420Search, 420Notifications and conditional 420Messenger transport. Search receives only explicit PUBLIC Town projections; notification handoff remains subscription/consent-bound; Storage retrieval verifies SHA-256 content integrity; Messenger authorization fails closed before replaceable encrypted transport; optional Town Rewards remains non-authoritative.

See `docs/apps/town/integrations.md`.

## API, SDK, projection and recovery

TOWN-AUDIT-7 implements the repository-side `/v1` API, typed Go SDK, derived public projection/indexer surface, generation-bound cursor pagination, bounded retries, API observability and atomic interruption-recovery snapshots.

See `docs/apps/town/api.md`.

## User-facing web application

TOWN-AUDIT-8 implements the browser application under `town/web`. Search discovery remains non-authoritative; content/moderation uses the Town `/v1` API; membership, roles, subscriptions and entitlements remain canonical in `TownAuthority420`. Authority-bearing writes require an EIP-1193 wallet, expected-network match and exact TownAuthority420 target pinning.

See `docs/apps/town/web.md`.

## Documentation and phase-closeout status

TOWN-AUDIT-9 security hardening and TOWN-AUDIT-10 repository/documentation closeout are implemented in the repository. The documentation set includes:

- `docs/apps/town/architecture.md`
- `docs/apps/town/user-guide.md`
- `docs/apps/town/developer-guide.md`
- `docs/apps/town/operator-guide.md`
- `docs/apps/town/configuration-deployment.md`
- `docs/apps/town/known-limitations.md`

Repository completion remains distinct from live qualification.

## Current limitations

TOWN-AUDIT-10 does not claim live deployed endpoints, materialized production wallet/network bindings, production persistence, live chain reorg observation, production authentication, or production operations. Those remain TOWN-AUDIT-11/12 responsibilities. See `docs/apps/town/known-limitations.md`.

# 420Town

420Town is the Genesis-facing community-board service defined by the GEN-SVC consumer-service architecture. It is not a frozen Genesis application and must not create parallel protocol authority.

## Package ownership

420Town application code lives under `town/` and uses the repository root Go module:

`github.com/420integrated/420-integrated`

Current packages:

- `town/model` — versioned Town object vocabulary and opaque ID envelope;
- `town/config` — canonical service identity and direct dependency declarations;
- `town/schema/v1` — machine-readable object/schema and authority vocabulary.

Town-specific Solidity lives under `contracts/src/town`.

## Authoritative community state

TOWN-AUDIT-3 introduces `TownAuthority420` as the on-chain authority for:

- community ownership and metadata commitment;
- membership lifecycle;
- community-scoped roles;
- bounded Town permissions;
- subscriptions;
- entitlements;
- treasury-reference binding.

Search, 420Indexer, transport, Storage gateways, frontend and rewards remain replaceable/non-authoritative projections or integrations.

Treasury handling is reference-only. Town has no deposit, withdrawal, transfer or parallel balance-ledger authority.

High-volume content and message bodies remain off-chain by default.

## Build and qualification

From repository root:

```bash
go test ./town/...
python3 scripts/verify-420town-skeleton.py
python3 scripts/verify-420town-authority.py
python3 scripts/verify-420town-audit.py
```

Focused Solidity and retained Town integration tests are owned by the dedicated 420Town audit workflow.

## Configuration

Copy `town/.env.example` for local development. It intentionally contains no credentials or production endpoints.

Canonical application configuration:

- `config/420town-genesis.json`
- `config/420town-authority-v1.json`

## Current limitations

TOWN-AUDIT-3 does not implement posts/threads/comments/votes, moderation/appeals, Identity/Search/Notifications/Storage integration, API/SDK/indexer/recovery, frontend workflows, live testnet deployment or production operations. Those remain later canonical roadmap steps.

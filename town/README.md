# 420Town

420Town is the Genesis-facing community-board service defined by the GEN-SVC consumer-service architecture. It is not a frozen Genesis application and this package must not create parallel protocol authority.

## Package ownership

420Town application code lives under `town/` and uses the repository root Go module:

`github.com/420integrated/420-integrated`

Current skeleton packages:

- `town/model` — versioned Town object vocabulary and opaque ID envelope;
- `town/config` — canonical service identity and direct dependency declarations;
- `town/schema/v1` — machine-readable object-schema catalogue.

Town-specific Solidity reward integration remains under `contracts/src/town`. It is optional and is not the authority for Town community state.

## Authority boundary

The current architecture requires authority-bearing membership, roles, permissions, subscriptions, treasuries and entitlements to remain authoritative independently of replaceable UI, Search, Indexer, transport, Storage gateways or rewards.

High-volume content and message bodies remain off-chain by default. This skeleton defines names and boundaries only; lifecycle semantics are implemented in later TOWN-AUDIT steps.

## Build and qualification

From repository root:

```bash
go test ./town/...
python3 scripts/verify-420town-skeleton.py
python3 scripts/verify-420town-audit.py
```

Existing Town rewards regressions are owned by the dedicated 420Town audit workflow.

## Configuration

Copy `town/.env.example` for local development. The skeleton intentionally contains no credentials or production endpoints.

Canonical application configuration is `config/420town-genesis.json`.

## Current limitations

TOWN-AUDIT-2 establishes repository/package/schema/configuration ownership only. It does not implement community lifecycle, membership authorization, content CRUD, moderation, API, indexer, integrations or frontend behavior.

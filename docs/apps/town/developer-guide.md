---
title: 420Town developer guide
component: town
audience:
  - developer
category: application
status: development
version: v1
---

# 420Town developer guide

## Repository layout

- `contracts/src/town` — Town authority and optional Rewards integration.
- `contracts/test/Town*.t.sol` — Town contract/unit/property tests.
- `town/model` — application objects and stable IDs.
- `town/content` — content lifecycle and visibility.
- `town/moderation` — moderation/appeal state.
- `town/integrations` — shared-service adapters.
- `town/api` — HTTP API.
- `town/projection` — derived public projection.
- `town/recovery` — projection checkpoint persistence.
- `sdk/town420` — typed Go client.
- `town/web` — browser app.
- `config/420town-*.json` — machine-readable contracts/invariants.
- `scripts/verify-420town-*.py` — repository verifiers.

## Build and test

From repository root:

```bash
go test ./town/... ./sdk/town420
go vet ./town/... ./sdk/town420
python3 scripts/verify-420town-audit.py
python3 scripts/verify-420town-skeleton.py
python3 scripts/verify-420town-authority.py
python3 scripts/verify-420town-content.py
python3 scripts/verify-420town-moderation.py
python3 scripts/verify-420town-integrations.py
python3 scripts/verify-420town-api.py
python3 scripts/verify-420town-web.py
python3 scripts/verify-420town-security.py
python3 scripts/verify-420town-docs.py
```

Browser qualification:

```bash
cd town/web
npm run qualify
```

Focused Solidity qualification:

```bash
cd contracts
forge build src/town/TownAuthority420.sol
forge test --match-path "test/Town*.t.sol" -vvv
forge test --match-path "test/RewardsCrossDappHardening420.t.sol" -vvv
```

The Level 3 closeout additionally relies on the canonical repository owners: Solidity Contracts for the full Foundry inventory, Genesis Address Authority for address/namespace/predeploy authority, 420 Integrated Qualification for global Go/node/fault/soak checks, and 420Docs Qualification for documentation reconciliation.

## API

Implemented routes and transport rules are documented in `api.md` and machine-readable in `config/420town-api-v1.json`.

Mutation requirements:

- bearer authentication;
- bounded `Idempotency-Key`;
- bounded request body;
- unknown JSON fields rejected;
- domain service remains the source of authorization decisions.

## Errors and failure semantics

The API uses typed HTTP errors around authentication, invalid input, idempotency conflicts, not found, forbidden/authorization, dependency unavailable/mismatch, and integrity failures.

The Go SDK exposes typed errors in `sdk/town420/errors.go` and retries only bounded transport/429/502/503/504 failures.

Contract calls may revert with `InvalidInput`, `CommunityExists`, `UnknownCommunity`, `Unauthorized`, `InvalidTransition`, `OwnerInvariant`, `UnknownRole`, `UnknownPermission`, or `TreasuryReferenceInvalid`.

## Events

`TownAuthority420` emits community creation/ownership, membership transitions, role-assignment changes, role-permission changes, subscription transitions, entitlement transitions, and treasury-reference changes. Integrators must treat these events as provenance for canonical authority mutations, not as permission to invent additional state.

## Integration contracts

- Identity: active profile/controller read; fail closed for identity-bound actions.
- Storage: prepare/retrieve content; verify SHA-256 against Town anchor.
- Search: export explicit PUBLIC active Town documents only.
- Notifications: require selected active/unmuted subscription and provenance.
- Messenger: require endpoint/conversation/participant/block/envelope authority before encrypted transport.
- Registry/service discovery: exact active service-ID binding only.
- Rewards: optional and non-authoritative.

## Extension rules

Do not:

- derive a `bytes32` authority community key from an opaque Town ObjectID without a canonical mapping decision;
- store high-volume post/comment bodies in canonical Town state;
- allow Search/Indexer/UI/Notifications/transport/rewards to become Town authority;
- add payable/custody behavior to `TownAuthority420` without a new canonical architecture decision;
- enable webhooks without signed domain separation, timestamp/nonce replay protection, and bounded replay retention.

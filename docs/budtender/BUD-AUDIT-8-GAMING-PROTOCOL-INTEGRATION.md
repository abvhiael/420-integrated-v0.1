# BUD-AUDIT-8 — Gaming Protocol Integration

Status: COMPLETE — Level 1 + Level 2 integration milestone qualified

## Authority and scope

This audit step connects the qualified Budtender application/client stack to the existing shared 420 Gaming Protocol access boundary without creating a second wallet, session, identity, entitlement, claim, attestation, or gameplay authority.

Canonical integration authority:

- `docs/gaming/420GP-12-BUDTENDER.md`;
- `docs/gaming/420GP-16-SECURITY-PRIVACY.md`;
- `packages/420-gaming-sdk`;
- `clients/budtender-access-v1`;
- the qualified BUD-AUDIT-6 application service and BUD-AUDIT-7 user-facing client.

Canonical game namespace:

`420/GAMING/GAME/BUDTENDER/V1`

## Progressive access model

Budtender preserves:

`GUEST -> REGISTERED -> WALLET-LINKED`

Base management gameplay remains wallet-free.

Registered access is required only for account-scoped features such as cloud-save continuity.

Wallet-linked access is optional and may gate only ecosystem features such as:

- premium cosmetic decor;
- collectible fixtures/display items;
- optional seasonal ecosystem events;
- cross-game collectibles/items;
- optional $420 rewards and provenance/ownership features.

Wallet linkage must not increase or mutate:

- sales speed;
- customer patience;
- margins;
- staff efficiency;
- inventory yield;
- progression rate;
- cash;
- stock;
- upgrade levels;
- expansion state;
- customer simulation state.

## Shared authority boundary

`clients/budtender-access-v1` remains the sole Budtender adapter over `@420/gaming-sdk`.

The application/client must not implement parallel:

- wallet state;
- session authority;
- identity authority;
- entitlement authority;
- claim authority;
- attestation authority;
- cross-game history enumeration.

The SDK client remains pinned to the canonical Budtender game ID and filters cross-game poisoned adapter responses.

## User-facing integration

The BUD-AUDIT-7 host now exposes read-only/non-authoritative Gaming Protocol policy/status endpoints:

- `GET /api/gaming`
- `POST /api/gaming/access`

These endpoints expose policy/status only.

Caller-supplied registration/wallet booleans are not authoritative account/session state and cannot unlock or mutate gameplay. They are used only to evaluate the shared progressive-access policy.

The host reports:

- canonical game ID;
- core/registered/wallet-optional feature classes;
- entitlement namespace metadata;
- repository runtime state as deployment-pending;
- `authoritativeSessionState: false`.

The browser renders the integration status and explicitly keeps core play wallet-free.

## Repository/runtime boundary

Repository qualification can validate:

- canonical namespace;
- SDK scoping;
- progressive access policy;
- fail-closed unknown features;
- cross-game poisoning protection;
- no wallet-wide enumeration surface;
- application-state non-mutation by access evaluation;
- retained shared Gaming security/adversarial behavior.

Live deployment qualification remains separate under GP-15.

The checked-in testnet runtime is unresolved until actual deployment supplies:

- chain ID;
- six Gaming Protocol contract addresses;
- reference-game operator addresses;
- live registry/operator bindings.

This step must not claim live-testnet qualification while those values are unresolved.

## Audit invariants

- `BUD-GAME-001`: canonical game ID is exactly `420/GAMING/GAME/BUDTENDER/V1`.
- `BUD-GAME-002`: base management gameplay remains available to guests without wallet linkage.
- `BUD-GAME-003`: cloud-save policy may require registration but not wallet linkage.
- `BUD-GAME-004`: wallet-linked features remain optional and isolated from core gameplay.
- `BUD-GAME-005`: wallet linkage cannot change competitive/statistical gameplay state.
- `BUD-GAME-006`: unknown Gaming features fail closed.
- `BUD-GAME-007`: all shared SDK calls are pinned to the Budtender namespace.
- `BUD-GAME-008`: cross-game poisoned adapter results fail closed.
- `BUD-GAME-009`: no wallet-wide entitlement/claim/history enumeration surface is exposed.
- `BUD-GAME-010`: access-policy evaluation cannot mutate Budtender application state.
- `BUD-GAME-011`: no parallel session/wallet/identity/entitlement/claim/attestation authority is introduced.
- `BUD-GAME-012`: unresolved live runtime remains deployment-pending and fail-closed.

## Qualification

### Level 1

Run the exact-head Budtender Qualification workflow covering:

- Budtender core regressions;
- web-client syntax/tests;
- Budtender access-client tests;
- shared Gaming SDK tests;
- retained Gaming Protocol security/adversarial tests.

### Level 2 milestone

BUD-AUDIT-8 is an app integration milestone because the user-facing client now converges with the shared Gaming Protocol access dependency.

Level 2 remains app-focused and is satisfied by the retained Budtender integration/security jobs plus the existing GP-16 hostile-state and four-game integration coverage where directly applicable.

Do not trigger repository-wide Level 3 inventories for this step.

## Exit criteria

BUD-AUDIT-8 is COMPLETE only when:

1. the canonical Budtender Gaming Protocol namespace is frozen and used;
2. guest core gameplay remains wallet-free;
3. registered/cloud-save and optional wallet boundaries match GP-12;
4. no wallet-linked policy can mutate gameplay state/statistics;
5. unknown/poisoned/cross-game access fails closed;
6. no wallet-wide enumeration or parallel authority surface is introduced;
7. the user-facing client exposes only non-authoritative Gaming policy/status;
8. runtime state is truthfully reported as deployment-pending until GP-15 live qualification;
9. exact-head Level 1 Budtender qualification passes (satisfied by `da029c1009bc7721573aa75057dd7a3017e0aa93`, Budtender Qualification run `37686660231`);
10. app-focused Level 2 integration coverage passes where required (satisfied on the same SHA by Budtender `gaming-client-hardening` plus dedicated 420 Gaming Client Hardening run `37686660235`, Four-Game E2E run `37686660214`, and Cross-Game Qualification run `37686660223`);
11. durable repository evidence records implementation SHA, CI evidence, base SHA, limitations, deferred checks, and next roadmap step (recorded in `docs/audit/BUD-AUDIT-8-EVIDENCE-2026-10-07.md`).

## Known limitations

This step does not resolve the live Gaming Protocol testnet runtime.

It does not implement cloud save itself; it only preserves the registered/no-wallet access policy for that future capability.

It does not add production wallet connection UI, signing flows, operator transactions, or live entitlement consumption.

Those behaviors require later runtime/deployment/testnet work.

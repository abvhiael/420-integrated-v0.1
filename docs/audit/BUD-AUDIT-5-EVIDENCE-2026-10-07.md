# BUD-AUDIT-5 — Level 1 qualification evidence

Date: 2026-10-07

Status: COMPLETE

## Roadmap step

BUD-AUDIT-5 — Offline Progression

Qualification level: Level 1 — app-scoped fast qualification.

This step closes the BUD-0 `BUD-ARCH-008` implementation gap without creating a new canonical BUD gameplay phase.

## Authoritative implementation SHA

`c619c3fecbbb17ae34303209b908e78844d48051`

Base `main` SHA at qualification:

`c8e8b58d818611276f7a9bb2b8d2241004450d97`

Audit branch:

`audit/budtender-complete-20261007`

PR:

#561 — `audit(budtender): repository-grounded qualification and remediation`

Branch divergence at closeout preparation: 35 commits ahead / 0 behind `main`.

## Implementation completed

- Added `src/budtender/OfflineProgression.ts`.
- Added deterministic calculation from stored cursor + elapsed time + explicit offline source state.
- Froze maximum processed offline elapsed time at 24 hours.
- Discards elapsed time beyond the bound rather than allowing repeated capped collection.
- Fails closed on clock rollback and preserves the trusted cursor.
- Advances the cursor to the observed current timestamp after successful processing, preventing replay at the same timestamp.
- Uses complete deterministic intervals only.
- Enforces per-source remaining cash caps.
- Rejects duplicate source IDs.
- Rejects unsafe timestamp/reward/cap arithmetic.
- Has no wallet, blockchain, account, Gaming Protocol, oracle, or network dependency.
- Existing BUD-1 through BUD-4 systems remain offline-inert because none is currently canonically marked offline-capable.
- Does not directly mutate inventory, orders, customers, upgrades, progression, or cash.
- Leaves trusted cursor/source ownership to the future persistence/application layer.

## Tests added

`test/budtender/OfflineProgression.spec.ts` covers:

- deterministic repeatability;
- complete-interval accounting;
- 24-hour accumulation bound;
- excess-time discard;
- per-source reward cap;
- disabled source behavior;
- clock rollback;
- replay at the same timestamp;
- duplicate source rejection;
- malformed interval rejection;
- unsafe timestamp rejection;
- reward overflow rejection;
- zero effect with no offline-capable sources.

## Exact-head CI evidence

Workflow: **Budtender Qualification**

Run: **37659072145**

Exact-head verification: PASS.

### Core

Job ID: `112921629881`

- checkout exact PR head: PASS
- Node 22 setup: PASS
- exact qualification head verification: PASS
- syntax-check `src/budtender/*.ts` and `test/budtender/*.spec.ts`: PASS
- complete Budtender TypeScript test suite, including `OfflineProgression.spec.ts`: PASS

### Gaming integration

Job ID: `112921629786`

- exact qualification head verification: PASS
- shared Gaming SDK tests: PASS
- Budtender Gaming integration tests: PASS

No Gaming SDK/access implementation changed in BUD-AUDIT-5; this is retained app-workflow regression evidence.

### Gaming contract security

Job ID: `112921629661`

- exact qualification head verification: PASS
- shared Gaming Protocol security target build: PASS
- retained `GamingProtocol420*.t.sol` adversarial suite: PASS

No Solidity/shared Gaming Protocol implementation changed in BUD-AUDIT-5; this is retained extra coverage rather than a new shared dependency requirement.

## Requirements satisfied

- `BUD-ARCH-008`: deterministic, bounded, chain-independent offline progression boundary.
- `BUD-OFF-001` through `BUD-OFF-012` in `docs/budtender/BUD-AUDIT-5-OFFLINE-PROGRESSION.md`.

## Security / adversarial result

PASS for directly applicable offline-progression threats:

- negative/rollback time cannot mint rewards;
- excessive forward time is capped;
- time beyond the cap cannot be recovered in repeated chunks at the same timestamp;
- duplicate source definitions fail closed;
- malformed/unsafe numeric economics fail closed;
- absent/disabled sources cannot mint rewards;
- current inventory/customer/order/upgrade state cannot be mutated by the calculator;
- wallet or chain state cannot affect the result.

## Level 2 status

Not required for this ordinary step.

No several-step convergence, new shared authority, or cross-component lifecycle was introduced. The retained app workflow nevertheless passed its existing Gaming integration coverage.

## Intentionally deferred Level 3 checks

Per the audit qualification model, the following remain deferred to the final accumulated app-phase closeout:

- canonical full repository Solidity inventory;
- Genesis Address Authority;
- 420 Integrated Qualification;
- global Docs reconciliation;
- global Indexer/Search/RPC/client/service qualification not directly affected by this step;
- final reconciliation against then-current `main`;
- full deployment/configuration reconciliation.

## Limitations / blockers

BUD-AUDIT-5 itself has no remaining implementation or Level 1 qualification blocker.

Production exposure of offline rewards remains dependent on a future persistence/application layer that owns a trusted offline cursor and trusted source state. Existing BUD-1 through BUD-4 systems intentionally remain offline-inert until a canonical later mechanic explicitly opts in.

Live Gaming Protocol testnet deployment remains a separate application-release blocker and is unchanged by this step.

## Completion state

**BUD-AUDIT-5 — COMPLETE**

Implementation SHA: `c619c3fecbbb17ae34303209b908e78844d48051`

Evidence-only documentation follows the qualified implementation and does not require recursive substantive requalification.

## Next roadmap step

Per the short BUD-AUDIT roadmap supplied for this audit phase:

**BUD-AUDIT-6 — Application Service Layer**

Create a stable authoritative API boundary over gameplay/progression/inventory and later persistence/offline state without allowing presentation code to become authoritative.

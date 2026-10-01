# NAMES-AUDIT-4 — Complete 420Names user-facing application

Status: **QUALIFICATION PENDING**

Qualification level: **Level 1 — per-roadmap-step fast qualification**

## Canonical requirement

NAMES-AUDIT-4 requires the documented commit/register, renew, resolution, reverse and transfer workflows to exist as a real user-facing application with wallet/network/error/transaction states and accessibility/error recovery.

## Implementation

420 Wallet now contains a complete 420Names lifecycle-management application.

### Production client

`wallet/web/core/names-management.js` provides:

- qualified Names420 deployment binding through `deployment.namesAddress`;
- chain, account, bytecode identity and protocol-version verification;
- canonical commitment generation through `makeCommitment`;
- label availability checks;
- commitment timestamp/minimum-age/maximum-age enforcement;
- guarded `commit` and `register` flows;
- owner-checked `renew`;
- owner-checked `setResolution`;
- forward-target-checked `setReverseName`;
- owner-checked `transferName`;
- pending-owner-checked `acceptName`;
- `eth_call` simulation and `eth_estimateGas` before every submission;
- chain/account revalidation immediately before broadcast;
- EIP-1193 `eth_sendTransaction`;
- receipt polling and explicit success/revert/timeout handling;
- recoverable error classification;
- cryptographically secure registration-salt generation.

The module stores no private keys, mnemonics, seed phrases, or hard-coded Names deployment address.

### User interface

`wallet/web/names-management-ui.js` exposes:

- connect/verify state;
- two-step registration with secure salt generation;
- canonical commitment/reveal-window display;
- canonical record inspection;
- renewal;
- forward resolution/profile/service updates;
- reverse-name selection;
- transfer nomination and acceptance;
- explicit preflight/submitted/confirmed/blocked transaction states;
- wallet confirmation prompts before state changes;
- account/chain-change invalidation;
- `role=status` / `aria-live` transaction feedback;
- `role=alert` recovery messaging;
- focus restoration to the failed action.

The Wallet shell exposes a **420 Names** navigation target and loads the management module directly.

### Tests and static controls

- `wallet/web/test/names-management.test.js` covers commit/reveal timing, availability, duration validation, owner authorization, reverse agreement, transfer acceptance, network/account changes, simulation failure, confirmation failure, error recovery and salt generation.
- `wallet/web/test/names-management-ui.test.js` checks canonical workflow controls, accessibility state, shell binding, qualified deployment binding and absence of embedded signing secrets.
- `wallet/web/scripts/check.mjs` now makes the management client/UI/shell/tests mandatory Wallet artifacts and statically verifies the guarded transaction primitives.
- `.github/workflows/names-audit.yml` directly runs all Names Wallet tests plus Wallet static qualification.

## CI scope policy

Superseded Wallet verification runs are cancelled by branch-scoped workflow concurrency, so stale Web/extension/mobile runs cannot continue occupying runners after a newer audit commit exists.


For audit PRs, broad Wallet Web/extension/mobile qualification is deferred to Level 3 because those workflows include unrelated release/predeploy/native-mobile work. Their relevant Names Web coverage is retained in the Names-specific Level-1 workflow.

The workflows remain enabled on non-audit PRs, main/push paths where applicable, and manual dispatch.

## Documentation

Updated:

- `docs/apps/names/user-guide.md`
- `docs/apps/names/troubleshooting.md`
- `docs/audit/420NAMES-COMPLETE-AUDIT-20260930.md`

Documentation now matches the shipped transaction lifecycle and error-recovery behavior.

## Repository state

Audit branch: `audit/420names-complete-20260930`

PR: #427

Implementation/evidence head at record creation: `2c935768b2dd5cb98ac33b858f5c4a0f0981daad`

Current main: `152364d9b69b6d5fe159685fb986c9139e0522cb`

Branch divergence at record creation: ahead 65, behind 37.

No ceremonial main reconciliation is performed for this ordinary step. Final branch reconciliation remains a Level-3 closeout requirement unless an actual dependency conflict is found earlier.

## Required Level-1 qualification

The exact implementation head must pass:

1. exact-head checkout;
2. retained Names Solidity/dependency/hardening suite;
3. targeted Names Slither/static gates when applicable;
4. existing resolver/send Wallet tests;
5. lifecycle-management client tests;
6. management-UI/accessibility tests;
7. Wallet static qualification;
8. Names authority/opcode scan.

## Level-2 status

NAMES-AUDIT-4 is not itself a Level-2 boundary. The first natural broader application integration milestone remains after NAMES-AUDIT-6, when the user application can be bound to the frozen runtime artifact and deterministic Genesis state.

## Deferred Level-3 checks

Deferred until complete app-phase closeout:

- complete Solidity/Genesis qualification;
- full 420 Integrated Qualification;
- repository-wide Docs/global reconciliation;
- complete Wallet Web/extension/mobile release qualification;
- deployment/testnet/runtime qualification;
- full cross-app reconciliation.

## Completion criterion

NAMES-AUDIT-4 is COMPLETE when the exact-head Names Level-1 workflow passes with the lifecycle-management and UI checks above and no blocking application defect remains.

The next canonical roadmap step is:

**NAMES-AUDIT-5 — generated runtime artifact** — compile the exact canonical Names420 source with pinned compiler settings and freeze reproducible ABI/runtime bytecode/artifact metadata.

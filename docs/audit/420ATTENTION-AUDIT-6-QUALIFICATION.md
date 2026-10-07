# ATTENTION-AUDIT-6 — User-facing application implementation

Status: implementation candidate awaiting exact-head Level 1 CI qualification.

## Canonical requirement

ATTENTION-AUDIT-6 requires a deployable user-facing 420 Attention / Cannaseur client with Wallet/network connection, participant consent management, campaign inspection, sponsor campaign lifecycle/funding, proof/reward inspection, reward claiming, explicit transaction/error states, accessibility/responsive basics, and production/runtime configuration.

This is an **ordinary app-scoped roadmap step** and therefore uses **Level 1 fast qualification**. Repository-wide Solidity, Genesis/address-authority, 420 Integrated, Geth, global Docs and complete app-phase closeout suites remain deferred to Level 3 unless a shared dependency is materially changed.

## Implementation

Added `attention/web/` as a dependency-free static browser client.

Authority boundaries:
- browser state is presentation only;
- canonical truth remains in Attention contracts and canonical chain state;
- derived API projections require explicit canonical provenance;
- raw behavioral telemetry/private audience data are never accepted into browser runtime configuration;
- no Wallet secret or provider credential is accepted;
- user mutations require an EIP-1193 Wallet, exact chain match, a canonical transaction review, an allowlisted canonical Attention target, successful gas simulation and explicit Wallet authorization;
- Wallet account/chain/disconnect events invalidate client authority;
- confirmation tracking surfaces pending, included, confirmed, reverted, reorged and timeout states.

Implemented workflows:
- campaign list/detail and immutable economics display;
- global and campaign-specific consent review;
- proof and reward inspection;
- reserved reward claim review;
- sponsor campaign creation;
- sponsor campaign funding;
- activate/pause/close/cancel lifecycle review;
- explicit reviewed transaction display before Wallet handoff.

The committed runtime intentionally leaves chain ID, projection API and registry-resolved component addresses unresolved and keeps all mutation feature flags OFF. This preserves the dependency boundary with ATTENTION-AUDIT-7 and ATTENTION-AUDIT-8.

## Level 1 qualification

Required checks:
- exact implementation SHA checkout;
- `npm run check`;
- Node unit/negative tests;
- static production-candidate build;
- `scripts/verify-420attention-audit-6.py`.

No Level 2 milestone is introduced by this step. Level 3 comprehensive qualification remains intentionally deferred to app-phase closeout.

## Completion evidence

Populate after CI:
- implementation SHA: pending;
- evidence SHA: may differ only for evidence-only bookkeeping;
- base/main SHA: `f674fbed767efc126da253c66800e38d030dc1dd`;
- branch: `audit/420attention-complete-20261006`;
- PR: #557;
- workflow: `420Attention AUDIT-6 Level 1`;
- blockers: none repository-side if all required Level 1 checks pass;
- next canonical roadmap step: **ATTENTION-AUDIT-7 — Indexer/API/service projection**.

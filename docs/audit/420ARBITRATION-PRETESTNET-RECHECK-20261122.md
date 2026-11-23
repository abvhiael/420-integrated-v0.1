# 420Arbitration pre-testnet recheck — 2026-11-22

## Scope and authority

This recheck inspects current `main` after the original ARBITRATION-AUDIT-4 merge (#509, merged 2026-10-04). Historic statements that PR #509 is open are superseded by GitHub's merge status. The existing ARBITRATION-AUDIT-4 exact-head qualification is retained as **historical**, not automatically transferred to later commits.

420Arbitration's canonical domain-scoped authority remains governed policy, snapshotted case, evidence commitments, one selected resolver per round, bounded appeal, and finalized ruling. It does **not** execute an originating protocol's remedy, own custody, or obtain general governance authority.

## Concrete remediation on this branch

- Wallet app catalogue declares canonical Genesis protocol/user-app classification and `requiresVerifiedRegistry: true`; no fabricated standalone origin or assertion that an interactive Wallet screen exists.
- Wallet runtime action dispatch now requires an **own** property of the known action map, not `action in targets`, rejecting inherited `constructor`, `toString`, `hasOwnProperty` and `__proto__` keys.
- Regression tests lock the canonical catalogue requirement and reject prototype-property action names.

## Incomplete verification / do not overclaim

- The `wallet/web/core/arbitration-runtime.js` helper is currently referenced directly by its tests and mechanical verifier. This is **not evidence of a connected end-user transaction screen**, interactive evidence submission, resolver dashboard, or end-to-end Wallet transaction review.
- The runtime helper validates the shape of a supplied binding; it does not itself retrieve active Registry state or independently compare RPC code hashes. The Commerce `commerce/src/arbitration.mjs` consumer does perform on-chain service/profile/code/dependency verification; that does not automatically prove that Wallet does.
- The original materialization explicitly reports `canonical_descriptor_present: false` for Arbitration indexing. A local replayable descriptor/consumer, same-deployment projection and recovery evidence are not established by the historical AUDIT-4 proof.
- Cross-consumer remedies are origin-owned. Each domain must separately prove exact case-origin binding, finalized-ruling authorization, idempotent consumption, accounting preservation, and unauthorized/replay rejection. The generic Arbitration contract suite cannot certify every origin-domain consumer.
- This document does not claim that current-main Foundry, all consumer integration tests, or exact-head security CI have passed. Preserve the separate original historical workflow IDs as historical, not current evidence.

## Remaining repository-local acceptance before declaring all actions and interactions complete

1. Wire a genuinely verified Registry and RPC binding into the Wallet consumer, including active service version, chain identity, deployed graph and runtime code hashes. Do not rely on a caller's untrusted `verified` flag.
2. Qualify actual Wallet workflows: list/open case, inspect case/history, submit evidence, appeal, authorized resolver ruling, finalization, stale or changed Registry bindings, wrong chain, wallet rejection, reorg, and disabled policy.
3. Implement or qualify a reconstructable Arbitration event projection and recovery path before claiming indexer-backed end-user history.
4. Inspect each deployed/intended origin consumer for explicit, isolated finalized-ruling consumption and a replay-resistant, accounting-conserving remedy transition.
5. Run exact-head Foundry, runtime, catalogue, Commerce, Genesis namespace and static-analysis CI; retain workflow/run/commit identities and reconcile against present `main`.

## Testnet-gated acceptance only

ARBITRATION-AUDIT-5 requires the real production-equivalent public testnet: frozen chain/genesis identity; actual governed deployments and bytecode hashes; one-time Case-to-Ruling binding; verified Registry publication; domain policy activation; real user/resolver life cycle and origin consumption; Wallet and projection behavior against the *same* deployment; reorg/rebuild/finality/RPC disagreement exercises; and retained chain transactions, receipts and evidence. No synthetic/local result may be labeled a live testnet pass.

ARBITRATION-AUDIT-6 then covers final exact-release security/review, key custody, monitoring, incident/recovery readiness and Genesis/production disposition.

**Disposition:** original AUDIT-4 completed and merged, but a new blanket current-main claim that all Arbitration contracts, actions, programs and interactions are complete would exceed the evidence. Testnet execution itself is blocked until launch; the repository-local gaps above should not be called testnet blockers without implementation/qualification.

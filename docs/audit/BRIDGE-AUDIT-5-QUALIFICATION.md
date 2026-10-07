# BRIDGE-AUDIT-5 — Bridge application/service surface qualification

**Status:** COMPLETE  
**Qualification level:** Level 1 step-specific  
**Qualified implementation SHA:** `85ffe2a2d788a1bacbaab4db139e8f0aa89a0bfe`  
**Audit branch / PR:** `audit/420bridge-complete-20261001` / PR #463

## Qualified outcome

BRIDGE-AUDIT-5 reconciles the repository's Genesis user-application claim for 420Bridge with an actual deployable user surface.

The canonical user surface for the current release stage is the **420Exchange `/bridge` route**, not a separate standalone Bridge web site. Bridge protocol authority remains in the Bridge contracts and registries; Exchange provides the reviewed user experience and read/projection surface without acquiring Bridge execution authority.

Implemented outcome:

- 420Exchange `/bridge` is the canonical current Bridge application surface.
- Application documentation now states that Bridge is surfaced through Exchange rather than implying a nonexistent standalone production site.
- The repository-owned Exchange read service now exposes a Bridge projection derived from 420Indexer Bridge events plus RPC health/fallback readiness.
- Configured live mode fails closed if the canonical projection or RPC fallback is unavailable; it does not silently replace live data with demo fixtures.
- Bridge review now presents source/destination chain, canonical asset, route, adapter, verifier, amount, recipient, route/asset limits, finality and freshness context.
- Bridge route qualification fails closed for stale or noncanonical projections.
- Settlement/history presentation preserves finality/freshness/canonicality and provides conservative retry guidance for failed/reorged operations.
- Demo fixtures remain explicitly labeled and cannot authorize execution.
- Live submission remains deployment/testnet-gated under the existing Exchange/Bridge execution controls.

## Exact-head Level 1 evidence

| Workflow | Run | Result |
| --- | ---: | --- |
| 420Exchange Web Verification | #797 / `36969118243` | PASS |
| Exchange Web `verify-exchange-web` | job `110719183203` | PASS |
| 420Bridge Fast Qualification | #28 / `36969118185` | PASS |
| Bridge Fast `bridge-fast` | job `110719239098` | PASS |
| Solidity Contracts | #4031 / `36969118219` | PASS at workflow level |
| Solidity `compute-fast` | job `110719273430` | PASS |
| Solidity generic `pr-shards` | job `110719274684` | SKIPPED by audit-branch classification; not required for A5 |

The Exchange Web workflow passed:

- quote-service static checks, unit/integration tests and secret scan;
- order-service static checks and unit/integration tests;
- Exchange read-service static checks and contract/integration tests;
- retained 420Indexer shared-dependency qualification;
- Exchange security/ops static checks, startup/degradation tests and package generation;
- backend secret scan;
- Exchange web static checks;
- Exchange web unit tests;
- qualification-mode deployable browser build and artifact verification;
- Chromium browser acceptance;
- metadata-driven read-only Chromium acceptance;
- frontend secret scan.

Bridge Fast #28 passed:

- exact-head checkout/verification;
- Bridge hardening verifier;
- Bridge contract tests;
- affected Exchange Bridge qualification tests;
- Pay/Swap/Bridge cross-suite integration.

## Superseded failed candidate

The first exact-head A5 run exposed one harness/fixture defect in the integrated Exchange release qualification: the retained demo Bridge fixture did not declare the new canonicality/freshness provenance fields and therefore correctly failed the new fail-closed Bridge model with `bridge route unavailable: noncanonical`.

The production/live safety rule was preserved. The fixture was updated to declare explicit demo/degraded provenance, producing the final qualified implementation SHA `85ffe2a2d788a1bacbaab4db139e8f0aa89a0bfe`. The replacement exact-head Exchange Web run then passed completely.

## Security and adversarial coverage

The qualified A5 coverage proves:

- stale Bridge projection data fails closed;
- reorged/noncanonical Bridge projection data fails closed;
- live configured mode requires canonical read-service data and RPC fallback readiness;
- demo fixtures remain explicitly non-authoritative;
- bridge review preserves source/destination chains, asset, route, adapter, verifier, amount, recipient, limits, finality and freshness;
- read-service Bridge responses preserve canonical route identity and settlement provenance;
- Bridge hardening and contract tests remain green after application-surface changes;
- Pay/Swap/Bridge cross-suite integration remains green;
- retry/recovery guidance does not manufacture success or blindly resubmit ambiguous/reorged state.

## Qualification scope

This is a **Level 1** per-roadmap-step qualification.

- No Level 2 qualification is consumed here; Bridge Level 2 remains planned after BRIDGE-AUDIT-8.
- No Level 3 closeout is consumed here; that remains BRIDGE-AUDIT-10.
- Production-equivalent live-testnet operation remains BRIDGE-AUDIT-9.
- Generic Solidity PR shards are not required for this step because A5 modifies Exchange/read-service/application-surface code and documentation, not Solidity contracts. The directly affected Bridge contract/integration coverage is provided by Bridge Fast #28.

## Exit decision

**BRIDGE-AUDIT-5 COMPLETE.**

Next canonical step: **BRIDGE-AUDIT-6 — Deployment, initialization and Registry publication closure.**

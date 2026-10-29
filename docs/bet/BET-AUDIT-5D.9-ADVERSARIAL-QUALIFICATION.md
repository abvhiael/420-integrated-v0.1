# 420Bet BET-AUDIT-5D.9 — Adversarial security and qualification

## Scope and inherited behavior
This step qualifies the first locally implemented single-ticket fixed-odds sportsbook, subject to the separately retained TN-BOOK-00 local acceptance matrix and TN-BOOK-01–05 live/external requirements. 5D.4 established funded stake custody, collateral and quote locking; 5D.5 two-party certification; 5D.6 verified result Oracle integration, irreversible Oracle-only funding and event correlation; 5D.7 certified ordinary/special settlement, refunds and immutable receipts; 5D.8 authorized aggregate asset profit exposure ceilings with prospective emergency freezes.

## 5D.9 adversarial regression additions
The dedicated 5D.9 Foundry suite inherits preceding deployment/Oracle/risk fixtures and exercises a single funded sequence across cap exhaustion, attempted unauthorized/duplicate funding, forged and under-quorum Oracle reports, low-confidence evidence, cross-market result substitution, legacy resolver bypass, legitimate settlement, risk-release integrity, replay rejection, emergency timeout recovery and single-withdrawal guarantees. Tests assert preserved player credit, outstanding exposure and asset conservation after each relevant failure.

## Qualification rules
- The 5D.9 suite alone is not a full independent production acceptance or a global Solidity inventory.
- Exact-SHA run evidence is mandatory. CI workflow: `420bet-sports-5d9.yml` (scoped Foundry inheritance).
- Preserve 5D.6–5D.8 passing historical SHA evidence. Run affected workflows only after test implementation preflight.
- Before complete 5D.9 / TN-BOOK-00 closeout, cross-check canonical architecture criteria for unauthorized alternative admission/settlement routes, full event/market transitions, oracle independence/provenance, replay/reorg/timeout, settlement asset conservation, emergency-domain transitions, signed client quote/identity binding, and deployment configuration verifiers. No local mocks prove live independent authority.
- Retain exact current-main reconciliation, job references, SHA and unresolved gaps. Do not mark the step PASS without the comprehensive local acceptance matrix.


## 2026-10-29 canonical readiness reconciliation — NOT READY FOR LEVEL 3

Reconciled against the original 5D.1 architecture and `TN-BOOK-00` in `docs/420BET-TESTNET-WORK-ROADMAP.md`. Qualified scoped candidate: `a673e6ff66807a5cb62f38bbad918ef275b9e74d`, 5D.9 adversarial run 40903355172 (108 passed), Solidity classification run 40903355167 (PASS; full Foundry shards intentionally SKIPPED). Last compared main `707974d14dab6259c8db9afd45f3ec7159ae5480`; seven intervening High Country asset commits with no overlapping PR paths. PR #902 is draft, open and mergeable, **not a complete 5D phase certificate**.

| Canonical local gate | Evidence / remaining requirement | Disposition |
| --- | --- | --- |
| Event/market identity, immutable terms, authorized lifecycle | Existing 5D.2/5D.3 registry and scoped historical tests; full phase-wide transition/revision adversarial matrix not reconciled | PARTIAL |
| Odds provenance, exact quote, stale/expiry/early-start, consent | Existing 5D.3 ingestion and 5D.4 admission paths; 5D.1 requires signed player-bound quote, revocation, domain identity and actual client consent; complete end-to-end evidence not identified | OPEN |
| Atomic admission, custody and collateral | 5D.4 funded contracts; inherited 5D.9 Foundry covers funded tickets, overrun, reservation, conservation | SCOPED PASS |
| Authorized independent reports, evidence, challenges, revisions | 5D.5/5D.6 prior suites and inherited 5D.9 negative tests; complete provider control independence remains external and no live accepted source proof | LOCAL PARTIAL |
| Outcomes including standard, push, no-action, dead heat, cancellations and postponement | 5D.7 settlement paths and receipts; full postponement/revision-policy-to-refund cross-module lifecycle and adversarial recovery proof not demonstrated | PARTIAL |
| Global/market/player/event/asset risk ceilings, emergencies and safe release | 5D.4/5D.6/5D.8 scoped checks, plus 5D.9 freeze/claim recovery; exhaustive emergency-domain transitions and operational policy approvals not demonstrated | PARTIAL |
| Cross-module bypass, replay, reorg, finality and privilege boundaries | 5D.9 108 scoped inherited tests; 5D.1 explicitly requires generic alternative entry/settlement route exclusion, canonical receipt/reorg handling and deployment-authority epochs | PARTIAL |
| Canonical identity, canonical $420 representation, services, SDK/client and entitled provider adapter | Test ERC20 and mock Oracle fixtures do not establish complete application integration; local service/client, adapter and identity binding evidence not demonstrated | OPEN |
| Level 2 funded end-to-end app qualification | No exact-SHA retained sportsbook client/service/real-adapter integration certificate identified | OPEN |
| Final Level 3 phase inventory | No complete frozen final-candidate Solidity coverage and fixture, Genesis address authority, Integrated services/Geth, global Docs and retained app suite result established for final reconciled tree | BLOCKED |

**Decision:** NOT READY for Level 3. Fix all demonstrably local gaps, reconcile full canonical requirements and prepare one final complete, frozen candidate before running expensive workflows. A workflow's success with mandated inventory jobs skipped does not count as Level 3 evidence. Never presume mocked/provider fixtures are independently controlled operational sources.

**External ledger:** Preserve TN-BOOK-01–05: official deployment/chain/asset identity, real signed source entitlements and provider provenance, official-network funded payouts and finalized receipts, independent risk/security/license/jurisdiction/operator authorization and live reorg/outage/incident drills. Cross-asset economic policy approval is external; any locally testable adapter/math/configuration work remains local.

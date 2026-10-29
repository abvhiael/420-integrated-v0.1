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

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

## 2026-10-29 local 5D.9 integration acceptance inventory

The following is the **required acceptance inventory**, not an automatic PASS declaration. The original 5D.1 architecture and TN-BOOK-00 remain authoritative. This package does not enable production betting and does not replace the live TN-BOOK-01–05 checks.

| Original local gate | Implementation and direct evidence target | Status pending final exact-SHA evidence |
| --- | --- | --- |
| One funded admission entry | `SportsBetAcceptance420.accept` stays disabled; `clients/420bet-sports/session.py` issues wallet-owned `SportsFundedTickets420.fund` only; `test_session.py`, `test_rpc.py`, `SportsFundedTickets420.t.sol` | Candidate |
| Live RPC and signed client consent | `rpc.py` reads actual ABI tuples, checks approved asset balance/allowance, builds payer transaction, signs using external wallet, requires explicit terms consent and verifies canonical receipt, event and ticket; `test_rpc.py`, `test_session.py` | Candidate; fake RPC transport in Python test, independently qualified real vault through Foundry |
| Source provenance and odds domain | `source_verifier.py` verifies approved provider Ed25519 observation; `quote_bridge.py` independently reconstructs EIP-712 domain and quote, derives canonical `keccak256(abi.encode(provider,feed,sourcePolicy))` from approved competition and checks accepted on-chain digest, sequence, evidence and terms; `test_quote_bridge.py`, `test_app.py`, `SportsOddsIngestion420.t.sol` | Candidate |
| Identity, canonical $420 and authority | `identity.py` checks approved Identity420 code hash, wallet-controlled active profile, approved issuer/trust, live nonrevoked credential and exact W420 address/symbol/18 decimals; caller provides official identities under TN-BOOK-01; `test_session.py` | Candidate; official designation remains external |
| Registry transitions, revisions, odds epoch | `SportsMarketLifecycle420.t.sol`, `SportsOddsIngestion420.t.sol`: suspension, cancellation, postponement, expiry, revocation, immutable terms and risk | Previously qualified scoped; retain exact-SHA execution |
| Independent Oracle and disputed outcomes | `SportsRealOracleRouterIntegration420.t.sol`, `SportsSpecialSettlement420.t.sol`: two-source quorum, provider revocation, low confidence/outage, proposed/challenged/final, push, no-action, dead heat and timeouts | Previously qualified scoped; retain exact-SHA execution |
| Emergency, special settlement and conservation | `SportsRiskEmergency420.t.sol`, `SportsAdversarialQualification420.t.sol`, inherited 5D.4–5D.8: collateral/asset/player/group caps, emergency freeze, authorized settle, refund, immutable terminal receipts and double-claim prevention | 109/109 scoped adversarial tests passed at prior SHA `54d10ddcc9278dbf0cacb6de1f84b5558e38b183`; repeat only if affected |
| Restart and reorg reconciliation | `rpc.py` re-fetches finalized receipt and canonical block/transaction after restart, validates `TicketFunded` event and on-chain player ticket; `app.py` checks terminal settlement executor is the Oracle gate; `test_rpc.py`, `test_app.py` | Candidate; locally simulated transport and explicit finalized-receipt checks |
| Exact-SHA local app + funded Level 2 | `.github/workflows/420bet-sports-5d9-app.yml`, `420bet-sports-5d9-level2.yml`, `420bet-sports-5d9.yml` | PENDING final candidate runs |
| Official deployment, provider license, live settlement and independent approval | TN-BOOK-01 through TN-BOOK-05 | TESTNET/EXTERNAL; not declared local PASS |

**Evidentiary limits.** The Python RPC adapter uses real cryptographic wallet signing and actual ABI paths, but its isolated unit test transport is simulated. The Foundry tests execute actual Solidity contracts in a local EVM, but the two test environments have not been exercised as one combined Anvil deployment with the Python wallet. No such combined live local receipt is claimed by the above matrix. Independent upstream source control, approved issuer/asset designations, real provider entitlements and official transaction finality require external authority and cannot be self-attested.

**Historical runs retained:** Application Level 1 `40971220346`, independent funded Level 2 `40971220385` (3/3), adversarial `40971220424` (109/109), 420Docs `40971220551`, Oracle audit `40971220364` — all at `54d10ddcc9278dbf0cacb6de1f84b5558e38b183`. These certify that SHA, not subsequent client changes.

**Merge rule:** Do not substitute skipped policy guards or unrelated global workflows for local evidence. Freeze the implemented tree, inspect the affected Level 1 and Level 2 application/Foundry jobs, reconcile with current main and only then close the local milestone. Do not treat the external TN-BOOK gates as locally satisfied.

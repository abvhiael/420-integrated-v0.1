# BET-AUDIT-5D.1 — Sportsbook architecture, supported bet types and market authority

Date: 2026-10-26. Status: proposed architecture baseline for Phase 5D. This document defines implementation requirements; it does not certify a working sportsbook, complete TN-BOOK-00, grant capabilities or authorize wagering.

## 1. Repository baseline and scope

Repository: `abvhiael/420-integrated-v0.1`. Reviewed main snapshot: `0cada7a3dff1792c624f8bbc124216cf32efb4bb`.

The existing [testnet roadmap](https://github.com/abvhiael/420-integrated-v0.1/blob/0cada7a3dff1792c624f8bbc124216cf32efb4bb/docs/420BET-TESTNET-WORK-ROADMAP.md) places unfinished sportsbook implementation in TN-BOOK-00 and official deployment, data provenance, funded lifecycle, independent acceptance and activation in TN-BOOK-01–05. The present request starts that local engineering work; those gates remain open.

Verified shared primitives:

- `BetTypes420.ProductClass.SPORTSBOOK` and `GameMode.MARKET` classify the product.
- `BetAuthorization420.scopeForMarket(marketId)` supplies a canonical market scope.
- Emergency domains include `SPORTS_MARKET`, `ORACLE_PROFILE`, `NEW_WAGERS`, `VAULT_NEW_RISK` and `SETTLEMENT_HOLD`.
- `BetIds420` includes shared placement, risk, vault and settlement actions; sportsbook-specific lifecycle actions are absent.
- Existing WagerRouter/SettlementEngine, access policy, registries, risk manager and vault are integration candidates. Their existence does not establish sportsbook quote validation or result resolution.

Sources: [types](https://github.com/abvhiael/420-integrated-v0.1/blob/0cada7a3dff1792c624f8bbc124216cf32efb4bb/contracts/src/bet/BetTypes420.sol), [authorization](https://github.com/abvhiael/420-integrated-v0.1/blob/0cada7a3dff1792c624f8bbc124216cf32efb4bb/contracts/src/bet/BetAuthorization420.sol), [actions](https://github.com/abvhiael/420-integrated-v0.1/blob/0cada7a3dff1792c624f8bbc124216cf32efb4bb/contracts/src/bet/BetIds420.sol).

## 2. Product decisions

V1 proposal: operator-backed fixed-odds, pre-match, single-event, single-selection tickets funded in canonical $420 through the approved asset binding. Each deployment binds one asset representation and precision; native and wrapped representations cannot be mixed in a ticket or vault. The operator supplies independently funded risk capital. This is distinct from fantasy pools and prediction-market share trading.

| Bet type | Proposed V1 scope | Deterministic interpretation |
| --- | --- | --- |
| Two-way moneyline | Included where the sport/ruleset defines a decisive result | Selected participant wins under the frozen overtime/shootout policy. An unresolved tie invokes the committed push/no-action rule. |
| Three-way moneyline | Included under an explicitly regulation-only ruleset | Home, draw or away are distinct selections. A draw is a normal winning outcome. |
| Point spread / handicap | Included for whole and half-unit lines | Selected side wins when its score plus signed handicap exceeds its opponent; equality is a push. |
| Match total | Included for whole and half-unit lines | Over/under compare the frozen eligible score sum to the line; equality is a push. |
| Parlays, accumulators and same-game parlays | Deferred | Require explicit scope, correlation pricing, combined settlement and independent risk acceptance. |
| In-play betting and cashout | Deferred | Require event-time latency controls, suspension guarantees, new quotes and independent qualification. |
| Props, futures, period/team totals, teasers, Asian quarter lines, each-way/dead-heat products, exchanges and promotional bets | Deferred | Reject unsupported types; do not approximate them with V1 types. |

No sport or league is globally enabled by this architecture. A versioned allowlist must name competition, market types, score units, period coverage, overtime/shootout treatment, cancellation rules and source entitlement before market opening. NHL may reuse provider plumbing only after sportsbook-specific entitlement and semantic verification; fantasy data access is not evidence of odds rights.

Use signed integer lines scaled by two: `-7` means -3.5. Scores are normalized to the same units. Never use floating point in canonical comparison or payout math. Changing line, period, participant mapping or overtime policy creates a new market/version; it cannot reinterpret accepted tickets.

## 3. Components and single-writer ownership

Names below describe proposed modules, not existing deployed contracts.

| Object / proposed component | Canonical writer | Responsibility and boundary |
| --- | --- | --- |
| SportsEventRegistry | Scoped event registrar | Canonical event/participant identity and append-only schedule revisions; no payout authority. |
| SportsMarketRegistry | Scoped lifecycle controller | Immutable market terms, approvals, state and quote epoch. Registration and approval are separate powers. |
| SportsQuoteAuthority | Authorized quote signer and on-chain validator | Signed fixed-odds offers bound to exact market terms; no result reporting or fund movement. |
| SportsAcceptanceAdapter | Restricted acceptance path | Revalidate eligibility, signatures, freshness, state and risk; atomically escrow, reserve and record one ticket. |
| SportsExposureBook | Restricted acceptance/settlement adapters | Per-ticket and aggregate exposure; integrate existing risk/vault accounting without a second spendable balance. |
| SportsResultBook | Authorized canonical oracle adapter | Evidence-backed facts, revision sequence and source provenance; cannot choose arbitrary winners. |
| SportsDisputeController | Independent scoped resolver | Candidate challenges, deadlines and evidence-bound disposition; cannot edit odds or redirect beneficiaries. |
| SportsResolver | Deterministic rules engine | Derive WIN/LOSS/PUSH/VOID and payout from ticket terms and finalized facts. |
| Canonical settlement/vault integration | Bound settlement adapter and existing restricted custody path | Exactly-once payment/refund, reservation release, fees and receipts. |
| Client / API / indexer | Read-only projection | Display state, assemble requests and retain receipts; never authoritative for odds acceptance, clocks, winners or balances. |

Implementation must prove compatibility with existing router, registry, economics and vault semantics. Add a sportsbook-specific restricted entry point/resolver binding where necessary. Generic caller-supplied `paramsHash` or `maxGrossPayout` is insufficient: derive and verify both from the signed quote. No alternative generic route may accept or settle sportsbook tickets without these checks. Sporting outcomes use authorized factual reports, not casino randomness.

## 4. Canonical records and commitments

Use domain-separated, typed hashes binding chain ID and verifying contract. Identifiers must remain distinct across operators, deployments and versions.

| Record | Minimum committed fields |
| --- | --- |
| Event | Event ID, sport/competition/season, canonical participants, source-ID mapping digest, original scheduled start, current schedule revision, source policy and event status. |
| Market | Market ID/version, event ID, operator, game/module version, type, period, selection IDs, signed line, score units, overtime/shootout policy, rules hash, source/fallback policy, dispute/correction/timeout policy, risk profile, vault/asset and acceptance cutoff. |
| Quote | Quote ID, market/version/config hash, selection, player, exact stake, rational decimal odds numerator/denominator, maximum gross payout, asset/vault/operator, issue/expiry times, source observation time and digest, quote epoch, signer epoch, player nonce, fee-policy hash and deployment domain. |
| Ticket | Wager ID, quote digest, market terms hash, fixed beneficiary, acceptance time/block, stake, exact maximum gross payout, reserve reference, eligibility/risk/economics versions and consumed nonce. |
| Result candidate | Event/market version, report sequence, prior report hash, provider/feed identity, event-time and receipt-time, completion status, required scores/facts, source evidence digest, policy version and challenge deadline. |
| Final settlement | Ticket ID, final candidate hash, dispute disposition, rules version, derived outcome, gross/net/fees, reservation release and canonical receipt reference. |

V1 quotes are player-bound and exact-stake, single-use. Issuing a quote does not reserve capital or guarantee acceptance. Risk is checked atomically at acceptance. Price movement requires a new quote and player consent; never silently substitute a price. Signed offers expire at `now >= expiry`; acceptance requires `now < cutoff` and `now < current eligible start`. A schedule delay does not automatically reopen betting or extend a cutoff. Earlier starts must conservatively close affected markets; uncertain start status suspends acceptance.

Original schedule and all revisions remain auditable. A reschedule after tickets exist suspends the market; the frozen postponement policy governs those tickets. Any permitted replacement market uses a new identity/version.

## 5. Market authority and capabilities

All mutating actions require canonical identity, an active operator where applicable, the exact subject scope, an unexpired capability and current authority epoch. Distinct addresses alone do not establish independent control. Beneficial control and key custody require independent evidence before activation.

Proposed action labels below must be added and qualified later; this document issues none. Market actions use existing `scopeForMarket`. Event registration needs a separately defined event scope; registration before a market exists needs a bounded operator/competition scope. Never substitute a wildcard grant.

| Power | Proposed action labels | Constraints |
| --- | --- | --- |
| Create event/market | `BET_SPORT_EVENT_REGISTER`, `BET_SPORT_MARKET_REGISTER` | Bounded operator/competition/event; creates DRAFT only. |
| Approve terms | `BET_SPORT_MARKET_APPROVE` | Independent policy/risk approver, exact configuration digest. |
| Open/resume/close | `BET_SPORT_MARKET_OPEN`, `BET_SPORT_MARKET_RESUME`, `BET_SPORT_MARKET_CLOSE` | Active approvals, source health, funded risk and cutoff; closure cannot be reversed. |
| Suspend | `BET_SPORT_MARKET_SUSPEND` | Scoped operator or emergency controller; stop new risk without erasing tickets. |
| Issue/revoke quotes | `BET_SPORT_QUOTE_SIGN`, `BET_SPORT_QUOTE_REVOKE` | Bound signer/version; monotonic quote epoch invalidates outstanding offers only. |
| Report facts | `BET_SPORT_FACT_REPORT` | Authorized provider/feed route, monotonic signed provenance, no payout power. |
| Challenge / resolve | `BET_SPORT_CHALLENGE`, `BET_SPORT_DISPUTE_RESOLVE` | Defined standing/bond/deadline; independent resolver cannot resolve its own conflict. |
| Finalize | `BET_SPORT_RESULT_FINALIZE` | Objective candidate readiness; permissionless trigger is acceptable if contract checks all conditions. |
| Accept / pay | Shared placement/settlement actions with bound sportsbook adapters | Player authority and deterministic result verification; no operator SET_WINNER or arbitrary transfer. |

Quote signer, fact reporter, dispute resolver and custody executor must not collapse into unilateral operator control. Revocation prevents new actions immediately; it cannot invalidate previously accepted obligations or replace their beneficiary. Replacement authorities must follow the frozen, auditable recovery policy.

## 6. State machines and clocks

Market lifecycle: `DRAFT → APPROVED → OPEN ↔ SUSPENDED → CLOSED`. OPEN and SUSPENDED may close; CLOSED is irreversible. An unlaunched DRAFT/APPROVED market may be retired without money movement. A market with tickets cannot be deleted or retired to erase liability. Voiding funded tickets requires finalized no-action facts/policy, not an unrestricted lifecycle command.

Result lifecycle: `NONE → PROPOSED → FINAL`; a challenge moves PROPOSED to DISPUTED, then an evidence-backed disposition produces a new PROPOSED candidate or permits finality. Every substantive correction increments sequence, invalidates readiness of the previous candidate and restarts the committed challenge window. Finalization requires market closure, complete terminal facts, elapsed windows and no unresolved dispute. Explicitly gate transitions; enum order is not authorization.

Ticket lifecycle: accepted ticket → outcome ready → settled or void. Settlement succeeds once. Identical replay returns the existing receipt or rejects harmlessly; a conflicting replay rejects. Reverted payout must not consume a ticket or release its reserve.

Block time governs contract deadlines; source event-time governs fact semantics. Define maximum quote age, observation age, future skew, source lag, challenge duration, correction horizon and final refund timeout in a versioned policy. No default infinite waits or zero-duration finality. Parameters need independent risk approval; architecture does not invent approved values.

## 7. Odds, funding and exposure

Use exact rational decimal odds `n/d`, where `d > 0` and `n > d`; gross winning payout is `G = floor(stake × n / d)` using overflow-safe multiply/divide. G includes returned stake. Reject values exceeding approved bounds; never silently cap a signed payout. WIN pays G, LOSS pays zero, PUSH/VOID return the full stake. Examples in atomic units: stake 100 at 19/10 pays 190 gross and 90 profit; a push refunds 100.

For V1 adopt conservative gross coverage: escrow the player's stake and independently reserve G from operator capital at acceptance. This intentionally exceeds a net-profit-only reserve. If the shared vault exposes net-liability semantics, an adapter and accounting proof must reconcile the chosen policy before implementation qualification; labels alone are not evidence. Never count player escrow as free operator capital.

Aggregate gross reservation must cover every unsettled ticket; no opposing-outcome netting in V1. Enforce player stake/loss/time limits plus per-ticket, market, event, participant/competition correlation group, operator and vault limits. Related spread, moneyline and total markets cannot evade aggregate caps through separate IDs. Available capital excludes safety reserves, existing reservations, queued withdrawal obligations and other earmarked funds. Acceptance updates all limits atomically or reverts completely.

At terminal payment release the reservation exactly once; post the corresponding operator P&L once. For each resolved ticket: `player stake + operator contribution = beneficiary payout + authorized fees + operator remainder`. Across custody: deposits and stakes minus actual withdrawals/payouts/fees equal held assets, allocated once among escrow, reserves and free capital. Reservations are encumbrances, not additional assets.

Fees must bind to a versioned approved policy, with separate gross, fee and net receipt fields. No fantasy-pool development percentage is inherited. PUSH/VOID return the entire stake without fees. If fee policy/beneficiaries are unapproved, market opening fails closed.

## 8. Source authority, exceptions and disputes

Provider evidence is an input to authorized canonical oracle reporting, not direct settlement authority. Freeze primary provider, eligible feeds, identity mapping, report signing policy, retention and permitted fallback before opening. Multiple reporter keys backed by the same provider remain one upstream source. Do not claim independent corroboration from them.

Stale/missing/conflicting facts, source outages, expired entitlement, uncertain identity mappings or early-start signals suspend new acceptance. Fallback follows the frozen precedence and equivalence rules; an operator cannot pick the source that minimizes payouts. Unknown status never means LOSS. Keep licensed raw evidence or permitted durable references accessible to authorized dispute reviewers without leaking credentials.

| Case | Required behavior |
| --- | --- |
| Integer-line equality | PUSH; full stake refund. |
| Draw in regulation three-way market | Draw selection wins; remaining selections lose. |
| Two-way tie without qualifying decisive result | Frozen push/no-action rule; never force a winner. |
| Cancellation / abandonment / no contest | Frozen sport-specific completion rule; absent qualifying completion, VOID and refund. |
| Postponement | Suspend; frozen maximum delay, continuation identity and final deadline determine continuation versus refund. |
| Missing facts beyond final deadline | Bounded auditable no-action/refund path, callable without operator cooperation. |
| Dead heat / fractional win unsupported | Reject such market rules at creation. Unexpected incompatible facts enter dispute then bounded no-action; no improvised fractional payout. |
| Correction before finality | New evidence-backed candidate, reopened challenge period, holds payment. |
| Correction after irreversible finality | Retain evidence and use a separately approved compensation/dispute process; never rewrite paid tickets or claw back funds unilaterally. |

The frozen dispute policy must define standing, bond/refund/forfeiture rules, evidence requirements, response deadlines, conflicted-resolver replacement, maximum escalation and timeout resolution. A privileged party cannot extend a hold forever. Refund logic must be compatible with existing shared wager expiry: generic `voidExpired` must neither refund before the sportsbook dispute policy permits nor leave tickets locked past their committed final deadline.

Emergency halts gate new acceptance independently from preservation and payout. Settlement holds require bounded policy and evidence. Reorg recovery uses finalized canonical receipts, revalidates deployment/authority epochs and rebuilds projections; it must never treat an orphaned acceptance as funded or duplicate a canonical payout.

## 9. Implementation handoff and acceptance

The following are work packages within 5D, not invented replacements for unseen canonical audit numbering:

1. Implement versioned event/market schemas, immutable terms, scoped actions, approvals and lifecycle guards.
2. Implement source adapter, quote signing/validation and client consent with expiry, revocation, replay and start-time protection.
3. Integrate eligibility, canonical $420 custody, atomic gross reserve/exposure accounting and protected acceptance routes.
4. Implement facts, deterministic resolution, correction/challenge windows, refund timeouts and protected settlement routes.
5. Complete the client, funded integration, adversarial recovery and phase qualification; retain exact-SHA evidence.

5D.1 review checklist:

- Supported and deferred types are explicit; unsupported type/rules combinations must reject.
- Every canonical object has one writer, every power has a bounded scope, and proposed powers are distinguished from existing ones.
- Quote, market and ticket versions bind the accepted economic promise; source and signer changes cannot rewrite it.
- Gross funding, correlated limits, push/void treatment and exactly-once accounting are specified.
- Sources, clocks, corrections, disputes, emergency and bounded recovery have explicit authority boundaries.
- Shared router, settlement, expiry and vault compatibility gaps remain visible; no production capability is enabled.

Future executable evidence must include unauthorized create/open/report/resolve attempts; stale and altered quotes; cross-player/chain/contract/version replays; nonce races; signer revocation; early starts and reschedules; integer/half-line comparisons; overtime differences; incomplete/corrected facts; conflicts and resolver outage; overflow/rounding boundaries; correlated-limit bypass; reserve depletion and withdrawal races; reentrancy and token failures; duplicate settlement; reorg/restart; and full funded WIN/LOSS/PUSH/VOID conservation.

Qualification status: document prepared and checked against the referenced repository primitives. No executable sportsbook tests, CI run, Level 1/2/3 certificate, independent approval or official deployment is claimed. TN-BOOK-00 remains incomplete until the implementation and funded local evidence exist; TN-BOOK-01–05 remain separate release gates.

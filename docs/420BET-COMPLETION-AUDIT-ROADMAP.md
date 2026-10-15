# 420Bet — completion and qualification inventory roadmap

Status: **AUDIT PLANNING / NOT RELEASE QUALIFIED**  
Baseline inspected `main`: `e3955fcd08c8d86087936c90feed9ff6bc79767b` (2026-10-15).  
Scope: all canonically intended 420Bet product verticals. This document is an **audit/remediation tracking supplement**, not permission to supersede earlier architecture, numbered phase roadmaps, frozen addresses, protocol decisions, or accepted security rules. Repository canonical evidence must be reconciled before any implementation claims.

## Non-negotiable coverage

Each existing or planned vertical remains in scope until authoritative repository evidence explicitly de-scopes it. Existing `contracts/src/bet` code is not evidence of public availability. A game engine, web app, and live end-to-end deployment are three distinct acceptance gates.

| Vertical | Evidence on inspected main | Required further work / status |
| --- | --- | --- |
| Dice V1 | `DiceV1420`, view, Dice browser client, tests, local/shared deploy utilities | **PARTIAL** — verify exact-head build/security tests and promoted network wager smoke |
| Keno V1 | Engine, view, tests | **PARTIAL** — inspect guarantees, web experience, deploy + live smoke |
| Plinko V1 | Engine, view, tests | **PARTIAL** — inspect guarantees, web experience, deploy + live smoke |
| Reference Slots V1 | Engine, view, random stream, slot artifact registry, tests | **PARTIAL** — inspect artifact/game bindings, web experience, deploy + live smoke |
| Roulette V1 | Engine, view, tests and release runbook | **PARTIAL/BLOCKED** — release requires promoted manifest, deployed binding verification and live wager smoke |
| Blackjack V1 | Engine, view, tests | **PARTIAL** — inspect hand/state/settlement guarantees, web experience and live smoke |
| Mines V1 | Engine, view/settlement adapters, tests | **PARTIAL** — inspect hidden-board, exposure and settlement guarantees, web experience and live smoke |
| Crash V1 | Engine, view/settlement adapters, tests | **PARTIAL** — preserve auto-cashout-only hardened boundary, web experience and live smoke |
| Video Poker V1 | PR #148, `feature/420bet-video-poker-v1`; foundation not on main | **PARTIAL/STALE** — reconcile branch safely, complete deal/draw/hand evaluator/paytable/settlement/view/tests, UI and deployment |
| **Live multiplayer Poker** | Poker action IDs, Poker product type, table/hand/tournament emergency domains | **MISSING** playable vertical — canonical specification and full implementation required; *not* Video Poker |
| **Poker tournaments** | Tournament-entry action and emergency domain | **MISSING** dedicated tournament implementation; track separately from cash tables |
| **Fantasy sports pools** | Fantasy type, entry permission, entry/contest emergency domains | **MISSING** contest/pool lifecycle and app; not equivalent to sportsbook |
| **Sportsbook** | Sportsbook product type and root README planned scope | **MISSING** dedicated market/odds/settlement architecture and client |
| **Prediction markets** | Prediction action IDs and emergency domains | **MISSING** market lifecycle, outcomes, oracle/challenge/redemption and client |

Status means **not qualified complete** without complete source review, direct tests and exact-SHA evidence. Do not represent any missing subsystem as implemented based only on enum/action identifiers.

## Fixed audit sequence — no silent renumbering

The numbered BET-AUDIT steps below track the **audit and remediation** rather than rewriting existing historical E1/E2/E3 or other canonical game phase IDs. New parallel product requirements use stable suffixes to avoid renumbering.

1. **BET-AUDIT-1 — Canonical source recovery.** Inspect all source/roadmap/spec/Genesis/PR/CI/qualification evidence and document product-vertical scope and explicit release gates.
2. **BET-AUDIT-2 — Full inventory and branch reconciliation.** Map source/tests/config/assets/packages and active/stale branches. Assess PR #148 independently without merging or silently adopting obsolete authority.
3. **BET-AUDIT-3 — Shared protocol security.** Audit `BetAuthorization420`, registries, wagering, bankroll/vault accounting, risk, randomness, settlements, economics and emergency controls for asset conservation, replay safety, bounded authorization, liveness and failure recovery.
4. **BET-AUDIT-4 — Existing casino games.** Independently prove Dice, Keno, Plinko, Reference Slots, Roulette, Blackjack, Mines and Crash rules, adapter agreement, liability bounds, relevant adversarial tests and cross-game convergence.
5. **BET-AUDIT-5 — Remaining game engines.** Finish canonically scoped incomplete games including Video Poker. No substitution of simplified rules to force a passing test.
   - **BET-AUDIT-5A — Live Poker cash games:** authority and cryptographic/private-card trust model; table creation/admission, seats, blinds, buy-in/top-up, turn order/timeouts, bet/call/raise/fold/check, side pots, showdown/hand evaluator, rake if approved, withdrawals, disconnect/rejoin, observers, collusion/fraud defenses, lifecycle/recovery, auditable settlement and real player UI.
   - **BET-AUDIT-5B — Fantasy pools:** contest authorization and format (season/daily/event), escrow/pool conservation, entries/lineups/picks and lock deadlines, roster/eligibility changes, official outcomes and provenance, scoring revisions/finality, ties/prizes, cancellations/refunds, disputes, anti-manipulation, operator UX and participant UI. Determine legal/jurisdictional obligations before activation.
   - **BET-AUDIT-5C — Poker tournaments:** registration, buy-ins, entrants, scheduled start, blind escalation, re-entry/add-ons if specified, seat balancing, elimination, payouts, cancellation/refunds, recovery and authoritative tournament lifecycle; reuse qualifying Poker foundations without creating a second custody engine.
   - **BET-AUDIT-5D — Sportsbook:** versioned events/markets, bounded operator authority, odds provenance, acceptance vs price changes, exposure/liability, event delays, suspensions/voids, reliable oracle result ingestion, challenge/finality, settlement, risk limits and player UX.
   - **BET-AUDIT-5E — Prediction markets:** market creation/approval/open/suspend/close, outcome asset and liquidity accounting, oracle fact reports and challenges, timeout/finality/appeals, split/merge/trade/redeem actions, replay/reorg protections, resolution/invalid-event refunds and trading UI.
6. **BET-AUDIT-6 — User-facing products.** Full responsive accessible wallet-connected UI for each *required* playable vertical, no front-end outcome or custody authority, real transactions and recoverable error/empty/pending states.
7. **BET-AUDIT-7 — Ecosystem and service integrations.** Verify 420Registry, Wallet, Identity/Names, token/Pay, vault/treasury, notifications, analytics, explorers/indexers, oracle, arbitration, governance, and other required links *only where canonical specs require them*; validate reorg-safe indexing, bounded services, and secrets handling.
8. **BET-AUDIT-8 — Deployment and documentation.** Reproducible builds/scripts and ABIs, exact configuration/address mapping, scoped permissions and handover, on-call runbooks, threat models, developer/operator/player docs, smoke and rollback/recovery plans.
9. **BET-AUDIT-9 — Comprehensive pre-release qualification.** Run targeted Level 1 suites for each work step, Level 2 at actual milestones, never redundant repository-wide runs after each change.
10. **BET-AUDIT-10 — One reconciled Level 3 closeout.** Freeze the main-reconciled implementation SHA; run canonical Solidity, Genesis address authority, Integrated and Docs plus affected 420Bet/app integration/security checks; commit exact-SHA evidence only after mandatory jobs pass.
11. **BET-AUDIT-11 — External gates.** Record, *without preemptively claiming passage*, separately verified local, testnet, Genesis and production deployment acceptance; real providers, operators, wallets, observability, regulatory obligations and live transactions. Testnet-dependent work moves to the testnet work roadmap and remains tracked.

## Cross-cutting exit rules

- Every vertical must have a canonical spec, clear actor/trust/custody model, contract/service/frontend inventory, test requirements, deployment dependencies, and evidence-backed status.
- No missing market/poker/fantasy functionality may be treated as a generic casino feature or deferred without a named roadmap item.
- Track development completeness, clean build, contract qualification, integration, documentation, security, testnet readiness, Genesis readiness and production readiness *separately*.
- No mock-only or placeholder manifest can prove live readiness; no earlier-SHA pass can certify later changes.
- All real-money wagering, poker, fantasy and prediction release paths require explicit applicable licensing/regulatory, eligibility, location and responsible-gaming decisions before public deployment.
- Preserve existing three-level phase qualification: Level 1 per step, Level 2 at milestone, Level 3 once at phase closeout.

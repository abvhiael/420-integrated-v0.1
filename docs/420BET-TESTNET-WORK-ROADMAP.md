# 420Bet — Testnet Work & Production Approval Roadmap

**Status:** release gates open; this is a deferred-acceptance ledger, not permission to activate production betting.  
**Authority:** canonical 420Bet architecture, BET-AUDIT sequence, current main, frozen addresses, and app-specific qualification evidence take precedence. This roadmap does not change audit numbering or imply missing products are built.

## Universal release gate — every 420Bet vertical

1. **Qualified implementation:** applicable exact-SHA Level 1/2/3 evidence, finalized interfaces, reconciled main and immutable module/game versions. Outstanding locally executable defects remain in their original audit step.
2. **Independent policy approvals:** documented legal/jurisdictional/age/eligibility assessment, responsible-play restrictions, operator/capability authorization and economics/risk sign-off; approval by the implementation author is not independent approval.
3. **Math and liability:** versioned source inputs, deterministic verifiers, approved RTP/house edge or other product-specific economics (where applicable), cap-aware maximum gross and net liability, fees, bankroll reserves, correlated exposure, reconciliation and independent review.
4. **Promoted configuration and authority:** review-approved reel/game/rule hashes and paytable manifests, registry/module/settlement binding, chain ID and frozen addresses, authorized signers with distinct roles, immutable digests and no bypass of production activation.
5. **Testnet proof:** real deployment transactions and receipts, chain/network identity, runtime bytecode hashes, version and owner/capability bindings, VRF/oracle proofs, successful normal/negative/expiry/dispute workflows, vault and fee conservation, reorg/replay/adversarial smoke, recorded run IDs and evidence hashes. Never substitute mocks for live evidence.
6. **Production acceptance:** independent go/no-go, live configuration and jurisdiction gates, budget/liquidity verification, production change control, monitoring/alerts, incident pause/rollback/refund runbook and authorized post-deploy smoke. No production privileges before all gates pass.

## Product-specific open items

| Product | Required independent production and testnet acceptance |
| --- | --- |
| Dice V1 | Approved distribution, house-edge and payouts; committed verifier, shared-wallet/browser wager smoke, production-equivalent randomness/settlement and liquidity |
| Keno V1 | Independently approved picks/hits paytable, RTP and maximum-liability review; activated versioned authority, exact deployment bindings and wager/settlement proof |
| Plinko V1 | Signed 12-row/13-bucket multiplier approval, distribution/RTP and reserve assessment; authority activation and deterministic path/payout live replay |
| **Reference Slots V1** | **Pending** approved RTP target and tolerance; **pending** independent exact/cap-aware mathematical certification; **pending** risk authority sign-off; **pending** approved reel/symbol/ways/scatter/free-spin, paytable, RTP and maximum-liability artifact hashes; **pending** live deployed code hashes, manifest bindings, randomness, wager/settlement replay and receipts. Candidate 92.996787% RTP is *research sampling only*, never approved production economics. |
| Roulette V1 | Approved wheel/odds/house edge, payout ceiling, manifest promotion, on-chain deployed adapter mapping, real wager smoke (existing runbook applies) |
| Blackjack V1 | Approved strategy/rules, cards/shoe randomness and reshuffle policy, dealer actions, multipliers, wager/hand maximum liability and independent edge modeling; live settlement |
| Mines V1 | Approved board/bomb distributions, revealed/hidden state proofs, cashout policy/multiplier/RTP and bankroll bounds; live reveal/cashout settlement |
| Crash V1 | Approved crash distribution, auto-cashout-only policy and maximum multiplier/risk cap, fairness and timing proofs; real network auto-cashout/void/settlement |
| Video Poker V1 | Once engine is actually implemented and qualified: independently approved deck/hand evaluator, deal/draw odds, held-card payout tables, RTP/liability and live draw/settlement |
| Live multiplayer Poker | Once implementation exists: independently approved rake/fees, collateral/pots/side-pot conservation, private-card authority, collusion controls, real tables/seating/showdown and dispute/recovery |
| Poker tournaments | Once implemented: entry/payout structure, tournament treasury, blindness/seat reconciliation, elimination, cancellations, prizes and live tournament proof |
| Fantasy sports pools | Once implemented: contest eligibility, entry and purse preservation, roster locks, verifiable external outcomes, scoring/revision/finality, prize/refund live proof |
| Sportsbook | Once implemented: pricing/odds provenance, maximum exposures, market halt controls, licensed operators, official outcome oracle/challenge/finality and live book settlement |
| Prediction markets | Once implemented: market/oracle governance, collateral/reserve accounting, invalid resolution/appeals, reorg resistance, trading/redemption and live liquidation/recovery |

## Reference Slots V1 — explicit evidence and handoff

**Local audit PR:** [#678](https://github.com/abvhiael/420-integrated-v0.1/pull/678). Original code test evidence: 58/58 tests across 13/13 mandatory suites at SHA `7402312984efae34da66ad51f5327967f02f1c17`, [run 38930031457](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38930031457). Subsequent executable modifications require scoped evidence against their own exact SHA; do not transpose successful results.

**Research:** `scripts/calibrate-420bet-reference-slot-rtp.py` (floating candidate), `scripts/verify-420bet-reference-slot-integer.py` (integer outcome model, stochastic expectation), `scripts/verify-420bet-reference-slot-approvals.py` (trusted signed-role gate). Reported research estimate **92.996787%** at 1/80 prize scaling over 25,000 spins from [run 38942986984](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38942986984); neither this number nor fixture digest is an authorized RTP target, exact theoretical value or deployed paytable. Gross cap/maximum net reserve in the TEST fixture: 5,000/4,900 units at 100-unit stake. Only actual independent reviewers may issue approval.

**Required external proofs:** economic policy signature selecting a precise target and allowed range; separately signed independent game mathematics calculation against immutable ABI-encoded candidate; separately signed authorized bankroll-risk ceiling, funded reserve and correlated exposure; independently controlled reviewer-key allowlist; network chain identity, approved predeploys/runtime hashes, module registry and artifact receipt digests; randomized wager-to-resolution proof including deterministic feature retriggers, timeout/void, custodian conservation and approval enforcement. Record approver, signer key, policy version, date, exact candidate digest, acceptance result and verification evidence for every gate.

**Blocking rule:** leave all production betting/activation authority disabled unless every applicable independent approval and production proof is complete. Do not promote test-fixture hashes or self-issued signatures. Work needing no live network remains in BET-AUDIT-4.4 and is never silently reclassified as testnet-only.

## Qualification inheritance

Evidence-only ledger/certificate commits may inherit previous exact-SHA executable qualification if their diff changes no contracts, tests, workflows, dependencies, runtime config, or generated input. Revalidate affected suites only for substantive changes. At app-phase boundary run Level 3 once against the final reconciled candidate—not once per step.

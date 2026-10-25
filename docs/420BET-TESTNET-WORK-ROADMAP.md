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
| Mines V1 | Approved 25-cell/1–24-mine distribution and progressive 99%-nominal-return policy; independent mathematical review of rounding/cashout/RTP and maximum exposure; verified **pre-randomness** seed commitments, deterministic board mask/salts/Merkle root, per-cell hidden reveal proofs and post-terminal seed disclosure/board certification **before** canonical fund settlement; provider-withheld-seed timeout and refund acceptance; funded live reveal/explosion/cashout/expiry settlement and bankroll conservation receipts |
| Crash V1 | Approved crash distribution, auto-cashout-only policy and maximum multiplier/risk cap, fairness and timing proofs; real network auto-cashout/void/settlement |
| Video Poker V1 | Once engine is actually implemented and qualified: independently approved deck/hand evaluator, deal/draw odds, held-card payout tables, RTP/liability and live draw/settlement |
| Live multiplayer Poker | **BET-AUDIT-5A.11 - Live Poker milestone qualification: DEFERRED to official testnet acceptance.** Local implementation and Level 2 evidence are retained; live deployment, funded multiplayer hands, independent approvals and operational acceptance remain open. See the dedicated 5A.11 section below. |
| Poker tournaments | Once implemented: entry/payout structure, tournament treasury, blindness/seat reconciliation, elimination, cancellations, prizes and live tournament proof |
| Fantasy sports pools | Once implemented: contest eligibility, entry and purse preservation, roster locks, verifiable external outcomes, scoring/revision/finality, prize/refund live proof |
| Sportsbook | Once implemented: pricing/odds provenance, maximum exposures, market halt controls, licensed operators, official outcome oracle/challenge/finality and live book settlement |
| Prediction markets | Once implemented: market/oracle governance, collateral/reserve accounting, invalid resolution/appeals, reorg resistance, trading/redemption and live liquidation/recovery |

## BET-AUDIT-5A.11 - Live Poker milestone qualification

**Disposition: DEFERRED - official testnet / independent approval required; NOT COMPLETE.**
This roadmap owns the live acceptance work for 5A.11. Preserve the canonical
5A.11 identifier; moving its execution here does not renumber the audit, waive
its gates or mark the Live Poker milestone as passed. The milestone cannot
close until the designated official testnet is active and its required live
receipts and independent approvals exist.

**Retained local baseline:** 5A.10 was merged in [PR #815](https://github.com/abvhiael/420-integrated-v0.1/pull/815)
at `73e38c833593d78887929b8b731fd2b0c44f55cf`. Its exact qualified source SHA is
`833481ea2389c38dd4338bee9af1d515ca8c1f62`, with passing
[Level 2 run 40148187827](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/40148187827):
930 native tests, 90 model tests, 40 funded integration tests and 200 genuine
proof verifications, including a complete nine-player hand. These are local
rules/cryptographic integration evidence, not live testnet or Level 3 acceptance.
Preserve that evidence when source identities match; qualify substantive changes
against their own exact SHA.

| Gate | Required official testnet / independent evidence |
| --- | --- |
| Network and deployment identity | Official network designation, chain ID, genesis/finality policy, available RPC/indexing, funded test accounts, deployment transactions/receipts, frozen component addresses, runtime code hashes and exact source/build/configuration digests |
| Production-equivalent cryptography and authority | Reviewed proving setup and generated verifier/VK identities, real seat-key authority, independently controlled provider/key custody evidence, scoped operator/player/provider/reviewer capabilities and tested revocation; distinct addresses alone do not prove independent control |
| Funded multiplayer lifecycle | Real table creation, seating and player escrow, independently funded provider bonds, initial-deck admission, both authenticated shuffles, recipient possession proofs, encrypted delivery and owner receipts, signed betting/turns/timeouts, authorized reveals, independently checked winners/side pots/rake and canonical atomic settlement; retain successful transaction hashes and receipts |
| Failure and adversarial acceptance | Live unauthorized/replayed/cross-hand input rejection, withheld delivery/reveal and provider-fault recovery, disconnect/reconnection/sit-out/leave, bounded refunds, dispute/appeal handling, duplicate settlement and reentrancy rejection, reorg/finality recovery and escrow/provider/rake conservation evidence |
| Economics, eligibility and abuse governance | Independent game-math/rake/fee and liability approvals; operator, legal/jurisdiction/age/privacy/responsible-play authorization; independently governed collusion/abuse review, monitoring provenance and correction/appeal procedures |
| Operational readiness and milestone decision | Authenticated multiplayer client/transport smoke, ciphertext availability, trusted indexing and independent replay, monitors/alerts, provider outage and pause/recovery drills, incident/runbook ownership, signed independent go/no-go and a durable gate-by-gate acceptance record |

For every live gate, record the network, exact candidate SHA, configuration and
artifact digests, authorized actor/reviewer, transaction/block hashes and finality,
expected versus observed results, evidence location and acceptance decision.
Local fixtures, deterministic test keys, documentation markers and self-issued
approvals cannot satisfy live acceptance.

**Work that can proceed before testnet activation:** deployment/evidence tooling,
runbooks, independent reviews, configuration preparation, local defect repairs
and qualification preflight remain executable work. Moving 5A.11 does not defer
unfinished local implementation or weaken 5A.1-5A.10 requirements. Follow the
three-level qualification model and the inheritance rule below; run phase-wide
Level 3 once against the final reconciled candidate when its prerequisites are
met. A Level 2 result or roadmap move does not grant Level 3/live acceptance.
Keep production wagering disabled until all applicable live and independent
release gates pass.

## Video Poker — production-equivalent draw, economics and settlement acceptance

**Status: BLOCKED pending official testnet and independent authorities.** No simulated tests, fixed test seeds, local deployment, or self-signed policy record substitutes for the following external proofs. The local source implementation is not proof of eligibility to accept real wagers.

| Gate | External dependency and required durable evidence |
| --- | --- |
| Independent replacement entropy | Approved, independently controlled replacement RNG provider and key custody; signed operator/provider identity, non-collusion attestation, separate primary/fallback authority, commitment transaction executed **before initial deal and player hold**, verified hold event and immutable revealed randomness after hold, withdrawal/withholding protections and evidence of delayed entropy timing on the designated official testnet |
| **Independent randomness-control evidence** | **DEFERRED — official testnet / independent authority.** Obtain verifiable provider identity, independent key-custody/control attestations, documented separation from the operator, player and primary/fallback providers, non-collusion review, signed control-policy manifests, and official-testnet commitment/reveal transaction receipts. Distinct on-chain addresses alone do not prove independent control or rule out common beneficial ownership, collusion, or selective withholding. |
| **External randomness authorization** | **DEFERRED — independent approval.** Obtain explicit, independently signed security/risk/operator authorization of the replacement-entropy provider, its ownership and operating policy, custody and outage controls, role separation, revocation and incident procedures, before production activation. No self-issued implementation or fixture approval qualifies. |
| Runtime randomness proofs | Chain ID and predeploy identity, canonical RandomnessRouter profile/manifest, accepted wager and initial-root proof, approved randomness source and signed proofHash/entropyHash, independently verified provider-origin receipt, canonical draw and event receipts, no duplicate/replayed/cross-wager entropy, per-reorg restart and finality evidence |
| Withheld seed / expiry / recovery | Proof of forced timeout and permissionless `SettlementEngine420.voidExpired` stake refund, including unauthorized/late reveal, provider outage, chain reorg, double submission, settlement rollback, dispute evidence retention, operator escalation and customer support |
| Math approvals | Signed exact ruleset, immutable 9/6 Jacks-or-Better five-credit royal bonus paytable and economic policy, independent rigorous full game-strategy RTP/house-edge distribution over every legal hold/draw outcome and rounding rule, documented methodology/digests and adverse-example tests; source code's **stand-pat-only combinatorial baseline is not sufficient** for production RTP approval |
| Liability/funding | Independent approval of maximum gross exposure up to 800x stake at five credits, reserve/risk limit and correlated-exposure model, division/overflow boundaries, bankroll and fee conservation; actual funded escrow/vault transaction and settlement/void receipt on official testnet |
| Governance and activation | Certified role-separated authorization for game/module/resolver registration, static code/runtime hashes, approved versioned paytable and immutable config manifest, chain/deployment manifest signatures, no operator ability to bypass math or randomness approvals, independently signed go/no-go and scoped capability issuance |
| Eligibility | Applicable licensing/regulatory/jurisdiction, legal age/identity and geofence qualification; player restrictions, responsible-play/cooloff/limits, audit records and revocation outcomes; independent legal/privacy/security sign-offs |
| Operational approval | Production-equivalent monitors, key availability, source outage/fallback and timeout drills, billing/chargeback policy, incident pause/recovery/reorg runbooks, dispute and reconciliation records, supervisor authorization, controlled deployment/promotion and post-release checks |
| Safety boundary | KEEP PRODUCTION WAGERING DISABLED until **every** independent and live gate has recorded PASS; an unbound resolver and mock profiles are not production authorization |

**Repository-side work remains distinct:** compilation, scoped adversarial tests, on-chain provider address/role checks, pre-fulfillment entropy sequencing, hold-before-reveal enforcement, replay/withholding/timeout logic, deterministic refund and custody integration, resolver authorization, mathematical formula correctness, complete full-strategy RTP verifier, fail-closed fixture/deployment manifests and integration assertions remain **BET-AUDIT-5.3 local qualification requirements**. The two deferred independence/authorization gates above are external evidence requirements only; they do not excuse locally executable repairs. Neither is marked PASS by this ledger update. Never defer locally executable repairs solely because an official testnet is not available.

## Reference Slots V1 — explicit evidence and handoff

**Local audit PR:** [#678](https://github.com/abvhiael/420-integrated-v0.1/pull/678). Original code test evidence: 58/58 tests across 13/13 mandatory suites at SHA `7402312984efae34da66ad51f5327967f02f1c17`, [run 38930031457](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38930031457). Subsequent executable modifications require scoped evidence against their own exact SHA; do not transpose successful results.

**Research:** `scripts/calibrate-420bet-reference-slot-rtp.py` (floating candidate), `scripts/verify-420bet-reference-slot-integer.py` (integer outcome model, stochastic expectation), `scripts/verify-420bet-reference-slot-approvals.py` (trusted signed-role gate). Reported research estimate **92.996787%** at 1/80 prize scaling over 25,000 spins from [run 38942986984](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38942986984); neither this number nor fixture digest is an authorized RTP target, exact theoretical value or deployed paytable. Gross cap/maximum net reserve in the TEST fixture: 5,000/4,900 units at 100-unit stake. Only actual independent reviewers may issue approval.

**Required external proofs:** economic policy signature selecting a precise target and allowed range; separately signed independent game mathematics calculation against immutable ABI-encoded candidate; separately signed authorized bankroll-risk ceiling, funded reserve and correlated exposure; independently controlled reviewer-key allowlist; network chain identity, approved predeploys/runtime hashes, module registry and artifact receipt digests; randomized wager-to-resolution proof including deterministic feature retriggers, timeout/void, custodian conservation and approval enforcement. Record approver, signer key, policy version, date, exact candidate digest, acceptance result and verification evidence for every gate.

**Blocking rule:** leave all production betting/activation authority disabled unless every applicable independent approval and production proof is complete. Do not promote test-fixture hashes or self-issued signatures. Work needing no live network remains in BET-AUDIT-4.4 and is never silently reclassified as testnet-only.

## Qualification inheritance

Evidence-only ledger/certificate commits may inherit previous exact-SHA executable qualification if their diff changes no contracts, tests, workflows, dependencies, runtime config, or generated input. Revalidate affected suites only for substantive changes. At app-phase boundary run Level 3 once against the final reconciled candidate—not once per step.

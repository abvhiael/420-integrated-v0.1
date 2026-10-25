# 5C.1 — Approved tournament format, registration and lifecycle boundary

## Completion and acceptance scope

The user approved all 25 decisions in [the decision register](BET-AUDIT-5C.1-TOURNAMENT-DECISIONS.md), including the explicit boundary: qualify the immutable policy registry and executable reference registration/lifecycle rules in 5C.1. Actual tournament custody, cryptographically verified hands, table balancing and prize execution are later local Phase C work. Official deployment and live operation require the testnet separately.

The implementation is substantive policy and reference-state code, not a funded tournament host. Only an actual successful clean-SHA `qualify-poker-5c1.py` run establishes local Level 1 acceptance. Documentation, a compile-only job or this page cannot establish a pass. No additional Level 2 or Level 3 milestone is declared for this configuration step.

## Frozen V1 rules

- No-Limit Hold’em foundation; freezeout, re-entry and zero-chip rebuy are separate purchase modes. Scheduled and sit-and-go starts, single-table and multi-table configurations are supported. No mixed-mode add-ons, bounty or satellite extension is implied.
- One active stack per verified person. Re-entry creates another attempt after elimination; rebuy preserves the current attempt. Every purchase has the original price, fee and starting stack, with finite per-person caps and hard cutoffs.
- Paid purchases contribute their whole buy-in to the prize pool, plus a separate fixed 3% development fee, rounded down once when the quote is created. No hand rake. Free purchases have zero price and fee; advertised free prizes require actual prefunding by the later custody executor.
- Minimum starters, sit-and-go starting target and overall entrant cap are independent and frozen. Late registration is configurable for either start type. Table seat limits are 2–9, matching the retained NLHE foundation; overall cap cannot exceed declared seat/table capacity.
- Before the roster/start lock, unregister for a full purchase-and-fee refund. An underfilled event has one published delay, default 30 minutes; thresholds do not fall. Technical first-hand readiness has a separate default 10-minute deadline. Failed unstarted events refund fully, including sponsored prizes to their funder.
- Actual tournament start anchors hard elapsed-time purchase windows; an optional earlier blind-level cutoff can close them sooner. Pauses never extend these cutoffs. A zero-chip rebuy choice has a default 60-second timer, bounded by the overall cutoff.
- Accepted purchases reserve capacity atomically. Activation occurs at a safe boundary within a frozen readiness deadline; payment must precede the purchase cutoff, but an already-paid activation may finish later. Expired/unseated purchases refund fully, retain replay-protection history and do not inflate unique-player payout bands or consume successful chip-purchase caps.
- A pause stops new purchases, retains an original recovery clock (default 24 hours) and cannot reset it by repeated pause/resume. Scheduled breaks and a future independently authenticated incident-recovery mechanism are separate gameplay concerns. Recovery expiry requests the frozen qualified recovery policy; it does not grant an operator a refund or prize vector.
- Disconnect/sit-out/leave does not remove a stack, avoid blinds or enable cashout. Ordinary timeout check/fold behavior applies, and all-in showdown eligibility survives disconnect.
- Resolve pending hand, accepted admission and eligible rebuy decisions before declaring a sole survivor candidate. Then close purchase windows even if their clocks had time remaining. Payout bands use unique players actually admitted to play, one final finish per person. Fees remain held until qualified final settlement.

Only underfill (1,800 seconds), technical readiness (600), rebuy choice (60) and recovery (86,400) have approved defaults. Buy-in, starting stack, field sizes, registration dates, admission readiness, windows, purchase caps, payout/recovery/blind/seating policy references are explicit configuration. Test fixture numbers are not launch presets.

## Executable ownership

| Component | Implemented responsibility | Authority boundary |
| --- | --- | --- |
| `PokerTournamentPolicy420` | Validate configuration, supported format combinations, integer widths/capacity, chronology, finite windows, exact fees and deadline arithmetic | Pure policy mathematics; no authentication or asset movement |
| `PokerTournamentPolicyRegistry420` | Context-bound digests, canonical capability/operator authorization, approval/publication/retirement, immutable historical settings and quotes, with expired-event new-use previews rejected | Non-custodial metadata; `PUBLISHED` never means funds or gameplay authorized; `acceptsFunds()` is false |
| `tournament/lifecycle.py` | Deterministic reference registration, locks, delayed starts, nominal refund conservation, queued admission, extra-purchase caps, generation/nonce rules, cutoff/choice/recovery clocks, frozen hand-blind observations and finalization candidates | Trusted-host model. Caller-supplied identity, level, seating, stack and hand observations are not cryptographically verified here. Outputs cannot authorize a transaction or a live winner |
| Later qualified tournament executors | Actual verified identity/control, responsible-play limits, asset deposits and liabilities, authenticated hands/seats, elimination/rebuy evidence, balance conservation, independent ranking and prize transfers | Must bind the exact published policy and genuinely verify all canonical observations before acting |

A pure model can check that a proposed hand outcome conserves chips; that does not establish the outcome is true. The model accepts no card proofs, does not manufacture acceptance receipts, and never exposes arbitrary prize-payment or winner-setting authority. No test in this step substitutes a synthetic fact for genuine tournament-hand qualification.

## Reference lifecycle

| State | Permitted progression |
| --- | --- |
| Registration | Accept eligible initial requests; retain refundable reservations. Scheduled lock at the original time or qualifying delayed threshold; sit-and-go lock when target fills |
| Delayed | One fixed underfill window; unchanged threshold; start readiness or full cancellation/refund |
| Starting | Frozen initial roster and technical deadline; authenticated-host first-hand observation or full unstarted cancellation/refund |
| Running | Safe-boundary admissions, applicable hard windows, genuine-host hand observations, eligible zero-stack choices, ongoing presence/timeouts |
| Paused | No new purchases; existing liabilities/hand observations preserved; recovery or original-deadline expiry |
| Recovery required | Later qualified recovery policy must resolve real assets; no default operator payout |
| Finalizing | Sole-survivor candidate after pending work closes; later canonical finality, unique ranking and prize executor are required |
| Cancelled | Unstarted nominal reservations and sponsor amounts fully credited; replay/cashout cannot recreate an event |

The reference deliberately stops at a finalization candidate. It does not simulate successful prize execution or pretend an actual tournament is complete. Real completion and post-start recovery require later qualified executors. Original cash-hand proof/context bindings remain unchanged, and their existing qualification is not relabelled as tournament evidence.

## Scoped qualification

`python scripts/bet/qualify-poker-5c1.py --output <fresh-directory>` executes:

- All 36 native policy/registry tests, including real canonical capability and operator contracts, a genuine Wrapped420 asset identity, revocation, scoped authority, immutable publication, context isolation and two 2,500-case arithmetic/cutoff fuzz tests.
- All 43 reference-model tests, including 1,000 randomized nominal refund-conservation sequences. These are model tests, not funded-chain or verified-hand tests.
- A successful legitimate registry-publication trace exporting actual deployed runtime code hash, policy digest, ruleset and asset/authority/operator addresses.
- Solc 0.8.30 source/compiler identity and normal EVM runtime/init-code limits for compiled non-test artifacts. Foundry's normalized source hashes and exact checkout file checksums are both retained.
- Actual Slither 0.11.6 analysis. Its single reviewed Medium exact-fee quotient/remainder finding retains raw severity and a source-bound disposition. Unknown or duplicate severe findings and source drift fail qualification.

The source scope must be tracked, clean and reconciled with recorded main. The acceptance certificate is written only after every mandatory execution succeeds. Raw outputs, deployed identity, compiler metadata and SHA256 evidence are retained. The workflow runs the same executable at the checked-out SHA. CI acceptance is claimed only if a run actually executes and passes.

## Local follow-on and external gates

Later local Phase C work must implement canonical tournament registration/prize custody, authenticated zero-stack and elimination evidence, hand-scoped blind snapshots, table assignment/balancing, independent outcome/ranking, final prize/refund execution and their funded adversarial qualification. These are not deferred merely because testnet is unavailable.

Official network binding/deployment, independently controlled providers and authorities, prospective funded tournament operation, finality/reorg proofs, operational custody and independent security/risk/legal activation belong to the testnet/production roadmap. This 5C.1 acceptance enables none of them. Preserve existing cash NLHE contracts, verifiers/proofs and fantasy evidence; no unrelated global rerun or repair is part of this step.

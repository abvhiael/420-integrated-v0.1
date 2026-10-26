# 5C.3 — Starting stacks, blinds and level progression

## Rules established for this implementation

The user requested establishment and full implementation of this step. The existing [5C.1 decisions](BET-AUDIT-5C.1-TOURNAMENT-DECISIONS.md) and [5C.2 funded-entry boundary](BET-AUDIT-5C.2-ENTRY-ACCOUNTING.md) remain binding. The user explicitly approved the configurable frozen schedule (including a common table clock, per-hand blind snapshots and a held final level), no antes initially, and freezing blind progression during pauses while hard registration/rebuy deadlines keep running.

| Rule | Established behavior | Basis |
| --- | --- | --- |
| Starting stack | Explicit positive integer chip amount for each event; initial entry, re-entry and rebuy retain the same original amount | Existing C1-D04; no default numeric launch stack |
| Structure publication | Complete immutable timed schedule and stack, registered, approved and published through canonical capabilities; bind the exact digest into the policy before registration | Requested 5C.3 implementation; inherited frozen-policy requirement |
| Blind amounts | Positive integer small blind and exactly twice that big blind; nondecreasing across levels; equal consecutive levels allowed | Retain the existing qualified NLHE engine's 2:1 convention; no cash-engine source modification |
| Ante | Zero in this version, explicitly queryable; no ante setter or concealed charge | Explicit user approval; preserves the inherited no-ante engine |
| Level progression | One playing-time clock shared by all tournament tables; direct deterministic lookup catches up across missed boundaries; the next level applies at its exact boundary | Explicit user approval; no operator-selected level overrides |
| Final level | Hold its published blinds until genuine completion, even after its nominal duration | Explicit user approval; duration expiry never selects a winner |
| Pause | Freeze effective blind playing time while blocking new hand locks; hard purchase/registration clocks continue in wall time | Explicit user approval plus existing C1-D13/C1-D22 |
| Recovery | Freeze the configured recovery limit at clock initialization; preserve the original first-pause deadline across repeated pauses; expiry fails closed | Existing C1-D22 and retained 5C.1 reference semantics |
| Hand snapshot | Bind host, chain, event context, schedule content, table, hand, actual start anchor, level and blind amounts; retain that snapshot for the full hand | Existing 5C.1 integration finding; prevents mid-hand minimum-raise changes |
| Short stacks | Cap mandatory blind commitments at available chips, conserving every seat; the nominal big blind in the hand snapshot remains unchanged | Existing qualified NLHE convention; no extra rake or ante |

All level amounts and durations are explicit. Test values (including 1,000 chips and 5/10 blinds) are fixtures, not launch presets. Arrays are limited to 256 levels for bounded gas; durations are positive uint32 values and totals are checked uint64 values. The first stack may be smaller than a blind, resulting in a short all-in commitment rather than an invented minimum buy-in rule. Levels cannot lower blinds. Scheduled break barriers and independent future recovery incidents need the later table/hand coordinator; an arbitrary pause cannot reset this version's original recovery deadline.

## Working native components

`PokerTournamentStructureBook420` uses the real canonical policy, operator and authorization modules and the actual 5C.2 escrow. Structure digests bind chain, book, policy registry, escrow, asset, structure ID, operator, starting stack and full schedule. Policy binding requires the identical stack/digest/operator/publisher and valid optional level cutoffs. Event binding must happen before registration opens and before any receipt exists. Neither binding can be replaced.

A payer with event-scoped reservation authority can reserve the exact stack in an actual active, paid initial-entry receipt. Person, original payer, receipt and persistent purchase nonce remain bound; there is no mint-by-amount API and no second active receipt for the same person. Free funded/sponsored events use the same chip logic. Chips have no $420 redemption value, and reserving them moves no prize or fee assets.

Refunded/cancelled/expired receipt projections become invalid immediately through `reservationLive`, including without a keeper tick. Cached `reservedChips`/`reservedPlayers` counters are reconciled by permissionless per-receipt cleanup; they are not live-hand authority or token liabilities. `reserveAfterCleanup` permits bounded stale-receipt cleanup and a replacement reservation atomically, without displacing any live player. Refunded and repurchased receipts retain distinct history and one current person reservation. An existing paid reservation may be processed throughout a longer technical-readiness grace even after the new-event/underfill deadline has closed. Cancellation and actual refunds remain owned by the canonical escrow.

`PokerTournamentStructure420` implements the native clock, frozen recovery/table-capacity/schedule parameters, level selection, context-bound hand locks, immutable hand snapshots, table/hand replay protection, active-hand completion barrier and capped blind-posting arithmetic. New hand locks fail while paused, in recovery or finished; an existing hand can still close while paused. A caller cannot substitute another schedule, rewind the committed clock, reuse a hand, overlap hands at one table, borrow another event clock or exceed the frozen active-table cap. Blind posting handles heads-up button/small-blind placement and sparse multiway seat order without debiting nonparticipants.

## Genuine integration boundary

The library is an internal component for a future qualified host. That host must authenticate first-hand time, identities, seat/table assignment, clock controls and finalized outcomes, and must consistently own one clock/hand store per frozen event context. Caller-supplied timestamps in native mechanics tests are mathematical inputs, never genuine poker evidence. There is no new card-proof verifier, always-accept verifier or fabricated cryptographic receipt.

The book cannot start an actual tournament, post blinds into the cash ledger, consume a Groth16 proof, activate gameplay-dependent purchases, migrate deposits, change an existing stack or release prizes. Its `liveHandIntegrationEnabled` and `acceptsFunds` are false. The 5C.2 escrow remains unchanged and refunds unstarted registrations at its frozen timeout. Reservation original-payer metadata does not replace current controller/seat-key authentication. Later local Phase C work must integrate actual tournament hand/chip accounting and use the same stored hand big blind on every betting street; changing the cash table getter dynamically is unsafe and is not done here.

## Focused qualification

The executable `scripts/bet/qualify-poker-5c3.py` requires a tracked clean exact SHA reconciled with main `6a06b54b1c182411ab2ea46586989ab1cadde76e`, rejects changes outside this step and preserves inherited source identities. It runs:

- Level 1: 36 native clock/snapshot tests and nine blind-arithmetic tests, including 7,500 fuzz cases. Both native sources receive actual pinned static analysis; unknown severe findings or source drift fail closed.
- Level 2 for this component: 46 actual funded structure/starting-stack reservation tests, including 2,500 generated funded reservation/refund sequences. These use real canonical Wrapped420, Identity420, policy/operator/capability modules and the real 5C.2 escrow. A successful funded trace exports deployed book runtime hash, immutable structure/event digest, reserved chips and actual asset liability.
- Inherited scoped regression: 36 5C.1 native tests, 60 5C.2 native tests and 43 reference lifecycle tests, with their original sources and evidence preserved. No unrelated global or arcade qualification is requested.

Expected inventory: 230 test methods, 20,000 native fuzz cases and the retained 1,000 randomized nominal reference cases. These are mandatory counts, not documentation success markers. A certificate is emitted only after actual successful execution, compiler/source/ABI/code-size/runtime checks and exact-source static dispositions. Raw inherited analyzer severities are retained; local dispositions are not independent security approval. Official deployment/finality, live tournament play, genuine hand/blind-posting integration, final prize execution, independent security and full-platform Level 3 acceptance are not implied by this component qualification.

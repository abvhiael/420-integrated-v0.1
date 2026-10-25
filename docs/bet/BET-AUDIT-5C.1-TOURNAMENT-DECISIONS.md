# 5C.1 — Tournament formats, registration and lifecycle

## Status and scope

The 25 product decisions below are approved. The approved-scope implementation is complete; only an actually executed clean-SHA certificate establishes its qualification status. This is not a qualification certificate or permission to launch tournaments. The original baseline was main `3a4a74f885814370732435b0cd147d2da37cbc92`; qualification reconciles main `08b38c077149b60e850f9daea4ea51652d293a52`. The user requested completion of 5C.1, starting with its decisions. Qualification follows the approved rules, implementation and actual scoped execution; no test has passed merely because this record exists.

The repository has qualified cash-game poker components, but no tournament implementation. `PokerTableRegistry420.RULESET` is cash NLHE, `PokerSeatLedger420` backs every cash chip with escrowed assets, and canonical hand settlement debits that actual cash ledger. Tournament chips and tournament prize custody require separate authority and accounting. Cash-game green tests and genuine cryptographic evidence remain valid only at matching source/context identities; they are not tournament acceptance evidence.

## Approved decisions

| ID | Decision | Authority |
| --- | --- | --- |
| C1-D01 | Include re-entry and rebuy formats in the initial tournament scope; do not restrict V1 to freezeout. | User selected initial re-entry/rebuy support. |
| C1-D02 | Rebuy only at zero chips, within the published window and between hands. One verified person has one active stack. Re-entry creates a fresh entry after elimination; rebuy preserves the current entry. | User accepted the recommended zero-chip rebuy conditions. |
| C1-D03 | Publish and freeze configurable finite per-player re-entry/rebuy limits and purchase cutoffs before registration. Reject purchases after cutoff. | User selected configurable capped limits. |
| C1-D04 | Identical buy-in, fee and starting stack for initial entry, re-entry and rebuy. Discounts, double-stack purchases and add-ons are later extensions. | User selected the same-price/fee/stack rule. |
| C1-D05 | Support scheduled events at published times and sit-and-go events when the configured initial target fills, across the three purchase formats. | User selected both start types. |
| C1-D06 | Support single-table and multi-table tournaments; freeze table capacity and overall field limits before registration. Table balancing needs its own gameplay qualification. | User selected both topologies. |
| C1-D07 | For paid events, 100% of each buy-in goes to prize escrow; quote a separate 3% development-fund fee on every purchase. No per-hand rake. | User selected the recommended 3% model. |
| C1-D08 | Late registration is configurable for either scheduled or sit-and-go events. New-person late registration and existing-person re-entry/rebuy are distinct operations. | User selected configurable late registration for either start type. |
| C1-D09 | Minimum starters, sit-and-go initial target and overall entrant cap are separately configurable and frozen. A late-registration sit-and-go target can be below its overall cap. Scheduled events require their minimum at start; sit-and-go events require the target. | User selected separate configurable limits. |
| C1-D10 | Unregister before the published roster/start lock for a full buy-in-plus-fee refund. No entry or arbitrary chip-stack cashout after that lock; cancellation/recovery follows frozen rules. | User selected full refund before lock. |
| C1-D11 | Support paid $420 and free events. Advertised free prizes are fully funded in escrow before registration; free initial/re-entry/rebuy purchases have zero fee. | User selected paid and prefunded free events. |
| C1-D12 | Initially only platform-authorized operators publish events. Support future scoped delegation to verified organizers; ordinary players cannot publish initially. | User selected authorized operators initially. |
| C1-D13 | Every late-registration/re-entry/rebuy window has a configurable hard elapsed-time limit from actual tournament start, optionally shortened by an earlier published blind-level cutoff. Earlier limit wins; pauses do not extend the hard deadline. | User selected the hard-time-plus-optional-level rule. |
| C1-D14 | At a certified zero-chip boundary, a rebuy player gets a configurable choice timer, default 60 seconds. Complete the purchase before both this timer and the overall rebuy cutoff, otherwise eliminate the player. Other tables may continue. | User selected the configurable 60-second default. |
| C1-D15 | An underfilled scheduled event or sit-and-go may use a published delayed-start policy rather than immediate cancellation. | User chose a published delayed-start policy. |
| C1-D16 | Once ready, allow configurable technical readiness grace, default 10 minutes. Without a verified first hand before expiry, cancel and refund fully. No retrospective deadline extension. | User selected the configurable 10-minute default. |
| C1-D17 | Underfill delay is one bounded grace window, default 30 minutes, published in advance. Keep registration open and retain the original minimum/target; start when met or cancel/refund at expiry. | User selected the one-window, 30-minute default. |
| C1-D18 | At a sole remaining player, resolve any eligible pending rebuy timers, then atomically close registration/extra-purchase windows and finish. No entry can reopen a completed event. | User selected close-windows-and-finish. |
| C1-D19 | Final unique verified players determine payout-place bands. Extra purchases add prize funds but no duplicate finishing positions or extra paid places. Each person has one final finish. | User selected unique-player payout bands. |
| C1-D20 | Development fees remain escrowed until completion or qualified cancellation/recovery determines refunds. No early fee withdrawal. | User selected final-settlement fee escrow. |
| C1-D21 | Late entry, re-entry and rebuy reserve capacity atomically and activate only at a safe hand boundary. If not seated within a published readiness deadline, refund that purchase plus fee fully. Never alter a live hand. | User selected bounded safe-boundary admission/refund. |
| C1-D22 | Pause stops new registration and chip purchases while hard cutoffs continue. Freeze a recovery deadline from the original pause, default 24 hours; repeated pauses do not reset it. Expiry uses the frozen qualified recovery policy, never an operator-selected payout. | User selected the bounded 24-hour default. |
| C1-D23 | After start, disconnect, sit-out or voluntary leave retains the tournament stack under mandatory blinds and normal timeout check/fold rules. No chip cashout. Valid all-in showdown eligibility is retained. | User accepted the recommended continuing-stack rule. |
| C1-D24 | Freeze payout and post-start recovery/cancellation policies before registration. No operator-selected winners or payout vectors. Qualify the 5C.1 policy registry and executable registration/lifecycle rules; genuine hand integration, table balancing and prize execution remain later Phase C work. | User explicitly approved this 5C.1 qualification boundary. |
| C1-D25 | Round the fixed 3% fee down once in smallest $420 units. Refunded/unseated registrations do not increase final unique-player counts. Payment must be accepted before the purchase cutoff; already-paid activation may occur later at a safe boundary within its frozen readiness deadline. | User approved all three final accounting/activation interpretations. |

C1-D01 expands initial purchase mechanics. The initial presets are freezeout, re-entry and rebuy. Mixed re-entry-plus-rebuy events, bounty formats, satellites and unasked numeric configurations remain unapproved; add-ons are explicitly deferred by C1-D04.

## Implementation and qualification work

- Complete the common policy registry and executable registration/lifecycle reference rules against the approved decisions.
- Execute scoped native, authority, configuration, clock, replay and reference-model tests at one clean SHA; retain compiler/source/runtime/checksum identities and raw results.
- The 5C.1 registry is deliberately non-custodial and the reference model assumes an authenticated host. No successful model observation establishes real identity, a genuine poker hand, a verified chip balance, funded registration or a prize claim.

Later tournament gameplay, blind scheduling, table balancing, elimination ranking and prize settlement must consume the frozen 5C.1 policy and genuine canonical evidence. Their integration is not implied by a registration state machine. Official deployment/live acceptance remains a separate testnet gate.

## Non-negotiable engineering invariants

- Tournament chips cannot be cashed out or treated as cash-table chip escrow. Prize assets remain separately conserved; a chip purchase cannot mint prize funds.
- Freeze chain/contract/tournament/version, asset, price/fee/chips, registration/start/cutoff windows, capacity, purchase caps and cancellation authority before accepting registration funds. No retrospective reinterpretation.
- Authenticate the verified person and controlling wallet; reject duplicate active stacks, stale/cross-tournament requests, replayed purchases and over-cap admissions atomically.
- Only finalized canonical hand evidence may establish zero chips or elimination. An operator declaration, caller-supplied chip balance or an always-accept adapter cannot authorize a rebuy, re-entry or outcome.
- No mid-hand top-up, seat replacement, withdrawal or profile change may mutate a committed hand. Pending recovery and settled elimination must be distinct states.
- Emergency controls can stop new risk while preserving existing liabilities and recovery rights. Operator or dealer roles cannot seize prize escrow or invent a final result.
- Source/authority epochs, fixed deadlines, idempotent receipts and exact asset-delta checks must survive concurrent last-slot purchases, cancellation races and revoked capabilities.
- Reuse genuine proving material only for matching public statements and identities. New tournament contexts must not be accepted using unrelated cash-hand proofs.

## Qualification acceptance requirements

Level 1 must execute approved-policy validation, lifecycle transitions and adverse vectors: malformed/flexible configuration, deadline boundaries, replay, duplicate identity/stack, cap exhaustion, unauthorized zero-chip/elimination evidence, cross-context statements, revocation and emergency recovery.

If 5C.1 implements registration custody, Level 2 must also execute actual funded local registration, allowed/rejected rebuy/re-entry purchases, exact cancellation/refund accounting and race scenarios with canonical asset/identity/capability modules. No cryptographic mocks or fabricated acceptance. A policy-only test cannot be labelled funded tournament gameplay or settlement qualification.

Freeze and qualify an exact SHA, retain raw execution and checksum/identity evidence, reconcile current main and preserve unchanged inherited evidence. Level 3 remains the later phase boundary. No unrelated global qualification or documentation reruns are authorized by this step.

## Decision closure

All product questions for this step are resolved. The approved scope is policy/configuration publication and executable registration/lifecycle rules, not a funded tournament engine. Later Phase C steps must qualify actual custody, verified hand integration, table balancing and prize execution against this frozen boundary.

## Integration finding from the retained cash implementation

The cash engine debits each hand from `PokerSeatLedger420`, reads fixed cash-table blinds and settles back into the same redeemable-chip ledger. Cash disconnect/sit-out/leave intents can exclude a seat from the next hand or redeem it after settlement. Tournament continuation, blinds, elimination, rebuy and exit require different rules: a registered tournament player cannot redeem an arbitrary stack, skip mandatory blinds indefinitely by disconnecting, or convert cash recovery into an arbitrary prize withdrawal. A separately qualified tournament integration must preserve genuine card proofs and hand finality while consuming the frozen tournament policy. 5C.1 must label its policy/registration evidence separately from that later gameplay integration; it cannot claim a live tournament merely by reusing cash ABIs.

The current cash engine also reads the table's fixed big blind again when opening later betting streets. A tournament adapter cannot simply make that getter dynamic: it must snapshot the blind level and blind amounts at each hand start and use that same snapshot throughout the hand. A level increase cannot change the minimum raise during a committed hand.

## Implemented common core

`contracts/src/bet/tournament/PokerTournamentPolicy420.sol` validates the approved format combinations, independent starter/target/cap values, 2–9-seat table bounds, required policy references, finite extra-purchase limits and hard cutoff arithmetic. `PokerTournamentPolicyRegistry420.sol` uses the actual canonical capability and operator registries for scoped, immutable policy publication and retirement. Its published configuration is metadata, not funding, gameplay or prize authority; `acceptsFunds()` is false.

The approved fee quote rounds 3% down once in smallest token units when the fixed purchase quote is created. Every identical purchase uses that same quote. Missing gameplay integrations do not use an always-accept verifier or an arbitrary winner endpoint.

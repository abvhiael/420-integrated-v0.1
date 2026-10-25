# Daily NHL contest engine V1

This is the consolidated specification for the daily-points format inside 5B.1. It supersedes the running discussion's older open/proposed markers for rules approved later. It does not select salary-cap, season-long or pick'em rules. Runtime implementation is in `contracts/src/bet/fantasy/`; live NHL ingestion and official deployment remain separate acceptance gates.

## Frozen product rules

| Subject | V1 rule |
| --- | --- |
| Sport and scope | Platform-published NHL slates with immutable game, schedule and position snapshots |
| Creation | Authorized platform administrators initially; no public user-creation enable switch |
| Access | Public or invite-only, selected before opening; invitations do not remove accepted entries |
| Roster | Seven unique athletes: C, LW, RW, D, D, G, FLEX; FLEX accepts C/LW/RW/D only |
| Construction | No salary cap, team minimum/maximum, bench or post-lock substitution |
| Entries | One per canonical verified user per pool; separate pools allow additional entries |
| Entrants | At least two at lock; optional immutable cap, otherwise uncapped within uint64 indexing |
| Entry changes | Owners may edit before lock; no voluntary withdrawal after accepted funding |
| Visibility | Encrypted submissions and salted commitments before lock; plaintext publication after lock |
| Lock | First originally scheduled puck drop, exact UTC frozen before entry; no delay-based extensions |
| Early start | Immediately close on authenticated early-start reporting; accepted entries/edits at or after evidenced early start cancel the affected pool |
| Individual DNP | Verified non-participation scores zero; no automatic replacement or individual refund |
| Asset | One deployment-bound canonical $420 asset for entry, prizes, refunds and fund allocations |
| Free pools | No entry payment; monetary prizes require full launcher escrow at creation; otherwise standings only |
| Paid pools | Common fixed entry amount; 3% of gross accepted entries to development compensation, remainder to prizes |
| Payout schedule | Immutable entrant-count bands covering every permitted count from three upwards |
| Exactly two | Winner-take-all override; tied winners split the whole distributable prize |
| Ties | Combine exact prizes for occupied ranks, including unpaid ranks, and split across tied entries |
| Minimum failure | Fewer than two entrants cancels and refunds all payments, with no retained fees |
| Ordinary cancellation | Refund full paid entries, return launcher prize escrow, distribute no development allocation |
| Correction period | 24 hours after conclusive slate resolution |
| Challenges | Next 24 hours; 50% of paid entry amount or 10% of free pool's original prize as a separate bond |
| Challenge result | Upheld returns full bond; denied sends full bond to community fund; unresolved cancellation returns bond |
| Resolution limit | 72 hours after original challenge close; no delegation/correction extends it |

The entry fee and payout policy are published before opening and bound to the immutable pool manifest. Administrators cannot change roster, fee, payout, cap, source policy, scoring or slate after accepting entries.

## Scoring profile

All pools in this engine version use `420.FANTASY.NHL.DAILY.PICK6_INSPIRED.V1`; creators cannot supply weights. Scores use signed integer tenths of a fantasy point.

| Fact | Tenths |
| --- | ---: |
| Goal / assist | 85 / 50 |
| Shot on goal / block | 15 / 13 |
| Shorthanded goal or assist | Additional 20 |
| Shootout goal | 15, separately from ordinary goals/shots |
| Hat trick / 5+ shots / 3+ blocks / 3+ goals-plus-assists | Additional 30 each |
| Goalie win / overtime loss | 60 / 20 |
| Goalie save / goal against | 7 / -35 |
| Goalie shutout / 35+ saves | Additional 40 / 30 |

Each milestone applies once per athlete per game; different milestones stack. Ordinary goals and assists apply to goalies too. There is no additional power-play award, hits/PIM/plus-minus scoring or floating-point rounding. Shootout goals never create ordinary goals, shots, saves, goals against or milestone points.

Shutouts require verified play, the whole game, sole-goalie status and zero ordinary goals against; inconsistent or omitted eligibility awards are rejected. Win/overtime-loss and all other real-world facts require authoritative statistics; the scorer does not infer them from team scores. Missing fields or `complete=false` are invalid, not zero. A verified DNP must have all statistics/award flags zero. Each statistic leaf includes slate, revision, athlete, game and the complete typed statistic record, with a double-hashed leaf and sorted-pair Merkle proof.

## Game eligibility and source precedence

The scoring cutoff is the exact prepublished UTC instant corresponding to the end of 11:59 p.m. America/New_York on the day after the slate's last originally scheduled game. Midnight of the following day is exclusive. The publisher must verify the IANA timezone/DST conversion; EVM timestamps do not implement timezone databases. Later schedule changes never extend the cutoff.

Count regulation and overtime. Postponed/suspended games count in full only if completed within the window; otherwise all their statistics are excluded. Officially final shortened games count as played without prorating. An early excluded disposition requires authenticated definitive cancellation; a mere postponement cannot be excluded before the fixed cutoff. Eligible final declarations must occur before the cutoff. Exclude all games and the pool refunds everyone.

Source precedence is official NHL records/corrections, then Sportradar, then SportsDataIO. Reconcile event/athlete mappings, metric definitions, units and revision times before treating values as a substantive disagreement. Secondary fallback is allowed only under the frozen policy's primary-unavailable/invalid condition, never because a secondary result is preferable. No averaging, opportunistic field selection or post-cutoff corrections. Conflicting highest-priority evidence fails closed.

`FantasySlateBook420` accepts domain-bound canonical `IOracle420` reads for early starts, complete game dispositions and statistic roots. These are actual canonical router reads, not observation-submission success markers. Immutable source-policy identity is included in the slate/pool/report domains. The client library implements selection over already authenticated normalized snapshots. It does not fetch, license or authenticate a vendor API by itself. Production reporting still needs licensed endpoints, provenance, complete field mapping and independent source/control review. Native qualification uses explicitly synthetic NHL-shaped statistics with real signatures, hashes and router quorum execution; it is not live NHL evidence.

## Deployed module boundaries

| Module | Responsibility |
| --- | --- |
| FantasySlateBook420 | Platform publication, immutable roster/schedule, canonical game timing and data reports |
| FantasyAdmission420 | Exact verified-user credentials, current identity control, immutable validator receipts and position checks |
| FantasyNHLScoring420 | Actual Merkle verification and deterministic scoring from complete game statistics |
| FantasyPayoutPolicy420 | Immutable count bands, coverage/weight validation and two-player override |
| FantasyRankingBook420 | Checked score ordering, bounded tie grouping, exact entitlements and payout commitments |
| FantasyContestEngine420 | Pool lifecycle, entry/prize custody, encrypted entry/edit records, publication and final settlement/refunds |
| FantasyDisputeController420 | Separate challenge-bond custody, verified adjudication/delegation, finality and timeout recovery |

The engine constructor creates its admission, payout-policy and ranking modules. It pins the scorer's actual runtime implementation and checks shared authorization/oracle identity with the slate book. Every deployed runtime must fit 24,576 bytes; engine initcode must fit 49,152 bytes and the tested constructor budget is 16 million gas. Module code hashes must be recorded from actual deployed instances, including immutable constructor bindings.

## Identity, authority and confidential submission

The configured Identity420 issuer supplies a canonical-person claim in a verified user credential of the required type. The engine enforces one entry per issuer/person key across profiles and wallets. Entry additionally requires the existing BET_FANTASY_ENTER capability scoped to the pool and entry amount. Edits recheck current controller and pool entry authority; revocation cannot confiscate an accepted entry or its refund. This is an issuer-backed uniqueness policy, not a cryptographic proof of personhood. Unknown, revoked or wrong-subject credentials fail closed. The original entry account remains its fixed payout/refund beneficiary; controller rotation can authorize edits without redirecting escrow.

The host is a real implementation of `IFantasyDisputeHost420`, including interest and current-candidate checks. A resolver must register a valid canonical-user credential as well as satisfy the dispute controller's exact resolver credential/capability checks. Entrants, linked canonical identities, the launcher and recorded conflicts cannot adjudicate. Unknown resolver identity links fail closed. Hidden beneficial-control relationships still need investigation.

Publish the custodian X25519 public-key hash, frozen Ethereum validation signer and canonical custodian control group with the slate. The custodian group cannot enter its own slate's pools. Grant the validation signer only the slate-scoped validation capability. A newly granted signer cannot replace the frozen signer for an existing slate; revocation stops new admissions/edits. Key replacement requires a new slate version.

Client submissions use X25519, HKDF-SHA256 and AES-256-GCM. The envelope binds pool, subject and nonce as authenticated context. Fresh ephemeral keys, nonces and 32-byte random commitment salts are required in production. `validate_and_sign` decrypts the actual envelope, checks its published key, position legality and commitment, then emits only the domain-bound secp256k1 receipt. Receipt domains include chain, engine, pool, manifest, user identity, commitment, nonce, expiry and ciphertext hash. Before lock, the public contract holds only an encrypted envelope and salted commitment, never plaintext athlete IDs.

The initial custodian is a trusted platform data processor. It must keep plaintext/key material confidential, must not participate through another identity, and must persist each accepted latest plaintext for timely publication. This is not trustless/ZK lineup admission. All plaintext rosters are independently validated on-chain after lock, so a malicious receipt cannot produce an invalid winning roster. Invalid attestations or missing publication cancel the entire pool instead of letting an entrant selectively reveal after results.

The implementation fixes a one-hour publication window after effective lock, committed before entry. This is an operational V1 default chosen to bound custody failure, not a new entrant-controlled option. Publication is permissionless given the matching plaintext/salt and never requires an entrant action. Platform release monitoring, encrypted backups and separation from participant access are production prerequisites.

## Lifecycle and bounded computation

`OPEN -> LOCKED -> REVIEW -> SETTLED`, with pre-final failure transitions to `CANCELED`.

1. Publish the schedule and roster in batches of at most 64 athletes, then seal the complete snapshot before any pool can open. Publish a validated payout policy. Administrator creation atomically funds any free prize and registers the real host with the dispute controller. The engine needs the controller's contest-scoped REGISTER capability for that pool.
2. Accept exact $420 funding together with an authorized encrypted receipt; failures revert payment and membership together. Pre-lock edits update the existing nonce/commitment without another entry or payment.
3. Lock the whole lineup and publication deadline. Cancel for minimum failure or late acceptance after an early start. Publish and verify seven unique position-eligible athletes per entry.
4. Accept complete authenticated game dispositions. Bind a statistic revision to the original correction cutoff. No candidate may use unverified/missing data as zero.
5. Permissionlessly score one fixed seven-player entry using genuine statistic Merkle proofs. Insert it using checked neighboring hints into descending score order, with immutable ascending entry ID for equal-score ordering.
6. Walk at most 64 rank nodes per call to compute ties and the canonical score commitment. Allocate at most 64 entry payouts per call. A pool never requires a transaction looping over all entrants. Publication supports up to 32 games and 2,048 athletes across bounded batches. Payout metadata supports at most 32 bands, 256 paid ranks per band and 512 total weights, bounded independently from entrants.
7. Publish only the independently calculated ranking/payout root, after a canonical oracle report matches the controller's full domain-bound candidate. Complete the correction, challenge and resolution windows.
8. Finalize through the controller and settle only its exact current candidate. Transfer the development allocation into fixed fund credit once. Entrants collect fixed prize credits; no admin supplies a payout vector or arbitrary recipient.

If a newer authenticated revision begins, old finality is blocked until that work produces the replacement candidate; unfinished work at the deadline refunds. An upheld challenge invalidates its candidate; corrected candidates require a full 24-hour re-review inside the unchanged resolution deadline. No stale root or unresolved claim can bypass settlement. Oracle feeds need not remain fresh forever after a valid frozen final result.

The engine also provides bounded recovery for missing publication, all-excluded games, unavailable results by cutoff plus 24 hours, missing initial candidate at correction close and dispute timeout. Canonical game dispositions and early-start evidence freeze when the slate resolves. Every failure policy is committed; there is no discretionary admin confiscation, entry-withdrawal path, sweep or post-final cancellation.

## Money arithmetic and conservation

Paid development compensation is `floor(3 * gross / 100)`, calculated once with overflow-safe quotient/remainder arithmetic. No development fee applies to free prizes. Challenge bonds are separately escrowed and round upward by base unit.

Payout bands use integer basis-point weights totaling 10,000. Tie entitlements combine occupied rank weights before division. Preserve exact fractions through grouping, floor only final individual entitlements, and distribute remaining units in ascending immutable entry-ID order among fractional entitlements. Every prize base unit is allocated. IDs are assigned once by acceptance sequence and cannot be selected or regenerated by editing.

Engine entry/prize liabilities and controller bond liabilities are separate. Credits are consumed before guarded transfers. Native and token paths require exact amounts; unsupported fee-on-transfer/rebasing semantics fail. Failed or reentrant beneficiaries cannot consume another credit or block other payouts. Anyone may collect an entry's outcome, but only its fixed beneficiary can withdraw its credit. Cancellations reserve no development deduction and return exact paid amounts and launcher funds.

## Executable qualification and live gates

`scripts/fantasy/qualify-contest.py` executes the scoped native suite, independent encrypted-client tests, an actual funded trace, independent signature/Merkle/scoring/payout replay and evidence-tampering negatives. It binds results to a clean exact SHA, rejects skips or missing inventory, checks all seven runtime/initcode sizes and records actual deployed code identities. Raw analyzer findings and explicit source review remain separate evidence; a local review is not independent security approval.

The dedicated branch workflow runs only this fantasy scope. Preserve unrelated poker/cryptographic evidence and keep unrelated documentation/build failures separate. No complete-app Level 3 or global qualification is implied. Other fantasy formats remain open in the mini-roadmap.

Before live activation: bind actual canonical $420 and fund recipients; license and qualify real NHL adapters; verify UTC/DST publishing, source control/provenance and evidence access; provision the confidential custodian and key custody; independently review permissions/code; deploy on the official testnet and collect genuine funded receipts. No production deployment or merge is performed by this implementation task.


### Canonical development-compensation destination

The constructor's development parameter is the actual DevelopmentCompensationVault420 address. The engine checks its shared capability registry and freezes its immutable beneficiary, emitting DevelopmentFundBound. This vault deliberately rejects direct deposits and has no generic withdrawal API. The engine therefore routes the explicitly approved 3%-of-pool fee directly to that same beneficiary, rather than trapping funds in the vault or mislabeling gross player entries as general protocol revenue. The vault's existing net-revenue policy and compensation ceiling are unchanged.

After valid settlement, permissionless forwardDevelopment delivers only earned fund credit to that fixed beneficiary. The recipient need not initiate a transaction. No caller can substitute a destination or collect fees from pending/canceled pools. A rejecting beneficiary leaves its credit intact without blocking participant payouts. Qualification exercises the actual canonical vault getter/registry bindings, successful forwarding and failed/reentrant recipients. The live canonical vault address and beneficiary are still deployment-config-required values, not the unit-test addresses.

The publisher's exact IANA cutoff helper is clients/420bet-fantasy/slate-time.mjs. Tests include both DST transitions and year rollover. Solidity permits the corresponding 23-to-49-hour elapsed bounds while the publisher commits the exact approved local-calendar cutoff. Daily schedules span no more than 24 elapsed hours.


### Publication and authorization runbook

Publish schedules and the first roster batch, append remaining batches, then call sealSlate before opening any pool. Each batch is limited to 64 athletes; the rolling snapshot hash and count are committed by sealing, and no roster can change afterwards. Payout metadata is similarly bounded independently from entrants. Tests execute a 192-player publication across batches within the per-call gas budget.

Grant the engine REGISTER on each planned contest before creation. Grant eligible participant accounts the existing BET_FANTASY_ENTER action for that contest and permitted entry amount. Verified credentials alone never authorize an economic entry; capability revocation stops new entries/edits without confiscating refunds. Custodian and source reporting capabilities are separate. Use dedicated slate/result and pool-candidate feeds to avoid report contention; domain binding remains mandatory even with separate feeds.

The static gate retains all raw High/Medium findings and checks explicit source-bound dispositions. An unknown finding or changed reviewed source fails qualification. Those dispositions are local engineering review, not an independent audit or a claim that the analyzer emitted no findings.


Qualification disables Foundry dynamic test linking so the recorded compilation graph consists of tracked sources, rather than virtual deployment-helper files. The executed production contracts, real cryptographic checks and explicit EVM size/gas limits remain unchanged.

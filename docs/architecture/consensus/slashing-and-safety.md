---
title: Slashing and safety
component: consensus-slashing-safety
audience:
  - validator
  - operator
  - developer
  - architect
category: architecture
status: development
version: current
---

# Slashing and safety

This page documents the canonical safety-fault and slashing model for the bounded-validator phase of 420 Integrated. It separates ordinary availability failure from cryptographically provable safety violations, defines the constitutional slash ceilings, and explains how finalized consensus evidence is translated into execution-layer collateral effects.

The frozen source specification is `docs/VALIDATOR-LIFECYCLE-SLASHING-v1.md`. `fourtwentyd` remains authoritative for duty performance, safety-fault proofs, correlation tier, suspension/ejection, and slash adjudication. `ValidatorRegistry` is the execution-side native `$420` bond vault and validates/applies qualified finalized outcomes through the consensus-system path.

## Safety principle

Slashing exists to protect consensus safety, not to punish every operational failure.

The bounded-validator model distinguishes:

- **availability faults** — missed proposals, missed attestations, or prolonged downtime; and
- **safety faults** — cryptographically provable signed behavior that violates consensus rules or finality safety.

Availability faults normally cause reward non-issuance and may cause suspension/ejection under readiness policy, but they do **not** confiscate validator principal merely because a node was offline.

Principal slashing requires explicit protocol-defined safety evidence.

## Availability faults

At genesis/testnet, ordinary availability failures are not principal-slashing offenses.

| Availability event | Principal slash | Normal consequence |
| --- | ---: | --- |
| isolated missed proposal | 0% | proposer reward not issued; fallback hierarchy continues |
| missed participation/attestation | 0% | that validator's participant share is not issued |
| prolonged downtime | 0% solely for downtime | reward loss plus possible readiness suspension/ejection |

A validator that is unavailable may still be removed from active service if consensus cannot safely rely on it, but readiness action and collateral confiscation are separate decisions.

## Slashable safety offenses

Slash amounts are expressed as basis points/percentages of the validator's **then-current effective collateral**. The frozen specification establishes constitutional maximums; consensus may impose a smaller penalty only where the offense rule permits it.

| Offense | Base maximum | Correlation tier 1 | Correlation tier 2 | Required safety treatment |
| --- | ---: | ---: | ---: | --- |
| invalid signed consensus message | 2.5% | 5% | 7.5% | may suspend |
| double proposal | 5% | 10% | 15% | suspend/eject as required |
| double vote | 10% | 20% | 30% | suspend/eject |
| surround/conflicting vote | 10% | 20% | 30% | suspend/eject |
| conflicting finalized history / finality equivocation | 100% | 100% | 100% | immediate suspension/ejection; all remaining collateral consumed/revoked |

Inactivity remains a 0%-principal category and is deliberately excluded from this table of safety violations.

## Evidence requirements

Every principal slash must be tied to non-zero cryptographic evidence committed by finalized consensus state.

A valid slash outcome must bind at least:

- validator identity;
- offense category;
- cryptographic evidence hash;
- finalized consensus context;
- correlation tier where applicable;
- resulting penalty within the constitutional maximum;
- lifecycle/suspension/ejection consequence.

A UI report, operator accusation, governance vote, stale indexer record, or RPC observation is not enough to slash collateral.

## Evidence replay protection

The same offense evidence must not be charged twice.

The execution-side registry records the evidence hash and rejects duplicate application. Consensus must likewise treat evidence identity deterministically so replay cannot create a second economic penalty from one proven event.

Evidence deduplication is part of the value-conservation and safety model, not merely an application convenience.

## Correlation tiers

Correlated safety failures can impose larger penalties because simultaneous faults threaten a greater fraction of consensus safety.

The frozen tiers are:

- **Tier 0** — fewer than one third of the active committee implicated;
- **Tier 1** — at least one third but fewer than one half implicated;
- **Tier 2** — at least one half implicated.

Correlation tier is a **finalized consensus fact**. `ValidatorRegistry` does not count signatures, inspect gossip, or independently decide how many validators participated in a correlated event.

This preserves the consensus/execution authority boundary: consensus proves and classifies the fault; execution enforces collateral effects within hard bounds.

## Double proposal

A validator must not sign two different block proposals for the same consensus slot/duty context.

Local slashing protection must refuse a second conflicting proposal before signing. If two conflicting signed proposals nevertheless exist and satisfy the protocol evidence rules, consensus may adjudicate a double-proposal slash and apply the required suspension/ejection policy.

Repeated attempts to sign the exact same proposal root may be treated idempotently; signing a different root for the same protected duty is the safety violation.

## Double vote and conflicting vote

Validators must not sign consensus votes/attestations that violate the protocol's vote-safety rules.

The frozen categories include:

- double vote;
- surround/conflicting vote where applicable to the attestation/finality model;
- other invalid signed consensus messages that meet the protocol evidence definition.

Local slashing protection must persist enough duty history to reject conflicting attestations even after process restart.

## Conflicting finalized history

Signing or proving conflicting finalized histories is the terminal safety category.

For finalized-history/finality equivocation:

1. all remaining participant-owned validator collateral is slashed to the canonical `ProtocolReserve`;
2. all remaining protocol-owned validator credit is revoked and returned to `CommunityValidatorReserve`;
3. the validator is immediately suspended/ejected;
4. an already-pending voluntary exit does not make the validator withdrawable or escape the safety outcome.

The constitutional maximum is 100% at every correlation tier because conflicting finality attacks the core safety guarantee of the chain.

## Collateral composition

A validator may be fully self-funded or may contain both participant-owned collateral and protocol-owned community validator credit.

Ordinary percentage slashes are applied **proportionally to the validator's current collateral composition**.

If the validator is 50% participant-owned and 50% protocol-credit funded at the time of a non-terminal slash, the penalty is split proportionally between those two collateral sources rather than exhausting one source first.

This prevents the matched-credit structure from shifting all ordinary slash risk onto either the participant or the protocol reserve.

## Slash routing

Actual value routing is explicit:

- slashed participant-owned collateral goes to the canonical `ProtocolReserve` system destination;
- slashed/revoked protocol credit returns to `CommunityValidatorReserve` and remains protocol-owned/recyclable collateral;
- protocol credit never becomes liquid property of the validator as a result of slash, exit, or replacement.

After a non-terminal slash, the validator owner may add participant-owned collateral to restore the effective bond to the 42,000-`$420` ceiling, but restoring collateral does not automatically restore active eligibility. Lifecycle delay, readiness, suspension state, and committee-selection rules still apply.

## Suspension versus ejection

### Suspension

Suspension removes the validator from current duty eligibility while preserving a possible recovery path.

A suspended validator may need to:

- resolve the triggering safety/readiness condition;
- restore the complete effective bond after a non-terminal slash;
- pass readiness checks;
- satisfy lifecycle/cooldown/re-entry requirements;
- wait for a later canonical committee transition.

### Ejection

Ejection removes the validator from active scheduling according to the safety rules.

An ejected validator does **not** cause the remainder of the current rotation's proposer schedule to be regenerated. Scheduled appearances for that identity are skipped and the existing fallback hierarchy remains in force. A new schedule is generated only at the next canonical rotation boundary from the finalized active committee.

This prevents a slash/ejection event from becoming a mechanism for manipulating fresh proposer randomness mid-rotation.

## Local slashing protection

Production validator operation requires local slashing protection in addition to network-level evidence handling.

The current consensus protection model refuses conflicting:

- block proposals for one slot;
- attestations/votes for one protected duty context;
- `RecoveryCertificate` signatures for one recovery incident where conflicting signing would be unsafe.

Exact-repeat signing requests for the same root may be idempotent, but conflicting roots must be rejected.

Slashing-protection state must survive validator process restart. A node that loses the database must not simply resume signing from incomplete local knowledge.

## Remote signer boundary

Production validator keys are expected to operate through the remote-signer architecture rather than being exposed to dApps, Wallet sessions, automation scripts, or ordinary application processes.

The signer must enforce domain/duty separation and cooperate with local slashing-protection state. A signing request being cryptographically valid is not enough if signing it would conflict with previously signed consensus history.

Application/session-key convenience must never acquire validator signing authority.

## Finality and safety halt

Finalized consensus history is a safety boundary.

If local state suggests that two conflicting histories both appear finalized, the node must not choose one opportunistically and continue signing. That condition is a safety incident requiring fail-closed behavior and the recovery/safety-halt procedures documented in DOC-4.7.

Likewise, a node that cannot verify the finalized consensus evidence needed for a slash must not fabricate or approximate the penalty from derived state.

## Withdrawal hold preserves slashability

A validator remains slashable throughout the six-rotation post-duty withdrawal hold.

The hold prevents an operator from completing duties, immediately removing collateral, and escaping subsequently finalized evidence for a fault committed during service.

A pending exit therefore does not override:

- slash evidence;
- correlation classification;
- suspension/ejection consequences;
- the required post-duty hold.

Only after the canonical lifecycle reaches `WITHDRAWABLE` may participant-owned collateral be released.

## Consensus/execution authority split

| Safety concern | Canonical authority |
| --- | --- |
| signed-duty conflict detection/evidence | consensus / validator slashing protection |
| offense classification | finalized consensus |
| correlation tier | finalized consensus |
| suspension/ejection outcome | consensus |
| constitutional slash ceiling | frozen protocol specification |
| native `$420` bond custody | `ValidatorRegistry` |
| proportional collateral deduction | `ValidatorRegistry` validating finalized result |
| participant slash destination | `ProtocolReserve` |
| protocol-credit return | `CommunityValidatorReserve` |
| derived display/analytics | Indexer / Explorer / Analytics only |

Execution validates and applies qualified outcomes; it does not invent consensus evidence. Consensus adjudicates safety; it does not bypass execution custody accounting.

## Governance boundary

Governance cannot:

- fabricate evidence;
- declare an arbitrary validator slashable without canonical proof;
- exceed constitutional slash ceilings;
- change the finalized correlation tier for a specific event;
- invoke consensus-owned slash entrypoints after immutable consensus-system binding;
- convert protocol credit into validator-owned value.

Governance may participate only in explicitly permitted operational/qualification processes and future protocol upgrades subject to the chain's upgrade rules. It is not an ambient slashing authority.

## Anti-flapping safety exception

The committee anti-flapping rule normally requires three consecutive qualifying rotation snapshots before changing the active committee target.

Safety has priority when the scheduled committee cannot be filled with eligible validators. In that case, consensus may reduce the target immediately to the largest safely fillable committee allowed by the eligibility rules.

This safety reduction changes the committee target; it does not erase existing slash evidence, shorten already-earned validator liability, or authorize arbitrary mid-rotation proposer reshuffling.

## Slashing and safety invariants

- **SLASH-001** — ordinary inactivity alone must never confiscate validator principal.
- **SLASH-002** — every principal slash must reference non-zero cryptographic evidence committed by finalized consensus state.
- **SLASH-003** — the same offense evidence must not be applied more than once.
- **SLASH-004** — execution must never impose a penalty above the constitutional maximum for the finalized offense/correlation tier.
- **SLASH-005** — correlation tier must be a finalized consensus fact; execution must not infer it independently.
- **SLASH-006** — ordinary percentage slashes must affect participant-owned collateral and protocol credit proportionally to current composition.
- **SLASH-007** — conflicting finalized history may consume/revoke all remaining collateral and must force immediate safety removal.
- **SLASH-008** — an exit request or completed active term must not erase slashability during the post-duty withdrawal hold.
- **SLASH-009** — suspension/ejection must not trigger a normal mid-rotation proposer-schedule regeneration.
- **SLASH-010** — validator signing infrastructure must refuse conflicting protected duties and persist protection across restart.
- **SLASH-011** — governance, dApps, Wallet sessions, and derived projections must not manufacture slash authority or validator signing authority.
- **SLASH-012** — slash settlement must preserve collateral custody/value conservation and the participant/protocol ownership distinction.

## Failure and recovery behavior

### Evidence cannot be verified

Fail closed. Do not slash until the protocol-defined evidence and finalized context are verifiable.

### Duplicate evidence is submitted

Reject it as already consumed. Do not create a second principal penalty.

### Slashing-protection database is missing or inconsistent

Do not resume validator signing from uncertain history. Recover the protected signing state from trusted local backup/recovery procedure or remain halted.

### Validator is ejected during a rotation

Skip its scheduled proposer identities and use the already-frozen fallback ordering. Do not regenerate the remainder of the rotation schedule.

### Execution rejects a finalized slash transition

Do not silently diverge consensus and execution state. Enter the recovery path and reconcile the canonical finalized safety outcome with bond custody before duties/value-sensitive transitions resume.

### Conflicting-finality evidence appears

Treat it as a chain-safety incident, not an ordinary fork-choice preference. Stop unsafe signing and follow DOC-4.7 safety-halt/recovery procedures.

## Relationship to the remaining DOC-4 page

- [Validator lifecycle](validator-lifecycle.md) defines the bond, lifecycle, cooldown, exit, and slashability-hold states.
- [Proposer selection, cohorts, and rotation](proposer-selection-cohorts-rotation.md) defines the schedule behavior after suspension/ejection.
- [Epochs, fork choice, QCs, and finality](epochs-fork-choice-qcs-finality.md) defines the finalized consensus context that safety evidence relies on.
- [Rewards and issuance](rewards-and-issuance.md) defines reward non-issuance for ordinary availability failures.
- DOC-4.7 defines quorum loss, partitions, persistent state, remote-signer recovery, Engine failure, and `SAFETY_HALT` operational procedures.

## Implementation references

- `docs/VALIDATOR-LIFECYCLE-SLASHING-v1.md`
- `consensus/`
- `consensus/slashing/` and validator local slashing-protection implementation where present
- `contracts/` validator registry/reserve/system-access implementations
- `docs/STEP-4.4-COMMITTEE-SIMULATION.md`
- `docs/STEP-4.3-CONSENSUS-CERTIFICATION.md`
- `docs/CONSENSUS-SYSTEM-CALL-v1.md`

---
title: 420 Arbitration
audience:
  - developer
  - architect
  - operator
category: architecture
status: development
version: current
---

# 420 Arbitration

420Arbitration is the shared dispute-resolution coordination protocol for 420 Integrated. It provides a canonical way for participating protocols to open disputes, commit evidence, bind an authorized resolver, record rulings, permit bounded appeals, and reach arbitration finality **without transferring custody or blanket execution authority into the arbitration system**.

The protocol answers a narrow question: **what ruling did the registered dispute process reach for this case under the policy that governed it when the case opened?**

It does not answer every legal question, and it does not directly enforce arbitrary remedies against other protocol state.

## Authority model

420Arbitration separates four authorities:

| Authority | Canonical responsibility | Must not do |
| --- | --- | --- |
| GovernanceTimelock | configure arbitration policy for a domain | rewrite an already-open case's snapshotted policy |
| Case registry | bind parties, origin, claim/remedy commitments, policy snapshot, round and deadlines | decide the dispute or execute remedies |
| Ruling registry / selected resolver | record exactly one ruling for the current round | rule for another domain/round or bypass appeal/finality rules |
| Originating protocol | optionally consume a finalized ruling through its own explicit transition | treat Arbitration as ambient authority over unrelated state |

This separation means a valid arbitration ruling can be authoritative for the registered dispute process while still having **zero direct power** to seize funds, mutate Rights, slash validators, reverse bridge transfers, or override Civic governance.

## Domain-scoped policy

`ArbitrationPolicyRegistry420` stores one policy per arbitration domain. Governance configures:

- primary resolver;
- appeal resolver;
- evidence window;
- appeal window;
- maximum appeals;
- active/inactive status.

A policy is invalid if its domain or primary resolver is missing, either window is zero, or the appeal count exceeds the protocol cap. If appeals are enabled, an appeal resolver must also exist.

The current implementation caps `maxAppeals` at **3**.

A configured policy is not retroactive case authority. The active policy is copied into each new case when that case opens.

## Policy snapshot at case open

A case permanently records the arbitration terms that applied when it opened:

- claimant;
- respondent;
- arbitration `domainId`;
- originating component ID;
- originating object ID;
- claim commitment;
- requested-remedy commitment;
- primary resolver;
- appeal resolver;
- evidence window;
- appeal window;
- maximum appeals;
- open timestamp and current round state.

Later governance changes to the domain policy do not replace those fields for the existing case.

This protects both parties from a resolver, deadline, or appeal-path change being applied after the dispute already exists.

## Case identity

New case IDs are domain-separated from ordinary application identifiers by binding the current chain, the case registry, a monotonic nonce, both parties, the domain, origin component/object, and claim commitment.

Conceptually:

```text
caseId = H(
  chainId,
  caseRegistry,
  nonce,
  claimant,
  respondent,
  domainId,
  originComponentId,
  originObjectId,
  claimHash
)
```

A case therefore cannot be silently transplanted to another chain, registry instance, dispute object, or pair of parties while retaining the same canonical identity.

## Opening a case

A case may open only against an **active** arbitration domain policy.

The claimant cannot name themselves as respondent. The respondent, originating component, originating object and claim commitment must be valid nonzero values.

Opening a case starts round `0` in `OPEN` state and creates the first evidence deadline from the snapshotted evidence window.

The case registry does not independently verify the truth of the claimant's factual allegations at open time. Opening creates a canonical dispute record; it is not a ruling.

## Evidence commitments

Evidence is commitment-based.

Only the claimant or respondent may submit evidence for a case, and only while the current round is `OPEN` and before its evidence deadline.

The chain records an `evidenceHash`. The underlying evidence may remain:

- encrypted;
- access-controlled;
- in a content-addressed store;
- with a specialist evidence host;
- or otherwise outside public chain storage.

Committing a hash does **not** make a private payload public and does not grant a resolver, frontend, indexer, or evidence host any authority outside the rules used to access that payload.

Evidence commitments are recorded per case **and per round**, preserving which material was presented during each stage of the dispute.

## Current-round resolver

Each case round has exactly one selected resolver identity:

- round `0` uses the snapshotted primary resolver;
- appeal rounds use the snapshotted appeal resolver.

`ArbitrationRulingRegistry420` rejects a ruling from any other address.

The selected resolver is therefore explicit protocol state, not a frontend preference or an off-chain convention.

## Rulings

A ruling records:

- nonzero outcome code;
- nonzero ruling/reasoning commitment;
- remedy commitment;
- optional panel commitment;
- resolver identity;
- ruling timestamp.

Each case round accepts **at most one** ruling.

A panel commitment may preserve a transcript, panel composition, selection proof, or another process commitment without requiring the full material to be published directly on chain.

A ruling changes the case from `OPEN` to `RULED` and starts the snapshotted appeal window.

## Ruling versus remedy execution

A `remedyCommitment` describes or commits to the remedy determined by the dispute process. It is **not an execution payload with ambient authority**.

420Arbitration cannot directly:

- seize or transfer `$420` or other assets;
- release arbitrary Vault custody;
- reverse 420Pay settlement;
- unwind Exchange trades;
- reverse Bridge transfers;
- create, transfer, supersede, revoke, or rewrite 420Rights state;
- alter Grants/Treasury accounting;
- slash a validator or change consensus state;
- grant or revoke Wallet capabilities;
- override Civic governance.

The originating protocol must implement its own explicit ruling-consumption path if it wants an arbitration outcome to cause a state transition.

That consuming path remains responsible for its own authorization, accounting, state-machine, replay, finality, custody and safety checks.

## Appeals

Only the claimant or respondent may appeal.

An appeal is available only when:

1. the current case state is `RULED`;
2. the appeal deadline has not passed; and
3. the current round is below the case's snapshotted `maxAppeals`.

A successful appeal:

- increments the round;
- returns the case to `OPEN`;
- starts a new evidence window;
- clears the previous appeal deadline;
- switches ruling authority to the snapshotted appeal resolver.

Earlier evidence and rulings are not deleted. The full round history remains part of the audit trail.

## Bounded appeals

Appeals cannot recurse forever.

The domain policy must specify a finite `maxAppeals`, and the implementation rejects values greater than **3**.

This bound is snapshotted into the case at open time, so governance cannot extend an already-open case's appeal count after seeing an unfavorable ruling.

## Finalization

A ruling may finalize only after its appeal window has closed.

The current round must still be in `RULED` state, and that round must contain a recorded ruling.

Finalization changes the case state to `FINALIZED` and emits the finalized ruling/remedy commitments.

Finalization does not erase prior rounds. It establishes which round is the terminal arbitration outcome for the protocol-level dispute process.

## Arbitration finality versus chain finality

Arbitration finality and consensus finality are separate concepts.

- **Arbitration finality** means the case's bounded appeal process has ended and the arbitration state machine considers its current ruling final.
- **Chain finality** determines whether the execution state containing that arbitration transition is itself irreversible under consensus.

A security-sensitive consuming protocol should not treat an unfinalized execution observation as permanently final merely because the case state says `FINALIZED` at the current head.

Consumers must apply their normal canonical/finality policy when acting on a ruling.

## Origin-protocol consumption

A participating protocol should bind arbitration narrowly to a registered dispute surface.

A safe integration typically checks:

1. the expected arbitration domain;
2. the expected origin component;
3. the expected origin object;
4. the case parties where relevant;
5. `FINALIZED` arbitration state;
6. the expected ruling round and ruling commitment;
7. the remedy commitment or permitted outcome class;
8. execution/consensus finality required by the consuming protocol;
9. replay protection for the consumed ruling;
10. the consuming protocol's own authorization and state-transition preconditions.

Arbitration therefore acts as an **input to a bounded transition**, not a superuser call into the rest of the ecosystem.

## Registered dispute domains

The Genesis profile anticipates arbitration domains for shared systems including:

- 420 Market;
- 420 Rights;
- 420 Grants;
- 420 ComputeMarket;
- 420 Pay;
- 420 Resource Protocol;
- future registered protocols.

A protocol being listed as an arbitration-capable domain does not mean Arbitration automatically owns that protocol's remedies. The corresponding integration still has to be explicitly implemented.

## Rights disputes

420 Rights deliberately permits non-identical competing rights claims because Rights records evidence/provenance state but does not adjudicate every external legal ownership dispute.

An Arbitration domain can coordinate a dispute around a Rights object, but a finalized ruling still cannot directly rewrite the Rights registries.

If Rights later implements a ruling-consumption transition, that transition must remain exact-right scoped and respect Rights-specific holder, supersession, licensing and authorization rules.

## Payment, treasury and grant disputes

A ruling about a payment, grant, budget or settlement does not itself move assets.

Any financial remedy must still pass through the protocol that owns custody/accounting authority, such as the relevant Pay, Treasury, Grants or Vault transition.

This prevents the dispute layer from becoming an alternate asset-custody system.

## Resource and compute disputes

Resource/storage/compute protocols may use Arbitration for disputes about service obligations, provider behavior, delivery or settlement eligibility.

A ruling is not a proof receipt, storage proof, AI/compute execution receipt, oracle result, or metering record. Those protocols continue to validate their native evidence independently.

## Evidence privacy and availability

The chain makes evidence commitments durable, but it does not guarantee the continued availability or decryptability of off-chain evidence payloads.

Applications that rely on private evidence should define:

- encryption/key-management rules;
- authorized viewers;
- durable storage/replication expectations;
- retention requirements;
- evidence format/version commitments;
- how a resolver handles unavailable evidence.

An indexer may make arbitration commitments easier to discover but cannot recreate missing private evidence from a hash alone.

## Non-canonical infrastructure

The following remain replaceable operational surfaces:

- Arbitration frontends;
- evidence upload/download services;
- encrypted evidence stores;
- public read APIs;
- indexers/search projections;
- notification delivery;
- panel-selection coordination services where the protocol only commits their result.

They may improve usability but cannot rewrite cases, evidence commitments, selected resolvers, rulings, appeal rounds, or finalization state.

## Failure behavior

### Inactive or missing domain policy

Do not open the case. Arbitration fails closed rather than inventing a default resolver.

### Resolver unavailable

The case remains open until the configured process can produce a ruling. Operators/frontends must not substitute a new resolver locally. A governance policy change applies prospectively to new cases unless an explicit protocol migration path exists.

### Evidence host unavailable

The commitment remains canonical, but the underlying payload may be unavailable. Do not replace the original evidence hash with an operator-selected payload.

### Appeal resolver unavailable

An already-snapshotted case cannot silently switch appeal authority. Recovery requires the process defined by protocol/governance rules rather than local substitution.

### Conflicting frontend/indexer state

Read canonical chain state. Rebuild derived projections from case/ruling events and execution state.

### Origin protocol unavailable

A finalized ruling remains recorded. Remedy execution waits until the origin protocol can safely consume it; Arbitration must not bypass the unavailable protocol by executing the remedy itself.

## Recovery order

When recovering Arbitration or a dependent application:

1. restore canonical execution-chain access and finality awareness;
2. restore the policy registry;
3. restore case state and each case's snapshotted policy fields;
4. restore round-specific evidence commitments;
5. restore ruling records for every round;
6. reconcile case `OPEN` / `RULED` / `FINALIZED` state and deadlines;
7. rebuild non-canonical index/search/API projections;
8. only then restore origin-protocol ruling consumption and notifications.

Never recover from a frontend database by overwriting canonical case state.

## Protocol invariants

- **ARB-001 — Bound case identity:** every case permanently binds its parties, domain, origin component/object, claim commitment and requested-remedy commitment.
- **ARB-002 — Snapshot policy:** resolver, appeal resolver, evidence/appeal windows and appeal cap are snapshotted when the case opens and are not retroactively replaced by later policy edits.
- **ARB-003 — Party-scoped evidence:** only the claimant or respondent may commit nonzero evidence while the current evidence window is open.
- **ARB-004 — Private evidence remains off-chain-capable:** an evidence commitment does not publish or authorize access to the underlying payload.
- **ARB-005 — Exact resolver authority:** only the resolver selected for the current round may submit that round's ruling.
- **ARB-006 — One ruling per round:** a case round accepts at most one canonical ruling.
- **ARB-007 — Bounded appeals:** appeals are party-initiated, time-bounded, snapshotted per case and capped at three by the current implementation.
- **ARB-008 — Historical rounds persist:** appeal progression never deletes earlier evidence or rulings.
- **ARB-009 — Finalization waits for appeal closure:** a ruling cannot finalize before its appeal window expires.
- **ARB-010 — Commitment, not custody:** a final ruling/remedy commitment does not itself transfer assets or mutate another protocol's state.
- **ARB-011 — Explicit remedy integration:** an originating protocol may consume a finalized ruling only through its own bounded authorization/accounting/state-transition logic.
- **ARB-012 — No cross-domain superuser:** Arbitration cannot directly slash validators, reverse bridges, rewrite Rights, override governance, grant Wallet authority, or exercise blanket custody power.
- **ARB-013 — Arbitration finality is not consensus finality:** consumers must still apply their required canonical/finality policy before irreversible action.
- **ARB-014 — Replaceable presentation:** frontends, evidence hosts, APIs, indexers and notification services remain non-canonical and reconstructable/recoverable around canonical case/ruling state.
- **ARB-015 — Domain-bounded authority:** a finalized ruling is authoritative only for the registered dispute process and origin integration it represents; it is not universal external legal authority.

## Related documentation

- [Protocol integration model](protocol-integration-model.md)
- [Rights and Verify](rights-verify.md)
- [Stake, Governance, Treasury and Grants](stake-governance-treasury-grants.md)
- [Pay, Token, Swap/Exchange and Bridge](pay-token-exchange-bridge.md)
- [Storage Proof and Resource Protocol](storage-proof-resource-protocol.md)
- [Trust-boundary model](../trust-boundary-model.md)

# CMP-1.5.5 — Objective slash authorization

Status: **COMPLETE. LEVEL 1 + LEVEL 2 QUALIFIED.**

## Canonical definition

> Objective slash authorization

This step authorizes bounded stake sanctions from objective, preaccepted evidence. It does not execute or distribute a slash, create rewards, move payer escrow, or perform final WorkerRegistry/ComputeEscrow integration.

## Authority model

CMP-1.5.5 separates four authorities:

1. **collateral custody/accounting** — canonical 420Vault remains authoritative;
2. **slash policy** — `ComputeStakeSlashPolicy420` defines immutable, versioned sanction terms;
3. **objective evidence** — typed evidence adapters prove one enumerated misconduct predicate;
4. **slash authorization** — `ComputeStakeSlashAuthorization420` validates policy + position + evidence and reserves a bounded amount.

No one of these alone can move Vault funds.

## Frozen slash policy

Slash policy is keyed by:
- `stakePolicyId`;
- subject kind: worker or verifier.

Each revision freezes:
- exact objective evidence adapter;
- exact adapter code hash;
- exact violation code;
- optional exact verification-policy ID/revision/commitment;
- slash basis points;
- optional maximum slash amount;
- publication timestamp and revision.

Every worker/verifier collateral position now freezes the exact slash-policy revision and commitment when the position first opens.

A later policy revision cannot apply retroactively to an already-open position.

Top-up requires the position's frozen slash policy to remain the current revision. This prevents adding new collateral under changed sanction terms without opening a separately governed position lifecycle.

## Objective worker evidence

`ComputeWorkerConflictingResultSlashEvidence420` implements an objective worker proof that the protocol specification explicitly permits: cryptographically conflicting signed results.

The evidence requires:
- one canonical job;
- one current canonical assignment/attempt;
- canonical `workerId` and worker revision;
- canonical frozen execution signer;
- accepted `stakePolicyId` and stake reference;
- two different receipt/output result digests;
- valid signatures from the same frozen execution signer over both digests.

The unique misconduct key is attempt-scoped, so swapping the pair or resubmitting another conflicting pair for the same attempt cannot manufacture another sanction event.

A generic `FAILED` job, self-reported attempt failure, suspension, reputation label or unsupported operator-address-only result is not objective worker slash evidence.

## Objective verifier evidence

`ComputeVerifierDisputeSlashEvidence420` consumes the already-qualified dispute review hook.

It accepts only:
- terminal `FINAL` adjudication;
- explicit `OBJECTIVE_VERIFIER_ERROR_GROUND`;
- final disposition adverse to the original verification;
- nonzero original verification/result/evidence/decision/resolution commitments;
- a real independent initial adjudicator;
- when appealed, a resolved appeal with a distinct appeal adjudicator and nonzero appeal decision.

It rejects:
- timeouts;
- withdrawn disputes;
- generic adverse dispute disposition that does not independently prove verifier fault;
- generic payer/provider wins;
- non-final disputes;
- unresolved appeals;
- same-adjudicator appeals;
- arbitrary adverse dispute status without the objective verifier-error ground.

This preserves the CMP-1.4.9 rule that an adverse dispute is only a candidate hand-off until a stake layer validates its own objective predicate.

## Authorization

`ComputeStakeSlashAuthorization420.authorize(...)` is permissionless to relay.

Authorization succeeds only when:
- the exact worker/verifier collateral source is reciprocally bound to this authorizer;
- the position exists and is active;
- the subject identity/account matches the objective evidence;
- the position's `stakePolicyId` matches evidence when evidence carries one;
- the requested slash-policy revision and commitment exactly equal the position's frozen snapshot;
- the frozen evidence adapter still has its exact code hash;
- the violation code matches;
- any required verification-policy tuple matches exactly;
- evidence is final/objective;
- the unique misconduct key has not already been consumed;
- evidence chronology does not predate the collateral position;
- slashable collateral remains after already-authorized reservations.

The authorized amount is:
- policy percentage of the position's current slashable collateral;
- capped by optional policy maximum;
- capped again by remaining unreserved slashable collateral.

## Exactly-once and withdrawal hold

Each objective misconduct event may authorize only once.

The authorizer records:
- authorization reference;
- collateral position;
- subject;
- stake policy;
- frozen slash-policy revision/commitment;
- evidence adapter/reference;
- misconduct key;
- evidence commitment;
- violation code;
- bounded amount;
- authorization timestamp.

The collateral sources consult `outstandingSlash(positionId)` before matured withdrawal.

A pending authorization therefore blocks withdrawal of the affected collateral until the later slash-distribution step consumes/resolves that authorization.

CMP-1.5.5 itself intentionally provides no consume/distribution method. That belongs to:

**CMP-1.5.6 — Slash distribution**

## Security boundaries

CMP-1.5.5 does not:
- release or claim Vault obligations;
- select a recipient;
- pay a claimant, payer, replacement worker or Treasury;
- mutate payer escrow;
- create rewards;
- convert Trust/reputation into slash authority;
- slash based only on job failure, registry status or an allegation;
- let governance retroactively apply a later penalty policy to old collateral.

## Tests

Focused qualification covers:
- governance-only slash-policy publication;
- malformed policy rejection;
- immutable revision/commitment history;
- frozen evidence-adapter code hash;
- exact frozen collateral-policy snapshot;
- later-policy retroactivity rejection;
- subject/account/stake-policy mismatch;
- verification-policy mismatch;
- non-final evidence rejection;
- misconduct replay rejection;
- cumulative reservation bounded by slashable collateral;
- matured withdrawal blocked by outstanding authorization;
- conflicting signed worker result proof;
- wrong worker signature rejection;
- identical result rejection;
- swapped evidence replay rejection;
- missing worker stake binding rejection;
- verifier timeout/generic adverse case rejection;
- unresolved/non-independent appeal rejection;
- valid independently adjudicated objective verifier error acceptance.

## Qualification level

CMP-1.5.5 is a **Level 2 app milestone** because a new shared security authority now spans:
- worker collateral;
- verifier collateral;
- slash policy;
- objective worker evidence;
- dispute-derived verifier evidence;
- withdrawal holds.

Level 1 remains focused on affected contracts/tests/verifier.

Level 2 is the retained `Compute*.t.sol` application suite on the same exact implementation SHA.

Repository-wide Level 3 remains deferred to **CMP-1.5.13 — Phase closeout**.

## Exit criteria

CMP-1.5.5 is COMPLETE only when:
- slash terms are preaccepted/frozen per collateral position;
- later policy changes cannot retroactively alter old positions;
- concrete objective evidence exists for both worker conflicting-signature misconduct and independently adjudicated verifier error;
- subjective/generic failure paths fail closed;
- exactly-once misconduct replay protection holds;
- authorization amount is bounded and cannot exceed live slashable collateral after outstanding reservations;
- outstanding authorizations prevent collateral exit;
- no Vault movement or recipient selection is introduced;
- focused Level 1 qualification passes;
- retained Compute Level 2 qualification passes on the same exact implementation SHA;
- durable evidence records that SHA.

Next canonical step:

**CMP-1.5.6 — Slash distribution**


## Completion evidence

CMP-1.5.5 is **COMPLETE**.

Qualified implementation SHA:

`8847b36b8e50905402f45e5c0f121c80464673e4`

Current `main` observed at closeout:

`98e545225d54379086f0c520afcb84b4d4d97288`

Exact-head qualification:

- Compute Market Qualification #108 — run `36956107284` — **PASS**;
- retained `Compute*.t.sol` app integration suite — **PASS**;
- CMP-1.5.5 mechanical verifier — **PASS**;
- Solidity Contracts #3925 — run `36956107199` — **PASS** on the Compute fast path;
- 420Docs Qualification #4138 — run `36956107143` — **PASS**;
- Genesis Address Authority #727 — run `36956107316` — **PASS**;
- 420Registry REG-AUDIT-4 #562 — run `36956107224` — **PASS**;
- 420Indexer #1542 — run `36956107256` — **PASS**.

Durable machine-readable evidence:

`docs/compute-market/CMP-1.5.5-QUALIFICATION-EVIDENCE.json`

The final qualification target included the documentation clarification required by the mechanical verifier. The resulting exact implementation SHA above is the authoritative qualified SHA.

This closeout commit sequence is evidence/documentation-only relative to that qualified implementation SHA. It does not modify executable source, tests, workflows, dependencies, configuration, interfaces, deployment state, or generated/runtime artifacts.

Repository-wide Level 3 qualification remains intentionally deferred to **CMP-1.5.13 — Phase closeout**.

Next canonical step:

**CMP-1.5.6 — Slash distribution**

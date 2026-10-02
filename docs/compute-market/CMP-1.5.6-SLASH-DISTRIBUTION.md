# CMP-1.5.6 — Slash distribution

Status: **COMPLETE. LEVEL 1 + LEVEL 2 QUALIFIED.**

## Canonical definition

> Policy-bound distribution to harmed payer, replacement worker, challenger and/or protocol treasury.

CMP-1.5.6 consumes an already-qualified CMP-1.5.5 objective slash authorization and distributes the exact authorized collateral amount under a preaccepted, immutable recipient policy.

It does **not**:
- create slash authorization;
- create rewards;
- mutate payer escrow;
- infer a replacement worker;
- perform final dispute/stake orchestration;
- perform WorkerRegistry integration;
- perform ComputeEscrow redistribution.

Those remain later canonical steps.

## Distribution policy

`ComputeStakeSlashDistributionPolicy420` is keyed by the exact frozen slash-policy commitment.

Each append-only revision freezes:
- recipient resolver address and code hash;
- optional explicit protocol treasury;
- harmed-payer share;
- replacement-worker share;
- challenger share;
- protocol-treasury share.

Shares must total exactly 10,000 basis points.

Dynamic recipient classes require a nonzero resolver. Treasury-only distribution requires no resolver.

A distribution policy cannot authorize a slash and cannot move collateral.

## Authorization freeze

`ComputeStakeSlashAuthorization420` now requires a distribution policy/executor binding before new authorization.

Every authorization freezes:
- distribution-policy revision;
- exact distribution-policy commitment;
- resolved harmed-payer address;
- resolved replacement-worker address;
- resolved challenger address;
- explicit protocol-treasury address.

Recipient resolution therefore occurs before authorization is created. Later resolver-state changes cannot redirect an existing authorization.

The bound executor must prove reciprocal wiring to:
- the exact slash authorizer;
- the exact distribution-policy contract.

A later distribution-policy revision cannot redirect an existing authorization.

The authorization remains outstanding until its **entire** amount is distributed. Only the bound distribution executor may consume it.

## Recipient resolution

`IComputeSlashRecipientResolver420` provides typed dynamic recipients:
- harmed payer;
- replacement worker;
- challenger.

`ComputeVerifierDisputeSlashRecipientResolver420` provides a concrete verifier-dispute resolver. It reconstructs:
- the canonical finalized verifier dispute;
- the canonical entitlement snapshot;
- the harmed payer;
- the dispute claimant/challenger.

It does not invent a replacement worker.

Policies assigning replacement-worker share must use a resolver that can prove a canonical replacement worker from repository-authoritative state.

The slashed subject may never receive its own slash distribution.

## Resumable distribution

`ComputeStakeSlashDistribution420` is permissionless to relay.

On first execution it:
1. loads the exact authorization;
2. verifies the frozen distribution-policy revision/commitment;
3. uses only the recipient addresses already frozen in that authorization;
4. freezes exact recipient target amounts;
5. deterministically assigns any rounding remainder to the first nonzero policy slot.

Execution may then continue in bounded batches.

The executor:
- asks the collateral source for a bounded preview;
- allocates only the next exact portion of recipient targets;
- executes one bounded source batch;
- records cumulative distribution;
- consumes the authorization only after all recipient targets are exactly complete.

A partial/interrupted distribution therefore remains resumable and the outstanding slash hold remains active.

## Canonical Vault mutation

Worker and verifier collateral sources implement the same slash-distribution source interface.

A source batch:
- is callable only by the executor bound through the exact slash authorizer;
- processes at most `maxTranches`;
- revalidates each source collateral obligation;
- cancels only the collateral obligation being consumed;
- if partially slashed, creates a replacement collateral obligation for the exact unslashed remainder with the original immutable beneficiary;
- creates recipient-specific slash-distribution obligations for the exact batch amount;
- releases and claims those recipient obligations through canonical `AssetVault420`;
- decrements position `activeAmount` and `slashableAmount` by exactly the amount distributed.

Recipient obligations and Vault operation IDs are domain-separated by authorization, position and position revision so independent batches cannot collide.

No parallel slash treasury is introduced.

## Partial tranche safety

Collateral top-ups produce immutable backing tranches, while slash percentages may be smaller than a tranche.

CMP-1.5.6 therefore never treats “cancel obligation” as equivalent to “slash the whole tranche.”

For a partial slash:
- the old obligation is cancelled;
- only the authorized amount becomes distributable;
- the remainder is immediately re-reserved to the original staker under a new canonical collateral obligation;
- the tranche metadata is updated to that replacement obligation.

This keeps Vault accounting solvent and prevents over-slashing.

## Exit interaction

CMP-1.5.5 already blocks matured withdrawal while `outstandingSlash(positionId) != 0`.

CMP-1.5.6 preserves that hold across all partial batches.

Only the final successful batch consumes the authorization and releases that authorization's hold.

If the slash consumes the entire remaining collateral position:
- active amount becomes zero;
- slashable amount becomes zero;
- the position becomes inactive;
- pending exit state is cleared.

## Security boundaries

CMP-1.5.6 fails closed when:
- distribution-policy revision/commitment does not match authorization;
- resolver code hash drifts;
- required recipient is zero;
- recipient equals the slashed subject;
- recipient shares do not total exactly the authorization amount;
- source position/tranche/obligation binding is stale;
- recipient total differs from batch amount;
- batch cannot process the requested amount within its tranche bound;
- authorization is already consumed;
- final cumulative recipient totals do not equal frozen targets.

It never:
- changes objective evidence;
- changes slash amount;
- chooses an unfrozen recipient policy;
- debits payer escrow;
- turns Trust/reputation into payment authority;
- grants arbitrary recipient selection to a relayer.

## Qualification

Focused coverage includes:
- distribution-policy governance and shape validation;
- append-only distribution revisions/commitments;
- reciprocal executor binding;
- frozen authorization distribution terms;
- deterministic rounding;
- resumable multi-batch execution;
- exactly-once final authorization consumption;
- subject-self-payment rejection;
- partial worker collateral slash with exact remainder rebind;
- partial verifier collateral slash with exact remainder rebind;
- Vault recorded/reserved/claimable/released parity;
- recipient payout exactness;
- replay-safe recipient obligation identity.

CMP-1.5.6 is a **Level 2 app milestone** because it crosses:
- objective slash authorization;
- worker collateral;
- verifier collateral;
- recipient policy/resolution;
- canonical Vault cancel/create/release/claim accounting.

Level 1 remains focused on changed contracts/tests/verifier.

Level 2 is the retained `Compute*.t.sol` suite on the same exact implementation SHA.

Repository-wide Level 3 remains deferred to **CMP-1.5.13 — Phase closeout**.

## Exit criteria

CMP-1.5.6 is COMPLETE only when:
- policy-bound recipient shares are immutable per authorization;
- exact recipients are resolved without arbitrary caller input;
- partial tranche slashing cannot over-release collateral;
- unallocated collateral remains canonically reserved for the staker;
- batch interruption is resumable without clearing the slash hold;
- full completion consumes authorization exactly once;
- recipient payouts and Vault accounting are exact;
- payer escrow remains untouched;
- Level 1 qualification passes;
- retained Compute Level 2 qualification passes on the same exact implementation SHA;
- durable evidence records that SHA.

Next canonical step:

**CMP-1.5.7 — Reward accounting**


## Completion evidence

CMP-1.5.6 is **COMPLETE**.

Authoritative qualified implementation SHA:

`306cd68139963c11bf346db8e700fa6cf40bac4d`

Current `main` observed at closeout:

`27ae1873edcca8fb05dec9f4e70af9832b5dafe2`

Exact-head qualification:

- Compute Market Qualification #119 — run `36965709094` — **PASS**;
- retained `Compute*.t.sol` app integration suite — **PASS**;
- CMP-1.5.6 mechanical verifier — **PASS**;
- Solidity Contracts #3998 — run `36965709076` — **PASS** on the Compute fast path;
- 420Docs Qualification #4211 — run `36965709077` — **PASS**;
- Genesis Address Authority #797 — run `36965709102` — **PASS**;
- 420Registry REG-AUDIT-4 #632 — run `36965709142` — **PASS**;
- 420Indexer #1615 — run `36965709084` — **PASS**.

Durable machine-readable evidence:

`docs/compute-market/CMP-1.5.6-QUALIFICATION-EVIDENCE.json`

The authoritative qualified implementation head includes the test-setup correction that preserves the governance prank before distribution-policy publication. This closeout commit sequence is evidence/documentation-only relative to that qualified implementation SHA. It does not modify executable source, tests, workflows, dependencies, configuration, interfaces, deployment state, or generated/runtime artifacts.

Repository-wide Level 3 qualification remains intentionally deferred to **CMP-1.5.13 — Phase closeout**.

Next canonical step:

**CMP-1.5.7 — Reward accounting**

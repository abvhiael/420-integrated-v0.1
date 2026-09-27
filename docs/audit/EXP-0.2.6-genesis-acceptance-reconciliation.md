# EXP-0.2.6 — Genesis acceptance-criteria ownership map

**Status:** acceptance map committed; exact-head CI qualification required before closeout.  
**Machine-readable map:** `docs/audit/EXP-0.2.6-genesis-acceptance-criteria.json`.

## Objective

EXP-0.2.6 turns Part 9 of the originating Explorer audit into a repository-enforced acceptance map.

The audit requires ten formal questions to be answered before 420Explorer can be classified as Genesis-qualified. For each criterion, the map now records:

- exact acceptance question;
- current status;
- verification method;
- required evidence;
- primary owner milestone;
- supporting owner milestones;
- mapped Genesis-blocking findings;
- source anchors.

The map preserves the audit rule that **unverified is neither failed nor passed**.

## Status discipline

All ten acceptance criteria are currently `unverified`.

EXP-0.2.6 does not claim that implementation, deployment, security, end-to-end or final-release criteria are already satisfied. It defines the proof required later.

A criterion can become `satisfied` only when:

1. every required evidence item exists;
2. the evidence applies to the exact applicable release candidate;
3. every mapped Genesis-blocking finding is resolved;
4. no mandatory runtime/deployment evidence has been substituted by source-only CI evidence.

Final acceptance authority belongs to **EXP-8**.

## Acceptance ownership

### AC-1 — independently inspect supported blocks, transactions and addresses

Primary owner: **EXP-2**.  
Supporting owners: EXP-4, EXP-7 and EXP-8.

The proof must cover representative block/transaction/address inspection, authoritative provenance, required fee display, historical block-producer attribution and mandatory event/log inspectability.

### AC-2 — accurate authoritative network information

Primary owner: **EXP-1**.  
Supporting owners: EXP-2, EXP-3, EXP-7 and EXP-8.

The proof must bind the Indexer to approved chain-420 infrastructure and compare indexed/presented data with authoritative network data while preserving wrong-chain/stale/degraded fail-closed behavior.

### AC-3 — operational, consistent and recoverable ingestion/indexing

Primary owner: **EXP-1**.  
Supporting owners: EXP-6, EXP-7 and EXP-8.

This criterion owns startup/catch-up, restart/resume, checkpointing, reorg repair, finalized-conflict handling, rebuild, consensus-provider wiring and deployed resilience evidence.

### AC-4 — correct contracts, addresses, ABIs, Registry and protocol integrations

Primary owner: **EXP-3**.  
Supporting owners: EXP-5, EXP-7 and EXP-8.

The proof must reconcile frozen predeploy authority, ProtocolRegistry runtime identity/publications, ABI/descriptor provenance and direct canonical Registry reads with the Indexer projection.

### AC-5 — Genesis-required workflows functional

Primary owner: **EXP-4**.  
Supporting owners: EXP-2, EXP-3, EXP-5, EXP-7 and EXP-8.

The final required workflow set must first resolve the governance-scope ambiguity. Every required workflow must then be exercised through production-equivalent UI/API paths.

### AC-6 — backend/frontend/Indexer/infrastructure integrated and tested

Primary owner: **EXP-7**.  
Supporting owners: EXP-1, EXP-2, EXP-4, EXP-5 and EXP-8.

This requires the deployed stack, all required Explorer→Indexer routes, Registry/consensus integration and end-to-end browser/API evidence.

### AC-7 — security, data integrity and operational risks addressed

Primary owner: **EXP-6**.  
Supporting owners: EXP-2, EXP-3, EXP-4, EXP-7 and EXP-8.

The proof includes security review/testing, untrusted metadata/log handling, authority/finality invariants, fail-closed behavior and production-equivalent recovery evidence.

### AC-8 — deployment complete and reproducible

Primary owner: **EXP-7**.  
Supporting owners: EXP-6 and EXP-8.

The deployment must be version-pinned, free of unresolved placeholders, reproducible from a clean environment and backed by configuration/readiness/recovery evidence.

### AC-9 — all required suites pass on exact release candidate

Primary owner: **EXP-8**.

Every mandatory suite must execute against the exact release candidate and required runtime environment. Earlier-head passing evidence cannot substitute.

### AC-10 — sufficient recorded evidence for final decision

Primary owner: **EXP-8**.

EXP-8 must consolidate AC-1 through AC-9, verify all Genesis-blocking findings are closed, resolve remaining scope ambiguity, bind every artifact/run to the exact release candidate, and produce the final qualification record.

## Finding traceability

The map imports the blocker relationships from `EXP-0.2.5-genesis-gap-register.json`.

No post-Genesis enhancement is mapped as a blocking condition.

Current blocking relationships include:

- AC-1: deployment, transaction-fee, historical producer and event-inspection gaps;
- AC-2: Indexer deployment and canonical RPC binding;
- AC-3: Indexer/RPC/consensus/recovery and historical-producer gaps;
- AC-4: ProtocolRegistry and ABI/descriptor provenance;
- AC-5: governance scope plus deployment, consensus and required workflow gaps;
- AC-6: Indexer/Explorer deployment plus Registry and consensus integration;
- AC-7: event-inspection qualification and production-equivalent resilience;
- AC-8: Explorer deployment and operational recovery;
- AC-9: no static finding is invented; this criterion is proved only by release-candidate execution;
- AC-10: governance scope must be resolved in addition to all prior acceptance evidence.

## Automated gate

`scripts/verify-exp-0-2-6-genesis-acceptance.py` fails closed unless:

1. exactly AC-1 through AC-10 exist in order;
2. their questions match Part 9 of the original audit;
3. every criterion remains `unverified` at EXP-0.2.6;
4. every criterion has a primary owner, verification methods and required evidence;
5. every primary/supporting owner is within EXP-0 through EXP-8;
6. every mapped blocker exists in EXP-0.2.5 and is `genesis_blocking: true`;
7. no post-Genesis enhancement is mapped as a blocker;
8. every Genesis-blocking finding with acceptance-criteria references is represented by the corresponding acceptance criterion;
9. final decision authority remains EXP-8;
10. the exact-release-candidate and unverified-not-passed rules remain present.

The verifier writes `exp-0-2-6-evidence/summary.json` and `criteria.tsv`.

## Completion condition

EXP-0.2.6 is qualified when the dedicated verifier, Explorer/Indexer regression suite, documentation qualification and repository-wide qualification all pass on the same exact PR head and the evidence artifact is uploaded.

This milestone qualifies the **acceptance map**, not 420Explorer itself.

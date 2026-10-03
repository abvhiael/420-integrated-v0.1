# CMP-2.3 — Replaceable matching engine

Status: **implementation / Level 1 + Level 2 qualification in progress**

Canonical roadmap definition:

> Schedulers propose matches; contracts remain authoritative.

## Scope

CMP-2.3 introduces `ComputeMatch420` as the authoritative matcher for the new CMP-2.1 worker-offer and CMP-2.2 compute-request surfaces.

Schedulers are deliberately untrusted and replaceable. Any scheduler can propose an eligible request/offer pair, but a proposal grants no funding, settlement, execution, capacity, provider, requester, payer or acceptance authority. The contract independently fetches and checks the canonical request and offer.

The request owner performs acceptance. Provider-side market consent in this step is the still-effective, exact-revision published offer. The accepted match is write-once and freezes the exact request/offer revisions, their canonical commitments, provider/node/resource ancestry, owner/payer/operator/settlement identities, compatible resource/runtime/capability/jurisdiction terms, request policy commitments, partition plan, advertised capacity, fixed price and bounded execution deadline.

## Authoritative compatibility checks

A proposal is eligible only while:

- the request remains effective;
- the offer remains effective;
- request and offer revisions equal the proposed revisions;
- canonical request and offer commitments still equal the proposed commitments;
- compute/resource class matches;
- runtime profile matches;
- capability profile matches;
- jurisdiction commitment matches;
- pricing policy ID and version match;
- fixed native-$420 price is nonzero and does not exceed the request maximum;
- the request's aggregate partition × replica × capacity quantity fits within the offer's advertised capacity.

A request can have proposals from multiple schedulers, but only one accepted match.

## Explicit non-authority

CMP-2.3 does **not**:

- reserve or consume worker capacity;
- create Vault obligations or move funds;
- broaden pricing beyond the current qualified fixed-price offer;
- mutate provider, node or resource ownership;
- grant a scheduler acceptance authority;
- create execution or settlement authority;
- claim live deployment.

Those responsibilities remain with later canonical steps, especially CMP-2.4 pricing, CMP-2.5 capacity-aware assignment, CMP-2.6 scheduler redundancy/non-authority, and existing qualified funding/job components.

## Qualification

CMP-2.3 is the first offers/requests/matching convergence point. Qualification therefore includes ordinary Level 1 targeted checks plus the deferred Level 2 retained Compute Market integration suite. Level 3 remains reserved for CMP-2.8 phase closeout.

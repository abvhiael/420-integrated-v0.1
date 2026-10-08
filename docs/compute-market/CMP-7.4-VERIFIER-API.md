# CMP-7.4 — Verifier API

Status: **IMPLEMENTED — Level 1 exact-head qualification pending.**

## Canonical purpose

Expose verifier identity/capability and job-verification read surfaces while preserving the canonical verifier-policy, signed-verdict, quorum, challenge and dispute authorities implemented in CMP-1.4.

## Requirements

- chain-scoped verifier lookup by canonical verifier ID;
- expose operator, lifecycle state, verifier classes and policy references as projections;
- expose job verification decision reference, policy, participating verifiers and challenge deadline;
- never convert an indexer/API record into verdict, correctness, settlement or slash authority;
- mark every record non-authoritative with explicit finality;
- fail closed when backing verifier/verification projections are unavailable.

## Implementation

`GET /v1/compute/verifiers/:verifierId` and `GET /v1/compute/verifications/:jobId` are added to `@420/compute-api`. Both are read-only projection endpoints. Canonical verification remains owned by the accepted on-chain policy and verifier decision graph.

## Qualification

Level 1: TypeScript build, verifier identity/capability projection tests, verification/challenge projection tests and unavailable-backend negative coverage. Level 2 remains CMP-7.5.

## Next canonical step

**CMP-7.5 — Research project API**

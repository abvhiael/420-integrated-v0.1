# CMP-7.2 — Job submission API

Status: **IMPLEMENTED — Level 1 exact-head qualification pending.**

## Canonical purpose

Expose a bounded developer-facing job submission API that prepares the already-qualified canonical Compute request for Wallet authorization without becoming a signing, custody, funding, matching, verification or settlement authority.

## Requirements

- accept explicit chain identity, operation ID, request ID and canonical CMP request payload;
- reuse `@420/sdk` request validation and canonical contract resolution;
- return an unsigned `ComputeRequestRegistry420` write intent and require Wallet authorization;
- reject cross-chain requests, malformed IDs, expired/invalid requests and secret material;
- provide read-back through a non-authoritative projection interface with explicit finality;
- keep private inputs and credentials out of request/API diagnostics;
- bound HTTP request bodies and normalize numeric JSON fields without weakening uint semantics.

## Implementation

A new `@420/compute-api` service package provides the transport-independent job API plus a minimal Node HTTP server. `POST /v1/compute/jobs` returns `READY_FOR_WALLET_AUTHORIZATION`; it never broadcasts or signs. `GET /v1/compute/jobs/:jobId` returns a projection marked `authoritative:false`.

## Qualification

Level 1 owns strict TypeScript build and targeted API tests for valid submission, chain mismatch, secret rejection, non-authoritative reads, malformed routes and method handling. The SDK is built as a dependency. No Solidity, Genesis or global qualification is required for this API-only step.

## Milestone

CMP-7.2 is an ordinary Level 1 step. Level 2 remains deferred to CMP-7.5 API convergence.

## Next canonical step

**CMP-7.3 — Worker API**

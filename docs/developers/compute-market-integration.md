---
title: Compute Market developer integration
audience:
  - developer
category: developer
status: development
version: current
---

# Compute Market developer integration

CMP-7 provides the developer-facing SDK, API, Indexer and CLI surfaces for the canonical Compute Market. These tools are clients and projections, not protocol authorities.

## Authority model

State-changing Compute operations terminate in canonical contracts and require the appropriate Wallet/Smart Account authorization. The SDK and job API may prepare an intent, but they do not sign, hold keys, move funds, choose verifiers, settle rewards or override canonical lifecycle state.

Indexer and analytics responses are explicitly authoritative: false. Use them for discovery, history and efficient reads; reconcile security-sensitive decisions against canonical chain state.

## SDK

@420/sdk exports createComputeSdk420(host). It validates selected chain identity, resolves the verified canonical Compute contract catalogue, reuses canonical request validators, prepares unsigned request/cancellation intents, requires Wallet authorization, and does not accept or manage private keys, mnemonics or seed phrases.

## Job/API service

@420/compute-api exposes a versioned v1 service.

| Method | Route | Purpose |
| --- | --- | --- |
| POST | /v1/compute/jobs | validate a request and prepare an unsigned Wallet-authorized submission intent |
| GET | /v1/compute/jobs/:jobId | job projection |
| GET | /v1/compute/workers/:workerId | worker/capacity projection |
| GET | /v1/compute/verifiers/:verifierId | verifier identity/capability projection |
| GET | /v1/compute/verifications/:jobId | verification/challenge projection |
| GET | /v1/compute/research/projects/:projectId | research-project projection |
| GET | /v1/compute/research/projects/:projectId/results | bounded research-result projections |

Submission requires an explicit chain ID, operation ID, request ID and canonical request payload. Secret-bearing keys are rejected. A successful POST returns READY_FOR_WALLET_AUTHORIZATION, not a transaction hash and not canonical state.

## Compute Indexer

420Indexer consumes artifact-derived 420Compute event descriptors and rebuilds projections in canonical block/transaction/log order. Deployment addresses are bound explicitly; they are never guessed from contract names.

Direct read routes include /v1/compute/jobs/:jobId, requests/:requestId, workers/:workerId, verifiers/:verifierId, research/projects/:projectId and rewards/:rewardId, each with an explicit chainId query. If Compute projection support is unavailable, the HTTP transport fails closed with 503.

## Historical analytics

Compute historical analytics operate on a bounded block range over the canonical event journal. Current outputs include job creation/terminal counts, reward count/value, unique reward beneficiaries and contribution/reward totals by metric. Analytics reject duplicate reward identities and remain non-authoritative.

## Finality and retries

Read projections must be interpreted under the selected network finality policy. After a reorg, 420Indexer rolls back orphaned events and reconstructs from canonical logs. Preserve operation identity and reconcile canonical state before retrying a state-changing request after a timeout.

## Privacy

Do not submit raw workloads, datasets, credentials, access tokens, private prompts, private keys or result bytes through public Compute indexing surfaces. The Compute descriptor/read model rejects secret/private-field contamination.

## CLI

The repository-native 420 compute commands are convenience clients over these same boundaries. They never create a CLI-owned keystore. State-changing submission remains an unsigned plan handed to the Wallet authorization flow.

## Related

- [SDK and CLI integration](sdk-and-cli.md)
- [420Indexer API](indexer-api.md)
- [Wallet and Smart Account integration](wallet-and-smart-accounts.md)
- [Networks and manifests](networks-and-manifests.md)

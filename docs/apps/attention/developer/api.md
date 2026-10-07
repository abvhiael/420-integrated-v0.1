# 420 Attention API and privacy boundary

Derived APIs may expose public campaign metadata, consent status appropriate to the authenticated user, proof/reward status and campaign liability summaries.

Public APIs must not expose raw behavioral telemetry, private targeting data, delivery endpoints or unrelated personal information. Security-sensitive clients should re-read canonical proof/reward state.

## Browser projection contract

The qualified ATTENTION-AUDIT-6 browser consumes the ATTENTION-AUDIT-7 service through versioned read and transaction-review contracts.

Read projections use schema `420-attention-projection-v1` and carry:

- `canonical: true` only when the response was rebuilt from current canonical Indexer/RPC source state;
- `authoritative: false` because the projection service is never protocol authority;
- source chain ID;
- source block hash and transaction/log position;
- only the bounded public application fields required by the requested view.

The client consumes:

- `GET /v1/attention/runtime`;
- `GET /v1/attention/campaigns`;
- `GET /v1/attention/campaigns/:campaignId`;
- `GET /v1/attention/accounts/:account`;
- `GET /v1/attention/proofs/:proofId`;
- `GET /v1/attention/rewards/:rewardId`;
- `POST /v1/attention/prepare/:kind`.

Mutation preparation uses `420-attention-transaction-review-v1`. A prepared review contains exact canonical-source provenance, target, calldata and optional native-420 value. The browser independently checks chain identity and canonical target, simulates with `eth_estimateGas`, and only then allows explicit Wallet submission.

## Indexer and RPC source model

420Indexer owns canonical block/log ingestion, ordering, rollback and replay. The Attention service does not create an independent chain index.

The service rebuilds from the current canonical 420Indexer log history for the configured Attention contracts. After an Indexer reorg rollback/replay, the next rebuild discards the old projection and reconstructs from the replacement branch.

Two canonical events intentionally omit browser-required public fields:

- `CampaignCreated` does not emit all immutable campaign economics/policy/window fields;
- `AttentionProofCommitted` does not emit verifier or observation timestamp.

The service therefore uses block-scoped `eth_call` against the owning canonical contract for those objects at their indexed event block. These calls enrich rebuild input with canonical public state; they do not create service authority.

## Retry, replay and privacy

Indexer/RPC transport retries are bounded. Exact duplicate canonical event identities are idempotent. Conflicting reuse of one chain/block/transaction/log identity fails closed.

Public projection input recursively rejects raw telemetry, behavioral/browsing data, private targeting/audience data, credentials, tokens, private keys, mnemonics, passwords and similar secret classes.

Evidence hashes and policy commitments may be projected as hashes. They never authorize publication of the underlying private material.

The service does not sign, hold Wallet authority, hold sponsor funds or redefine Attention state.

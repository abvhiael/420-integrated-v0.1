# ATTENTION-AUDIT-7 — Indexer/API/service projection

Status: **COMPLETE — Level 1 service qualification and Level 2 Attention app-integration qualification passed.**

## Canonical requirement

ATTENTION-AUDIT-7 implements only the non-canonical projection/API required by the qualified ATTENTION-AUDIT-6 browser.

Required properties:

- preserve 420Indexer ownership of canonical block history, rollback and replay;
- do not create an independent chain index;
- expose only public/rebuildable Attention state;
- preserve canonical-source provenance;
- exclude raw behavioral telemetry and private audience/targeting data;
- support deterministic rebuild after canonical reorg;
- use bounded retries for transient upstream failures;
- make duplicate canonical event identity idempotent;
- fail closed on conflicting event identity/provenance;
- expose campaign, account/consent, proof and reward projections;
- prepare only bounded Attention transaction review payloads for Wallet authorization;
- remain non-canonical and non-signing.

## Architecture

`attention/service/` is an Attention-specific derived service over the existing 420Indexer log API.

420Indexer remains responsible for canonical block/log ingestion and reorg rollback. The Attention service fetches current canonical log pages by configured Attention contract address in ascending order and rebuilds a fresh in-memory projection. Rebuild then atomically replaces the previous projection.

Two emitted events do not contain all browser-required public canonical state:

- `CampaignCreated` omits immutable metadata/policy/economic/window fields;
- `AttentionProofCommitted` omits verifier and observation timestamp.

For those events only, the source adapter performs block-scoped `eth_call` reads against the owning canonical contract at the indexed event block and merges the public canonical fields into the rebuild input. This avoids inventing fields and avoids creating a second canonical database.

## API

Versioned browser-facing routes:

- `GET /v1/attention/runtime`
- `GET /v1/attention/campaigns`
- `GET /v1/attention/campaigns/:campaignId`
- `GET /v1/attention/accounts/:account`
- `GET /v1/attention/proofs/:proofId`
- `GET /v1/attention/rewards/:rewardId`
- `POST /v1/attention/prepare/:kind`

Projection schema: `420-attention-projection-v1`.

Transaction review schema: `420-attention-transaction-review-v1`.

Responses that derive from current canonical Indexer/RPC source state carry `canonical: true` as a provenance statement and `authoritative: false` to make clear that the service itself is not protocol authority.

## Privacy and failure behavior

The projection recursively rejects fields matching raw telemetry, behavioral/browsing data, private audience/targeting data, credentials, bearer tokens, private keys, mnemonics, passwords and similar secret classes.

Indexer requests use no browser/user credentials and bounded exponential retry. Deterministic client/input errors are not converted into success. Duplicate exact event identities are ignored; conflicting use of one chain/block/transaction/log identity fails closed.

## Qualification model

AUDIT-7 is an ordinary app step with Level 1 service qualification. It is also the first browser+service convergence milestone, so a retained Level 2 Attention-only integration pass is required.

Level 1:
- exact-head checkout;
- service syntax/policy checks;
- service unit/negative/privacy/reorg/idempotency/retry tests;
- production-candidate build;
- repository verifier.

Level 2:
- exact same SHA;
- retained ATTENTION-AUDIT-6 browser qualification;
- retained focused `Attention*420.t.sol` contract suite;
- browser/service API contract verification.

Repository-wide Foundry, Genesis/address authority, 420 Integrated, Geth and global Docs qualification remain deferred to Level 3.

## Completion evidence

Qualified implementation:
- implementation SHA: `8c4c50017df038172ff26ca207c01d47c4c2d622`;
- base/main SHA: `f674fbed767efc126da253c66800e38d030dc1dd`;
- branch: `audit/420attention-complete-20261006`;
- PR: #557;
- workflow run: `37572383181`;
- Level 1 job `112633667885` (`service-level-1`): PASS;
- Level 2 job `112633891738` (`app-integration-level-2`): PASS;
- service exact-head checkout: PASS;
- service static/policy checks: PASS;
- service unit/adversarial/privacy/reorg/retry suite: **12 passed, 0 failed, 0 skipped**;
- service production-candidate build: PASS;
- AUDIT-7 repository verifier: PASS;
- retained ATTENTION-AUDIT-6 browser qualification: PASS;
- retained focused `Attention*420.t.sol` contract suite: PASS;
- browser/service contract verifier: PASS;
- evidence SHA: this and subsequent roadmap-only closeout commits are evidence-only and inherit the qualified implementation SHA;
- blockers for ATTENTION-AUDIT-7: none repository-side;
- intentionally deferred: live Indexer/RPC endpoints, Registry-resolved component addresses and production-equivalent deployment evidence belong to ATTENTION-AUDIT-8;
- next canonical roadmap step: **ATTENTION-AUDIT-8 — Testnet deployment and integration qualification**.

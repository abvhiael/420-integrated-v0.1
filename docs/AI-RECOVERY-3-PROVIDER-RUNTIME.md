# AI-RECOVERY-3 — Provider/runtime control plane

Status: **COMPLETE — QUALIFIED**

## Scope

AI-RECOVERY-3 adds the first operational off-chain runtime package for 420AI and 420 ComputeMarket at `420-ai-provider/`.

The runtime does not replace canonical contracts. It is a reconstructable provider control plane that consumes canonical state and performs off-chain execution behind explicit ports.

## Delivered

- provider runtime manifest schema and deterministic Keccak-256 commitment;
- HTTPS/expiry/capability/model-deployment manifest validation;
- canonical AI provider + AI job + Compute job + Compute request reconciliation;
- ACTIVE/stake/provider-reference eligibility checks;
- AI↔Compute requester, workload, privacy, verification, deadline and spend invariant checks;
- state-aware MATCHED -> ACCEPTED -> RUNNING provider progression;
- payload retrieval only for RUNNING jobs;
- payload commitment verification before inference;
- pluggable inference backend interface;
- off-chain result storage interface;
- deterministic output and execution-manifest commitments;
- charge ceiling enforcement against funded amount and AI maximum;
- external transaction port for provider-authorized chain writes;
- final Compute receipt submission interface;
- non-authoritative provider status/API projection;
- unit tests for lifecycle progression, payload tampering, provider mismatch, spend overflow and manifest security;
- dedicated GitHub Actions qualification workflow.

## Security boundary

The runtime intentionally contains no wallet/validator/private-key custody. Provider-authorized transactions must be submitted by an external qualified signer/transaction adapter.

A worker result does not self-verify or self-settle. The runtime stops at result commitment + receipt generation. Canonical verification and settlement remain downstream protocol stages.

## Remaining integration work

The control-plane core is now present, but production/testnet provider operation still requires concrete adapters:

1. RPC/420Indexer canonical-state reader;
2. provider transaction/signing adapter;
3. 420Storage/420Gateway payload transport;
4. concrete GPU/model-serving backend;
5. policy-aware encryption/decryption transport;
6. concrete verification/evidence adapters;
7. metrics/process supervision;
8. deployment/service manifests;
9. user-facing API consumed by `ai.420integrated.org`.

Those are integration surfaces over this runtime, not competing sources of job authority.


## Qualification closeout

AI-RECOVERY-3 passed the dedicated 420 AI Provider Runtime workflow plus Solidity Contracts, 420 Integrated Qualification, 420Docs Qualification, Wallet Web, Wallet Extension and Wallet Mobile verification on exact head `beb772f09125329ea84442e30f562f9e4a18b0a1`.

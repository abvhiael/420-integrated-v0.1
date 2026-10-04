# 420AI V1 Architecture

Status: **FROZEN FOR IMPLEMENTATION**

420AI is the native distributed artificial-intelligence protocol of 420 Integrated. It provides canonical model identity, immutable model-version commitments, provider deployments, AI request semantics, result commitments, verification-policy references, and a narrow adapter into the shared 420 ComputeMarket. Actual model inference, training, fine-tuning, embeddings, generation, and accelerator execution occur off-chain on `420ai`/compute providers. AI execution is never part of consensus or ordinary chain liveness.

## Core architecture rule

420AI defines **what AI computation is requested and what model/result semantics apply**. 420 ComputeMarket defines **who may execute the workload, on what declared resources, under what price/SLA/verification terms, and how execution is settled**.

420AI must not duplicate a second compute marketplace inside AI-specific contracts.

```text
420AI request/model semantics
        |
        v
AIComputeAdapter420
        |
        v
420 ComputeMarket
        |
        v
off-chain provider execution
        |
        v
result commitment / verification
        |
        v
AI result state + settlement evidence
```

## Genesis compatibility

The following predeploy identities remain frozen and must not be deleted or silently repurposed:

- `0x...042f` — AIProviderRegistry
- `0x...0430` — AIModelRegistry
- `0x...0431` — AIJobManager
- `0x...0432` — AIJobEscrow
- `0x...0433` — AIReputationRegistry

Mature V1 implementations may harden, wrap, route, or constrain these identities while preserving their documented discovery purpose. No new AI predeploy address is allocated by this architecture.

### Required compatibility direction

- `AIProviderRegistry` becomes a compatibility/discovery facade over canonical provider/deployment state and may not create unrestricted provider authority.
- `AIModelRegistry` becomes the canonical model/model-version registry or a stable facade over it.
- `AIJobManager` becomes a constrained AI request/job facade; it may not expose arbitrary status mutation.
- `AIJobEscrow` becomes a compatibility adapter into 420Vault/Compute settlement; it may not let governance choose arbitrary recipients.
- `AIReputationRegistry` becomes a legacy compatibility/evidence adapter; 420Trust is the canonical destination for authenticated AI/compute performance signals.

## Canonical objects

### AIModel

Stable model-family identity.

Minimum fields:

- `modelId`
- creator/registrant identity reference
- model family metadata hash
- license-policy reference
- createdAt
- revision
- state

A model ID is stable and never reassigned.

### AIModelVersion

Immutable semantic/artifact version.

Minimum fields:

- `modelVersionId`
- `modelId`
- version number or semantic version commitment
- artifact manifest hash
- weights/artifact hash or root
- runtime profile ID
- minimum compute requirement ID
- input/output schema hash
- context/resource constraints
- verification profile ID
- license-policy reference
- createdAt
- active/deprecated state

Material model semantics are immutable for a model-version identity. A changed artifact, runtime, schema, license condition, or verification contract that could alter behavior requires a new version identity.

### AIModelDeployment

Provider-specific offer to execute one model version.

Minimum fields:

- `deploymentId`
- `providerId`
- `modelVersionId`
- compute-offer/profile reference
- AI service-pricing policy ID
- endpoint/service-manifest hash
- endpoint expiry
- region/availability commitments
- SLA policy ID
- createdAt
- revision
- state

Model ownership and model deployment are separate authority domains. Registering a model does not authorize deployment by arbitrary providers, and deploying a model does not transfer model ownership.

### AIRequest

Canonical AI-level workload request.

Minimum fields:

- `requestId`
- requester account
- `modelVersionId`
- deployment constraint or open-selection policy
- input commitment
- input schema/version reference
- privacy policy ID
- verification profile ID
- maximum user-authorized spend
- deadline/expiry
- computeRequestId
- createdAt
- state

Large prompts, images, audio, video, datasets, context windows, private documents, and generated outputs remain off-chain. Canonical chain state contains only commitments and fields required for authorization, matching, settlement, dispute handling, and reconstructability.

### AIResult

Canonical result commitment, not the raw result payload.

Minimum fields:

- `resultId`
- `requestId`
- `computeJobId`
- `providerId`
- `modelVersionId`
- output commitment
- result manifest hash
- verification outcome/reference
- committedAt
- state

A result commitment proves what output was committed, not that an arbitrary model answer is objectively true.

## AI workload classes

V1 must support a versioned namespace rather than one hard-coded inference path. Initial classes:

- `AI_INFERENCE_TEXT`
- `AI_INFERENCE_MULTIMODAL`
- `AI_IMAGE_GENERATION`
- `AI_AUDIO_GENERATION`
- `AI_VIDEO_GENERATION`
- `AI_EMBEDDING`
- `AI_RERANK`
- `AI_FINE_TUNE`
- `AI_BATCH_INFERENCE`

The exact implementation may initially activate only a subset. Unsupported classes fail closed rather than being interpreted loosely.

## Provider and deployment rules

Provider identity is shared with ComputeMarket where practical. AI-specific provider status must not create a duplicate economic identity that can diverge silently from the compute provider identity.

A deployment is operational only when:

1. its deployment state is ACTIVE;
2. the referenced model version is active and compatible;
3. the provider is operational under ComputeMarket;
4. the referenced compute offer/resource is operational;
5. the endpoint/service manifest is nonzero and unexpired where applicable;
6. required pricing, SLA, privacy, and verification policies are active.

## Request lifecycle

Normative lifecycle:

`CREATED -> FUNDED -> MATCHED -> ACCEPTED -> RUNNING -> RESULT_COMMITTED -> VERIFIED -> SETTLED`

Exceptional states:

- `CANCELLED`
- `EXPIRED`
- `FAILED`
- `DISPUTED`
- `REFUNDED`

No generic administrator function may assign arbitrary lifecycle states. Every transition must have an explicit predecessor set, authorization rule, event, and settlement consequence.

A terminal request cannot be reopened or regain spend authority.

## ComputeMarket integration

420AI creates or binds a `ComputeRequest` through `AIComputeAdapter420`.

The adapter must bind at minimum:

- AI request ID
- model version
- workload class
- compute requirements
- maximum spend
- deadline
- privacy constraints
- verification profile
- permitted deployment/provider constraints

ComputeMarket returns/binds:

- compute request ID
- accepted offer/match
- provider/resource identity
- compute job ID
- execution receipt chain
- settlement/verification references

420AI may not broaden the user's compute or payment authorization during adaptation.


### AI-AUDIT-4 current ComputeMarket integration decision

The mature adapter binds directly to the current ComputeMarket component graph and does not create a parallel AI marketplace.

- The **signed CMP request** must be owned by the AI requester and may narrow, but never enlarge, the AI request's maximum spend or deadline.
- AI workload class and input commitment map exactly into the CMP request. The model-version schema becomes the CMP output-schema commitment.
- Privacy policy, verification profile, model version, compute-requirement identity, deployment constraint, workload, input/output commitments, narrowed spend ceiling and narrowed deadline are bound into the deterministic AI-to-CMP manifest commitment.
- The selected AI deployment constrains the exact accepted CMP offer. The AI provider's `computeProviderRef` must equal the accepted CMP provider identity.
- The **accepted priced match** freezes the CMP resource, payer, canonical provider-derived beneficiary and accepted amount. None may exceed or contradict the earlier AI/CMP request binding.
- The canonical CMP result commitment is copied unchanged into the AI job. AI stores a deterministic commitment to the CMP assignment/result evidence tuple rather than inventing a second result.
- AI verification advances only after a matching **verified entitlement** binds the same request, match, result commitment, verifier, payer, provider, resource, beneficiary and accepted economic ceiling.
- Canonical CMP settlement and payer-refund references are observed and retained by the adapter. Compatibility escrow/custody state reconciliation remains **AI-AUDIT-5**, so AI-AUDIT-4 does not fabricate transfers or bypass 420Vault/CMP settlement authority.

## Pricing

AI service pricing and raw compute pricing are distinct layers.

AI service pricing may account for:

- token/input/output units
- model licensing
- optimized inference service
- caching
- fine-tuned model access
- application-level SLA

Compute pricing may account for GPU/CPU/accelerator time or other resource units.

The final accepted job binds all economically material terms or a deterministic pricing formula with a user-authorized maximum. A provider may never settle above that ceiling.

## Payments and custody

Native `$420` is the default settlement asset for Genesis AI compute.

420AI must not maintain an unrestricted standalone escrow. New custody/accounting should use 420Vault/approved settlement primitives so that reserved balances, claimable provider entitlements, refunds, replay protection, and non-confiscatory emergency behavior are consistent across the ecosystem.

Legacy `AIJobEscrow` must not retain arbitrary-recipient release authority.

## Verification semantics

Execution evidence, output commitment, and correctness are separate concepts.

Supported verification-policy classes may include:

- requester acknowledgement
- deterministic re-execution
- quorum/attestation
- trusted-execution-environment attestation
- zero-knowledge proof where available
- oracle/external verifier
- application-specific verifier

A provider signature proves that the provider signed a claim. It does not by itself prove that arbitrary computation was performed correctly or that model output is factually true.

## Privacy

Private inputs and outputs remain off-chain and should be encrypted where appropriate. Canonical state must not require plaintext prompts, private datasets, user documents, generated private media, private embeddings, secrets, API credentials, or raw model context.

Privacy-policy profiles may constrain provider classes, region, TEE requirements, retention commitments, model/deployment selection, and whether public result commitments are permitted.

No AI administrator, governance role, registry, or ComputeMarket component receives universal plaintext access by protocol design.

## Staking and slashing

Provider stake is economic assurance, not proof of model quality or confidentiality.

Objectively provable slashable conduct may include:

- forged execution receipts
- double settlement
- conflicting signed commitments
- resource/deployment identity fraud
- provable attestation fraud
- accepted-service nonperformance where evidence is objectively defined by the bound policy

Subjective model quality, creativity, style preference, factual disagreement without a bound verifier, or user dissatisfaction are not automatically slashable conditions.

## 420Trust integration

AI/compute performance evidence belongs in 420Trust rather than a mutable universal reputation score.

Candidate metrics:

- accepted jobs
- completed jobs
- objective failures
- disputes
- upheld disputes
- execution-time bands
- SLA adherence
- successful verification/attestation events
- slash events
- settlement failures

Consumers choose policies and weighting. 420AI must not create a protocol-wide social/credit score.

## Emergency behavior

Emergency authority may narrowly stop:

- new deployments
- new requests
- new matching/acceptance
- selected verification/settlement routes where unsafe

It may not:

- redirect user funds
- redirect provider earnings
- replace model/output commitments
- fabricate results
- reveal private inputs or outputs
- choose arbitrary settlement beneficiaries
- rewrite completed job history

Already-earned valid entitlements remain payable unless a bound dispute/verification path says otherwise.

## Proposed V1 contract/module structure

```text
contracts/src/ai/
AIIds420.sol
AIAuthorization420.sol
AIPolicyRegistry420.sol
AIModelRegistry420.sol
AIModelDeploymentRegistry420.sol
AIRequestRegistry420.sol
AIResultRegistry420.sol
AIComputeAdapter420.sol
AIRouter420.sol
IAI420.sol
```

Legacy predeploy contracts remain at their frozen identities as hardened implementations/facades where required.


### AI-AUDIT-3 single-authority implementation decision

The mature V1 module graph preserves one writable authority for each canonical object.

- **AIModelRegistry owns canonical model and model-version state.** A standalone `AIModelVersionRegistry420` is intentionally absent because a second writable registry would split model-version authority.
- **AIRequestRegistry420 is a read-through view over AIJobManager.** It does not duplicate request lifecycle state.
- **AIResultRegistry420 is a read-through view over AIJobManager.** It exposes committed result state without a second result mutation path.
- **AIComputeAdapter420** binds the canonical ComputeRouter graph identity and snapshots the AI request constraints, but does not advance the AI job lifecycle in AI-AUDIT-3. Validation against current Compute request/match/job economics and narrowing is **AI-AUDIT-4**.
- **AIRouter420** is immutable read/discovery only. User-authorizing writes stay on the owning module so router calls cannot obscure `msg.sender`.

## Frozen V1 invariants

- **AI-INV-001:** AI execution is off-chain and never required for consensus or ordinary chain liveness.
- **AI-INV-002:** model, model-version, deployment, provider, request, compute-job, and result identities are distinct canonical concepts.
- **AI-INV-003:** stable canonical IDs are never reassigned to different entities.
- **AI-INV-004:** material model-version semantics cannot silently change under an existing model-version ID.
- **AI-INV-005:** registering a model grants no validator, governance, custody, arbitrary deployment, or settlement authority.
- **AI-INV-006:** registering/deploying compute capacity grants no model ownership.
- **AI-INV-007:** AI requests never grant arbitrary wallet execution or transfer authority.
- **AI-INV-008:** accepted AI jobs cannot settle above the requester-authorized ceiling.
- **AI-INV-009:** no generic administrator can arbitrarily assign job/request lifecycle states.
- **AI-INV-010:** terminal requests/jobs cannot reopen or regain spend authority.
- **AI-INV-011:** no administrator may choose an arbitrary settlement recipient for a bound job.
- **AI-INV-012:** provider settlement beneficiary derives from the accepted canonical match/deployment/settlement path.
- **AI-INV-013:** unused funded value remains recoverable under the bound policy.
- **AI-INV-014:** private prompts, datasets, documents, context, raw outputs, secrets, and credentials are never required canonical plaintext state.
- **AI-INV-015:** output commitment does not imply factual truth.
- **AI-INV-016:** provider signature alone does not imply correct execution.
- **AI-INV-017:** verification semantics are explicit, versioned, and bound before settlement eligibility.
- **AI-INV-018:** AI service pricing and raw compute pricing remain separable and reconstructable.
- **AI-INV-019:** provider stake is economic assurance and is not represented as proof of confidentiality or subjective output quality.
- **AI-INV-020:** slashing requires explicit objective evidence under a versioned policy.
- **AI-INV-021:** reputation/performance evidence is separable from job routing and settlement authority.
- **AI-INV-022:** governance cannot fabricate AI results or rewrite committed outputs.
- **AI-INV-023:** emergency powers are non-confiscatory and cannot redirect valid user/provider funds.
- **AI-INV-024:** already-earned valid provider entitlements survive provider suspension unless a bound dispute path invalidates them.
- **AI-INV-025:** model deprecation blocks new use according to policy but does not rewrite historical jobs/results.
- **AI-INV-026:** deployment endpoint replacement cannot change model/provider/economic identity already bound to an accepted job.
- **AI-INV-027:** AI-to-Compute adaptation may narrow but never broaden user-authorized spend, provider, resource, privacy, or verification constraints.
- **AI-INV-028:** ComputeMarket remains usable for non-AI workloads; 420AI does not monopolize general compute resources.
- **AI-INV-029:** legacy Genesis AI predeploy identities remain discoverable and cannot silently change into unrelated protocol functions.
- **AI-INV-030:** AIReputationRegistry does not become a mutable universal provider score; authenticated evidence migrates/integrates with 420Trust.
- **AI-INV-031:** legacy AIJobEscrow cannot preserve arbitrary-recipient governance release authority in the mature implementation.
- **AI-INV-032:** job/result/settlement history is reconstructable from canonical chain state plus committed open specifications/manifests.

### AI-AUDIT-6 off-chain runtime boundary

The provider runtime is implemented under `services/420ai-provider` and follows the frozen V1 authority model:

- canonical RPC/Registry/CMP state is re-read before execution and before any retry;
- signed execution manifests and receipts are domain-separated and job/assignment/provider/resource scoped;
- private payloads remain off-chain, encrypted at rest with bounded retention and assignment-scoped authenticated data;
- retry behavior is finite and receipt submission is idempotent against a stable receipt identity;
- restart recovery reconciles from canonical state outward and never treats the local queue as protocol truth;
- operational logs redact private payloads, prompts, documents, tokens, secrets, credentials and raw byte buffers;
- the runtime gains no custody, settlement, governance, validator, identity or arbitrary lifecycle authority.

### AI-AUDIT-7 read API / indexer boundary

420AI uses the shared 420Indexer v1 public read surface rather than creating a second authoritative AI database. Current AI event descriptors cover provider, model, model-version, deployment, job, escrow and policy event families and remain deployment-address agnostic until canonical Registry/deployment configuration binds contract identities.

AI read state is reconstructed from the canonical typed protocol-event journal in block/transaction/log order. The shared Indexer owns canonical ancestry, reorg rollback and replay. AI-specific projections therefore remain rebuildable caches: every returned AI object carries `authoritative: false`, while Registry, ComputeMarket, Vault and AI contracts remain the protocol authority.

The AI read schema is versioned as `420-ai-read-v1`. Collection endpoints use the shared bounded opaque keyset cursor semantics and every query is chain scoped; deployments may additionally pin an expected AI chain ID and fail closed on mismatch.

Public AI projections are allowlisted to IDs, addresses, hashes/commitments, lifecycle/economic values and provenance. Descriptor generation rejects private-payload field classes and the reducer rejects contaminated event rows. Plaintext prompts, documents, datasets, access tokens, credentials, private keys and raw input/output bytes are never part of the public AI read model.

Job projections preserve current AI-to-CMP correlation identifiers such as `computeRequestId`, `computeJobId` and provider references, but neither the indexer nor its HTTP API may create or reinterpret canonical execution, verification, settlement or dispute authority.

### AI-AUDIT-8 user-facing client boundary

The canonical browser client lives under `ai/web` and is a thin requester-facing application over the existing AI protocol and shared 420Indexer read surface.

The client may:
- discover model, version, deployment, policy and request state through the non-authoritative `420-ai-read-v1` API;
- connect an injected EIP-1193 wallet and validate the configured target chain;
- prepare and submit requester-authorized `AIJobManager` calls such as request creation, cancellation and dispute opening;
- display Vault/funding, ComputeMarket correlation and result lifecycle state from indexed protocol evidence; and
- track wallet transaction simulation, submission, confirmation, revert, drop and reorg outcomes.

The client must not:
- store provider credentials, privileged secrets, private keys or API tokens in browser runtime configuration;
- treat indexer projections as protocol authority;
- send plaintext private AI input to public indexer routes or calldata; or
- fabricate a direct funding flow. `AIJobEscrow.fund` remains intentionally disabled and funding is bound through the canonical Vault/settlement adapter path.

The committed runtime configuration remains fail-closed until AI-AUDIT-9 materializes live network/read-service values and enables transaction feature flags.

## Implementation order

1. Freeze ComputeMarket V1 architecture.
2. Add AI/Compute canonical IDs and authorization boundaries.
3. Harden legacy Genesis AI predeploy semantics/facades without changing their addresses.
4. Implement Compute provider/resource/policy foundation.
5. Implement model/model-version/deployment registries.
6. Implement Compute offers/requests/matching.
7. Implement AI request adapter and strict job lifecycle.
8. Implement Vault-backed funding/settlement.
9. Implement receipts and verification profiles.
10. Implement 420Trust evidence adapters and dispute/emergency paths.

No frontend, large-model hosting, AI agent framework, training pipeline, or inference server implementation is part of this on-chain architecture phase.

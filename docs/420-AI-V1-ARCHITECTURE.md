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
AIModelVersionRegistry420.sol
AIModelDeploymentRegistry420.sol
AIRequestRegistry420.sol
AIResultRegistry420.sol
AIComputeAdapter420.sol
AIRouter420.sol
IAI420.sol
```

Legacy predeploy contracts remain at their frozen identities as hardened implementations/facades where required.

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

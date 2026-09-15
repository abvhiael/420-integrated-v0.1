---
title: 420AI and Compute integration
audience:
  - developer
category: developer
status: development
version: current
---

# 420AI and Compute integration

420AI owns AI request/model/result semantics. 420 ComputeMarket owns execution-provider/resource/offer/match/receipt/verification/settlement semantics. Off-chain workers perform the actual compute.

Applications must preserve that split instead of treating a model endpoint, worker queue or provider receipt as canonical job authority.

## Request path

A safe integration follows this order:

1. resolve the canonical AI/Compute contracts and selected network;
2. resolve the model family and exact immutable model-version identity;
3. bind workload class, input commitment, privacy policy, provider/resource constraints, maximum spend, deadline and verification profile;
4. obtain Wallet authorization for funding/state changes;
5. create/fund the canonical AI request;
6. allow routing/matching to narrow compatible providers/resources without broadening requester constraints;
7. wait for an accepted canonical match before treating a provider as entitled to execute;
8. deliver private inputs off-chain according to the bound privacy policy;
9. receive provider receipt/result commitment;
10. apply the request's bound verification policy;
11. settle or refund only through canonical job/ComputeMarket/Vault state.

## Lifecycle

The canonical AI job lifecycle progresses through CREATED, FUNDED, MATCHED, ACCEPTED, RUNNING, RESULT_COMMITTED, VERIFIED and SETTLED, with explicit terminal/recovery states such as CANCELLED, EXPIRED, FAILED, DISPUTED and REFUNDED.

Terminal jobs do not reopen or regain spend authority.

## Privacy

Keep prompts, context, images/audio/video, datasets, private documents, embeddings, generated private outputs, model weights when private, API credentials and other secrets off-chain.

Canonical state should contain only commitments/references needed for model identity, request authorization, matching, verification, settlement and dispute reconstruction.

A privacy policy may constrain provider/deployment class, region, retention, TEE requirements and public-result-commitment behavior. Matching may narrow these constraints; it must never weaken them.

## Result and receipt semantics

A result commitment binds the output/manifest bytes the provider claims for a specific job. It does not prove factual truth, subjective quality or correctness unless the bound verification profile establishes the relevant property.

Likewise, a provider-signed execution receipt proves that the provider signed a claim. It is not universal proof that arbitrary compute was performed correctly.

## Verification

Verification is explicit and must be bound before it can authorize settlement. Depending on the job, profiles may use requester acknowledgement, deterministic re-execution, quorum/attestation, TEE attestation, zero-knowledge proof, oracle/external verification or an application-specific verifier.

If the bound verification policy fails, settlement fails closed. Never substitute provider self-attestation where stronger verification was required.

## Settlement

Native `$420` is the default Genesis settlement asset for AI compute. Funding/escrow is Vault-backed; legacy direct custody is disabled. Settlement cannot exceed the requester-authorized maximum and cannot redirect payment to an arbitrary recipient different from the beneficiary bound by canonical accepted state.

Compute completion and financial settlement are separate facts. A provider may have a verified entitlement while Vault settlement is temporarily unavailable; applications must not label that job SETTLED until canonical settlement says so.

## Failure recovery

If a worker/provider disappears, preserve canonical request/job/match/result state and use the defined expire/rematch/fail/dispute/refund path. Rebuild off-chain queues from canonical requests/jobs and committed manifests; never reconstruct chain state from worker queues.

## Related architecture

- [420AI compute infrastructure](../architecture/infrastructure/420ai-compute-infrastructure.md)
- [420 AI application manual](../apps/ai/index.md)
- [Provider-backed integration model](provider-backed-integrations.md)

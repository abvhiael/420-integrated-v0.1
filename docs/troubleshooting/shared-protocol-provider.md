---
title: Shared protocol and provider troubleshooting
audience:
  - user
  - developer
  - operator
category: troubleshooting
status: current
version: current
---

# Shared protocol and provider troubleshooting

This registry covers failures where a canonical 420 protocol depends on discovery, provider-backed infrastructure, external evidence, off-chain delivery, or bounded adjudication. Provider outages and derived delivery failures do not rewrite canonical protocol state. When evidence is ambiguous, fail closed rather than silently substituting a lower-authority source.

## Registry, Names, Identity and 420-IS

### TRB-REGISTRY-001 — service cannot be discovered or resolves to an unexpected implementation

**Audience:** developer, operator  
**Surface:** 420 Registry  
**Severity:** blocked  
**Authority source:** canonical Registry state and approved environment/network identity  
**Retry safety:** safe for reads; conditional for writes

**What you see**

A service ID is missing, deprecated, points to an unexpected implementation/version, or differs from a cached application catalogue.

**What this usually means**

- wrong network/environment;
- stale cached catalogue or Developer Hub metadata;
- service version was superseded/deprecated;
- unapproved service ID or invalid registration state.

**Safe diagnostics**

Collect chain ID, environment, service ID, Registry address/version, canonical Registry read result, and application/catalogue version. Do not treat a local example catalogue as deployment authority.

**Recovery**

1. verify chain/environment identity;
2. read the canonical Registry directly through a qualified RPC path;
3. compare the registered service/version with the caller's expected compatibility range;
4. refresh derived catalogues/caches;
5. stop if the canonical Registry entry itself is unexpected or authority cannot be verified.

### TRB-NAMES-001 — `.420` name does not resolve as expected

**Audience:** user, developer  
**Surface:** 420 Names  
**Severity:** degraded  
**Authority source:** canonical name ownership/resolution state  
**Retry safety:** safe for reads; conditional for writes

A stale UI, resolver mismatch, wrong network, expired/deprecated record, or changed owner/resolver may explain the discrepancy. Verify the canonical record before changing ownership or resolver data.

### TRB-IDENTITY-001 — profile or credential is missing, stale, revoked or rejected

**Audience:** user, developer  
**Surface:** 420 Identity / 420-IS  
**Severity:** blocked  
**Authority source:** canonical identity/credential lifecycle state plus the relevant issuer/verifier rules  
**Retry safety:** conditional

Check subject, issuer, credential/version identifier, revocation/expiry state, authorization epoch, and network. Do not bypass revocation or expiry because a cached profile still displays the credential.

## Randomness and oracle providers

### TRB-RANDOM-001 — randomness request has no usable verified result

**Audience:** developer, operator  
**Surface:** 420 Randomness  
**Severity:** blocked  
**Authority source:** canonical request/result state and configured verification rules  
**Retry safety:** conditional

**Likely causes:** provider delay/outage, verification failure, expired request, provider mismatch, insufficient/invalid proof.

**Before retrying:** identify the original randomness request/job ID and determine whether a result has already been accepted or consumed. Never submit a second randomness-consuming action merely because a provider response timed out.

**Recovery:** verify request state, provider qualification, proof/result status and deadline; use an allowed fallback provider only if protocol rules permit replacement without changing the original request semantics; otherwise fail closed.

### TRB-ORACLE-001 — oracle value is stale or fails freshness policy

**Audience:** developer, operator  
**Surface:** Oracle Interface Layer  
**Severity:** blocked  
**Authority source:** consumer freshness/verification policy plus canonical accepted attestation state  
**Retry safety:** safe for reads; conditional for state-changing consumers

Do not accept a stale value merely because the provider endpoint is reachable. Check timestamp/round/attestation identity, freshness window, provider qualification, quorum/verification requirements and consumer policy. Use a permitted fallback or wait for a qualified fresh value.

### TRB-ORACLE-002 — providers disagree or an attestation cannot be verified

**Audience:** developer, operator  
**Surface:** Oracle Interface Layer  
**Severity:** blocked  
**Authority source:** canonical verification/aggregation rules  
**Retry safety:** conditional

Provider claims do not outrank verification rules. Preserve the conflicting evidence, identify provider/round IDs, and fail closed until the configured rule can determine an accepted value.

## Storage Proof and Resource Protocol

### TRB-STORAGE-001 — resource/provider is unavailable

**Audience:** user, developer, operator  
**Surface:** Storage Proof / Resource Protocol  
**Severity:** degraded  
**Authority source:** canonical resource commitments/provider qualification and settlement state  
**Retry safety:** safe for reads; conditional for writes

A provider outage may affect availability while commitments and settlement state remain intact. Verify resource ID/content commitment, provider set, current qualification, replication/availability policy and any proof/settlement state before reassigning work.

### TRB-STORAGE-002 — storage/resource proof is missing or invalid

**Audience:** developer, operator  
**Surface:** Storage Proof / Resource Protocol  
**Severity:** blocked  
**Authority source:** canonical proof-verification rules and accepted proof state  
**Retry safety:** conditional

Do not manually mark work complete. Check proof epoch/window, content/resource commitment, provider identity, proof payload/verification result and settlement status. Retry/reassign only through the protocol-defined flow.

### TRB-STORAGE-003 — availability differs from canonical commitment or settlement state

**Audience:** user, operator  
**Surface:** provider-backed storage/resource service  
**Severity:** degraded  
**Authority source:** canonical commitments/settlement; provider endpoints establish availability only  
**Retry safety:** not-applicable

Treat provider availability as operational evidence, not authority over ownership, proof acceptance or settlement.

## 420AI compute providers

### TRB-AI-001 — AI job remains queued or provider is unavailable

**Audience:** user, developer, operator  
**Surface:** 420AI compute market  
**Severity:** degraded  
**Authority source:** canonical job/escrow/routing state plus provider SLA status  
**Retry safety:** conditional

Identify the original job ID before retrying. A frontend timeout does not prove that the job was never accepted. Check canonical job state, assigned provider, escrow, deadline/SLA and result commitment before cancellation/reassignment.

### TRB-AI-002 — AI result is returned but cannot be verified or accepted

**Audience:** developer, operator  
**Surface:** 420AI  
**Severity:** blocked  
**Authority source:** canonical job requirements, result commitment and verification/SLA rules  
**Retry safety:** conditional

Do not release/settle solely because a provider claims completion. Compare job ID, model/task commitment, result commitment, proof/evidence and acceptance state. Use dispute/retry/reassignment only through the defined protocol path.

### TRB-AI-003 — AI job payment/escrow state is ambiguous

**Audience:** user, developer  
**Surface:** 420AI escrow/settlement  
**Severity:** value-risk  
**Authority source:** canonical job and escrow settlement state  
**Retry safety:** unsafe

Do not submit a second job/payment until the original job ID and escrow state have been reconciled.

## Rights, Verify and Arbitration

### TRB-RIGHTS-001 — license/right appears missing, superseded or revoked

**Audience:** user, developer  
**Surface:** 420 Rights  
**Severity:** blocked  
**Authority source:** canonical rights-holder, license and succession/revocation state  
**Retry safety:** conditional

Check asset/right/license IDs, holder/successor state, effective dates, supersession/revocation and network. Do not rely on stale marketplace/application metadata.

### TRB-VERIFY-001 — artifact/deployment verification does not produce a full qualified match

**Audience:** developer, operator  
**Surface:** 420 Verify  
**Severity:** blocked  
**Authority source:** qualified artifact/build evidence, runtime code and verification result  
**Retry safety:** safe for verification reads/rebuilds

A verification result is evidence, not deployment/Registry authority. Compare compiler/build inputs, artifact/ABI hashes, runtime code, deployment receipt and environment before republishing or registering anything.

### TRB-ARBITRATION-001 — dispute evidence is missing, rejected or outside scope

**Audience:** user, developer  
**Surface:** 420 Arbitration  
**Severity:** blocked  
**Authority source:** canonical dispute record, evidence rules and bounded arbitration authority  
**Retry safety:** conditional

Preserve original evidence identifiers and deadlines. Do not alter underlying protocol state to make an arbitration claim fit. Submit/appeal only within the defined dispute lifecycle.

### TRB-ARBITRATION-002 — arbitration outcome and application state disagree

**Audience:** user, developer, operator  
**Surface:** Arbitration + consuming protocol/application  
**Severity:** blocked  
**Authority source:** canonical arbitration outcome plus the consuming protocol's explicit execution/adoption rules  
**Retry safety:** not-applicable

An arbitration outcome does not imply unlimited authority over unrelated state. Verify whether and how the consuming protocol recognizes the outcome before taking further action.

## Messenger, Notifications and Attention

### TRB-MESSENGER-001 — message is not delivered or appears on only one device

**Audience:** user, operator  
**Surface:** 420 Messenger  
**Severity:** degraded  
**Authority source:** canonical membership/permissions/entitlements where applicable; transport/storage delivery is operational  
**Retry safety:** conditional

A transport failure does not automatically change membership, subscription or entitlement state. Check message/conversation ID, sender/recipient membership, transport/storage availability and delivery acknowledgement before resending.

### TRB-NOTIFY-001 — expected notification did not arrive or arrived late

**Audience:** user, developer, operator  
**Surface:** 420 Notifications  
**Severity:** degraded  
**Authority source:** canonical triggering state/event; notification delivery is derived  
**Retry safety:** not-applicable

Never use absence of a notification as proof that the underlying event did not occur. Verify canonical transaction/protocol state first, then diagnose subscription/delivery/provider state.

### TRB-ATTENTION-001 — attention proof/reward/consent state disagrees with presentation

**Audience:** user, developer  
**Surface:** 420 Attention  
**Severity:** blocked  
**Authority source:** canonical consent/eligibility/proof/reward state  
**Retry safety:** conditional

Verify opt-in/consent state, campaign/proof/reward identifiers, eligibility window and settlement status. Do not fabricate or replay attention proofs to compensate for a stale UI.

## Provider-neutrality recovery rule

For provider-backed protocols, use this order:

1. identify the canonical request/object/commitment and current protocol state;
2. verify whether the failure is provider availability, verification, freshness, proof, or settlement;
3. preserve the original request/job/message/object identifier;
4. use replacement/fallback providers only when the canonical protocol explicitly permits it;
5. never promote provider-local success into canonical success without the required acceptance/settlement evidence;
6. escalate when provider disagreement or missing evidence prevents a canonical determination.

## Related documentation

- [Core protocol architecture](../architecture/protocols/index.md)
- [Randomness and oracle architecture](../architecture/protocols/randomness-oracles.md)
- [Storage proof and resource architecture](../architecture/protocols/storage-resource.md)
- [Rights and Verify architecture](../architecture/protocols/rights-verify.md)
- [Arbitration architecture](../architecture/protocols/arbitration.md)
- [Messenger, Notifications and Attention architecture](../architecture/protocols/messenger-notifications-attention.md)
- [Developer storage/AI/Bridge integration](../developers/storage-ai-bridge.md)

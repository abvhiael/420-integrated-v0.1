# CMP-1.1.4.2 — verifier independence qualification

**Status: implementation committed; qualification pending exact-head Solidity CI and operational identity review.** This is a distinct gate from 1.1.4.1 hostile verdict binding and does not certify all CMP-1.1 requirements.

## Actual enforcement path

`ComputeJobRegistry420` binds `ComputeJobIntegerProfileVerification420` as its verification evidence adapter. Its `submitEvaluatedVerdict` recomputes the specified output from the committed input, checks the worker's committed result and receipt, and calls `ComputeJobPolicyEnforcedVerification420.submitVerdict`; that adapter reads canonical owner, actual request payer and matched operator and calls `ComputeVerifierIndependencePolicy420.eligible`. The inherited signature-only entrypoint is disabled on the integer-profile adapter. The decision records the signed verdict and reproducible evaluation evidence. An authorized signature alone is insufficient.

## Automated acceptance matrix

`contracts/test/ComputeJobVerifierIndependenceGate420.t.sol` constructs a real signed request, a three-ether payer custody reserve, an authorized worker match and result receipt, and an independently calculated known-good result. Each rejected evaluated verdict must preserve `RESULT_COMMITTED`, the payer reserve, an empty decision reference and an unused verifier nonce. Tests exercise:

- No appointment; attempted selection by the job owner; restoration by the authorized selector and successful evaluated verdict.
- Verifier wallet attested to the **same controller** as owner, actual payer or matched operator; all rejected despite different wallet addresses. A valid independently controlled identity can subsequently be appointed.
- Controller drift after appointment: owner, payer or operator becomes verifier-controlled; each invalidates the current appointment at the canonical verdict gate. Restoration to the attested independent relationship permits the original appointment under the current controller-ID policy.
- Withdrawal of verifier attestation, governance suspension, appointment revocation, rotation of attestor/selector authority and failed use of the former selector.
- Expired verifier attestation at the verdict gate and later valid re-attestation within the live appointment period.
- Attempted silent replacement of an active appointment, mismatch of profile or canonical matched operator, preservation of the original appointment evidence and successful original verifier verdict.

`contracts/test/ComputeVerifierIndependencePolicy420.t.sol` additionally tests selector-only appointment, unauthorized identity attestation and revocation, controller aliases, account suspension, appointment expiry and rotation of authorities. `ComputeVerifierIndependencePolicy420.appoint` now rejects any active pre-existing appointment for the same job, **including an expired one**, until governance or selector explicitly revokes it; `AppointmentRevoked` and `Appointed` provide observable lifecycle events. Underlying eligibility remains fail-closed for expired, revoked, suspended, stale-epoch or missing attestations.

## Limitations and required operational evidence

Controller IDs and evidence hashes are assertions by a designated **independent identity attestor**, not cryptographic proof of beneficial ownership. A production qualification needs a named governance authority, independent attestor and selector, documented legal/beneficial-owner/affiliate and delegated-control conflict checks, verifiable off-chain evidence custody, accountable selection rationale, revocation and incident-response procedures, concrete production account attestations and appointments, and their contract addresses and event/transaction references. The fixtures' synthetic controller IDs and evidence hashes do not satisfy that real-world evidence gate. Controller-ID restoration with new attestation evidence currently re-enables an existing unexpired appointment; policy for material identity-evidence changes and historical post-verdict revocation still requires explicit production approval before unrestricted deployment.

## Exit criterion

All three required workflows must pass on one exact branch-head commit, including the new integration suite. Inspect any failing shard and address it before changing status to automated-gate qualified. Record deployed code hashes and real authority appointments separately at the production-wiring and final acceptance gates. Keep PR #370 draft and unmerged until the remaining CMP-1.1 conditions are addressed.

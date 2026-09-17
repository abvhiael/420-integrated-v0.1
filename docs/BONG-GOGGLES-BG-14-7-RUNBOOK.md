# Bong Goggles BG-14.7 Production Messaging Runbook

## Purpose

This runbook closes BG-14 production messaging. It assumes canonical authority remains in 420Messenger, BongGogglesPrivateMessaging420, BongGogglesCommunityRegistry420 and BG-13/420Storage. Application services coordinate, project and authorize; they never become canonical message, membership, device-key, epoch or storage authority.

## Release gates

A BG-14 release candidate is eligible only when all of the following are true on the exact reconciled PR head:

1. Bong Goggles Messaging Verification succeeds.
2. Bong Goggles Media Verification succeeds.
3. 420Docs Qualification succeeds.
4. 420 Integrated Qualification succeeds, including offline-core, fault-matrix, production-dependencies and geth-engine/live-engine-smoke.
5. All six BG-14.7 drills pass.
6. Bounded inbox/send/receipt/attachment load qualification passes.
7. Secret-redaction checks pass.
8. PR head is reconciled with current main and behind count is zero.

## Telemetry policy

Allowed operational telemetry: operation name, success/failure/denied outcome, latency, bounded retry count, high-level failure reason, queue depth, aggregate counts and non-secret class labels.

Never emit message bodies, plaintext, decrypted attachments, ciphertext unless explicitly required for a private transport diagnostic, private keys, epoch material, attachment/decryption keys, bearer/session tokens, cookies, credentials, signed/private/provider URLs, payload bytes or raw session IDs. Any diagnostic payload crossing the application boundary must be passed through secret redaction first.

## Required drills

### Transport loss

Drop transport after canonical envelope commit but before presentation. Retry must reuse canonical identity/sequence and must not invent a second message. Recovery is transport retry/re-fetch from canonical metadata.

### Duplicate/replay

Present duplicate transport metadata and replay an old sequence. Duplicate canonical envelope identity must not create a second application message; stale sequence/epoch data must fail closed.

### Stale epoch

Rotate the private context epoch, then attempt send/read with the previous epoch and commitment. Both operations must be denied until the client refreshes current canonical context state.

### Device loss

Revoke the lost device, establish/refresh a surviving device commitment, rotate affected private contexts and require fresh canonical reads between stages. Any capability bound to the old device revision must fail closed.

### Blocked peer

Introduce a bilateral block after a previously eligible session is active. Subsequent send/read/attachment presentation must be denied without mutating historical envelope, receipt or storage provenance.

### Attachment failure

Return missing/mismatched BG-13 media/storage identity, failed retrieval verification or unavailable object delivery. Messaging must not substitute a URL/provider route for canonical object identity and must not present unverified bytes.

## Bounded load qualification

Default qualification profile:

- 500 inbox conversations
- 1,000 sends
- 2,000 receipt transitions
- 250 attachment authorizations/retrievals
- concurrency 20

Hard qualification ceilings:

- inbox conversations <= 5,000
- sends <= 10,000
- receipts <= 20,000
- attachments <= 2,000
- concurrency <= 100

The closeout test is a bounded qualification, not an unbounded stress test. Fail the release candidate on correctness drift, authorization bypass, stale state presentation, secret leakage, canonical identity mismatch, duplicate projection or unrecoverable queue growth.

## Operational recovery order

1. Freeze affected application presentation paths if authorization state cannot be proven current.
2. Re-read canonical profile, block, policy, conversation, private-context, device and epoch state.
3. For device loss, establish/refresh a surviving device commitment through wallet authorization.
4. Re-read canonical state.
5. Revoke lost/stale device commitments through wallet authorization.
6. Re-read canonical state.
7. Rotate each affected private context epoch with a fresh externally generated epoch commitment.
8. Re-read canonical state.
9. Resume send/read only after current eligibility passes.

Never transport private keys or decrypted epoch material through the recovery coordinator.

## Rollback / containment

If messaging authorization, duplicate suppression, epoch enforcement, receipt consistency or attachment verification regresses, disable the affected application path while leaving canonical contracts/provenance untouched. Do not rewrite historical envelopes, receipts or storage records to repair an application projection bug. Rebuild projections from canonical state after the defect is fixed.

## Phase-end reconciliation

Before merge:

1. Fetch latest main SHA/tree.
2. Verify PR changed paths and identify overlap since the feature merge base.
3. Reconcile onto the exact latest main without dropping feature changes.
4. Verify feature branch is ahead of current main and behind by zero.
5. Verify PR changed-file set/statistics remain intact except intentional conflict resolution.
6. Run all exact-head workflows again.
7. Merge only after the reconciled exact head is green.

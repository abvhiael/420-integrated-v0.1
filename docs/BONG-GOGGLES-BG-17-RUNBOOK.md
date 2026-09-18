# Bong Goggles BG-17 moderation operator runbook

## Purpose

This runbook governs production operation of the Bong Goggles moderation surfaces. The operator application and indexer are presentation and transaction-preparation layers only. `BongGogglesSafetyRegistry420` and the capability registry remain authoritative.

## Start-of-shift checks

1. Confirm the moderation projector is healthy and its checkpoint matches the expected chain and current canonical head window.
2. Confirm operator capabilities are current for each action/scope required. Missing, expired or revoked capability must be treated as a hard denial.
3. Confirm Wallet and Explorer endpoints are reachable before preparing canonical writes.
4. Confirm there is no unresolved canonical/local divergence. If divergence exists, stop writes for the affected resource and replay/rebuild from canonical events.
5. Confirm queue limits are configured; never request an unbounded moderation queue.

## Report triage

Use the untriaged report queue only as a work list. Evidence surfaces may expose hashes or opaque storage references, never private content bodies. Duplicate grouping is presentation-only. Opening a case requires a current canonical scope derivation, `ACTION_SAFETY_CASE_OPEN`, and Wallet confirmation.

## Case actions

Before applying or revoking an action, revalidate the current projection checkpoint and capability state. Permanent account suspension is reserved and must not be prepared in Bong Goggles. Temporary interaction/account restrictions require a future expiry. Rationale content stays off-chain; only the rationale hash is submitted.

## Appeals

The case opener must never resolve the appeal. This remains blocked locally even if a stale capability view says otherwise, and the contract enforces the same rule. Uphold/overturn remains non-final until `AppealResolved` is canonically projected.

## Emergency hide

Emergency hide is presentation-only and does not delete or mutate the underlying canonical content object. `hiddenUntil` must be strictly in the future and no more than one day from canonical execution time. Revalidate capability and checkpoint immediately before Wallet handoff.

## Concurrency

Every prepared canonical write must be checkpoint-bound and fingerprinted. Suppress exact duplicate intents. Only one operator reservation may exist for the same moderation resource at a time. Release the reservation after canonical confirmation, rejection, abandonment or detected staleness.

## Privacy

Never place decrypted Messenger content, private message bodies, secrets, tokens, credentials, cookies, session material, seed phrases, private keys or raw payloads in moderation telemetry or audit exports. Least-data queue views should be used for routine operations. Audit exports contain provenance plus opaque evidence references only.

## Divergence and recovery

If canonical hydration disagrees with the local projection:

1. stop canonical writes for the affected resource;
2. record the divergence without mutating canonical-derived local state;
3. restore/replay from the last trusted snapshot/checkpoint;
4. verify deterministic snapshot equality after restart;
5. re-hydrate against canonical contract reads;
6. resume writes only after convergence.

For a chain reorg, rely on the canonical indexer rollback/replay path and discard any prepared intent whose checkpoint no longer matches.

## Incident escalation

Escalate immediately when any of the following occur: persistent canonical/local divergence, repeated replay mismatch, private-content telemetry leakage, capability registry inconsistency, duplicate canonical transactions, Wallet signing against a stale checkpoint, or separation-of-duty violation attempt.

Preserve transaction hashes, canonical event provenance, checkpoint identifiers and sanitized operator notes. Do not preserve private payloads.

## Phase-close acceptance

BG-17 is ready to merge only when the Bong Goggles Indexer Verification, 420Docs Qualification and 420 Integrated Qualification workflows all succeed against the exact final PR head after reconciliation with current `main`.

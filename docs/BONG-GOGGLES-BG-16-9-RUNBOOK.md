# Bong Goggles BG-16.9 operator runbook

## Purpose

This runbook covers notification-production closeout and degraded-operation response for Bong Goggles. 420Notifications retains delivery queue, retry, backoff, provider-health and subscription authority. Bong Goggles retains only presentation/indexer state and its non-authoritative admission/privacy guards.

## Pre-release qualification

1. Reconcile `feature/bong-goggles-bg16-notifications` with current `main`.
2. Confirm exact branch head and PR #330 head are identical.
3. Run/observe exact-head Bong Goggles Indexer, Games, Media, 420Docs and 420 Integrated workflows.
4. Require zero failing or pending workflows before merge.
5. Verify bounded qualification evidence: zero operation failures and p95 within the configured budget.
6. Verify replay drill convergence: restored delivered IDs and checkpoint match the pre-restart snapshot.
7. Verify canonicality drill convergence: local height/hash equals canonical height/hash.
8. Exercise provider degradation with one provider unavailable and confirm unaffected providers continue independently.
9. Verify private-payload regression coverage remains green.

## Canonical/local divergence

If local notification checkpoint differs from canonical state:

- mark notification presentation degraded;
- suppress locally-visible presentation that could imply stale state is current;
- do not mutate source/canonical application state;
- restore the last valid pipeline/fan-out snapshot;
- replay canonical logs from the checkpoint;
- compare height and block hash again;
- clear degraded presentation only after convergence.

## Provider degradation

If `genesis-in-app`, `genesis-web` or `genesis-push` fails:

- isolate the failing handoff;
- allow unaffected provider handoffs to continue;
- preserve the same notification/event provenance;
- leave retry/backoff/queue recovery to 420Notifications;
- never fabricate a successful delivery state in Bong Goggles.

## Abuse/privacy response

If fan-out or per-recipient admission limits trip:

- reject the over-limit batch/window atomically;
- emit only redacted structured diagnostics;
- do not include plaintext, ciphertext, message payload/body/content, envelope/storage commitments, key material, authorization/cookies/secrets or raw Attention data;
- investigate canonical eligibility separately from the presentation-layer guard.

## Rollback

If the reconciled release fails qualification, do not merge PR #330. Keep the previous qualified main state. Fix on the same phase branch, rerun exact-head qualification and only proceed once every required workflow is green.

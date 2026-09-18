# Bong Goggles BG-16.8 — abuse, privacy + recovery hardening

BG-16.8 hardens the Phase 16 notification path without expanding notification authority. Bong Goggles notifications remain presentation-only and non-authoritative; canonical application and chain state remain the source of truth.

## Fan-out and rate abuse controls

`NotificationFanoutGuard` applies two bounded controls before delivery handoff:

- maximum recipients per source event;
- maximum admitted notifications per recipient within the current guard window.

The guard fails closed if either bound is exceeded. Batch admission is atomic: a batch that would exceed one recipient's limit does not partially consume quota for the other recipients. Guard policy and counters can be snapshotted/restored, and restore fails closed if the active guard policy differs from the persisted policy.

## Structured telemetry redaction

`redactNotificationTelemetry` recursively redacts sensitive keys before diagnostic emission, including private Messenger payload/content fields, ciphertext/plaintext, envelope/storage/key/epoch commitments, secrets/tokens/auth headers/cookies and raw Attention telemetry. Safe operational fields such as provider ID, counts and bounded error classification remain available.

## Restart and replay recovery

`restoreNotificationRuntime` restores both the existing deterministic notification pipeline snapshot and the fan-out guard snapshot. This preserves delivered-notification deduplication, the non-authoritative chain checkpoint and abuse-window counters across process restart. Invalid or policy-incompatible snapshots fail closed.

## Provider failure isolation

`deliverWithProviderIsolation` attempts each qualified provider handoff independently and returns one non-authoritative result per channel. A failed provider cannot prevent other in-app/web/push channels from completing. The function does not implement retry, queue or rate state; those remain 420Notifications-owned.

## Canonical divergence containment

`notificationDivergenceState` compares the local notification checkpoint with canonical checkpoint height/hash. Any mismatch marks notification presentation degraded and forces local notification visibility off until replay converges. The UI therefore cannot use stale notification state to hide a canonical/local divergence.

## Regression coverage

BG-16.8 tests cover:

- event fan-out limits;
- per-recipient rate limits;
- atomic rejection of over-limit batches;
- deterministic guard snapshot/restore and policy mismatch rejection;
- recursive private-field telemetry redaction;
- pipeline + guard restart recovery;
- provider failure isolation;
- explicit canonical divergence/degraded behavior.

The next step is BG-16.9 production notification closeout: bounded load/latency qualification, replay/canonicality drills, provider-degradation exercises, operator runbook, reconciliation with current `main`, and final exact-head qualification before PR #330 is merged.

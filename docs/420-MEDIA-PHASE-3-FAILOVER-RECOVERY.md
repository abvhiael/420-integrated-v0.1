# 420Media Phase 3.3 — Multi-node Failover and Recovery

## Purpose

Phase 3.3 adds bounded, deterministic recovery when an ingress, transcoder, or relay operator becomes unusable. Recovery reuses Phase 3.1 canonical provider discovery and Phase 3.2 DAG/lifecycle boundaries; it does not create a second authority path for operator execution, funding, verification, settlement, or refunds.

## Recovery model

A recovery attempt is scoped to one failed DAG node. The recovery planner receives the original node, the same capability/price/latency/geography/capacity/reliability constraints used for provider selection, the failed operator, operators already occupied by the stream, previously attempted replacements, and the current attempt number.

The selector re-runs qualified discovery with no artificial result truncation, preserving deterministic ranking. Candidates are rejected when they are the failed/current operator, already assigned elsewhere in the graph, or previously attempted for this recovery chain. The highest-ranked remaining provider is selected.

Recovery attempts are bounded. The default ceiling is three attempts; callers may set a stricter explicit policy. Exhaustion returns a distinct recovery-exhausted result rather than silently reusing a failed provider or relaxing constraints.

## Plan rebinding

`ApplyRecovery` returns a copied plan with only the failed node and its corresponding assignment rebound to the replacement operator. The original plan is not mutated. Node IDs, dependencies, rendition identity, and upstream/downstream topology remain unchanged at this layer.

## Canonical recovery execution

Phase 3.3 preserves the original Phase 3.2 canonical job as immutable history. A replacement execution never overwrites the failed job and never reuses its job ID.

`RecoveryJobID(streamID, nodeID, attempt)` derives a separate deterministic bytes32 identity under the `420MEDIA_RECOVERY_V1` domain. Attempt zero is invalid and remains reserved conceptually for the original canonical node execution. Every positive attempt therefore has a stable, distinct identity while still binding the recovery to the same stream and DAG node.

`LifecycleCoordinator.CreateRecoveryAttempt` requires the original canonical job to exist, match the planned operator identity, and be in a terminal-failure state (`FAILED`, `CANCELLED`, `EXPIRED`, or `REFUNDED`). It then creates a new assigned job for the selected replacement using the same role capability, job kind, SLA policy, spend cap, dependency-derived input commitment, and requester authority boundary used by Phase 3.2.

Recovery creation is idempotent for a matching already-created attempt. Any conflicting operator identity or non-not-found lookup error fails closed. Operator acceptance/execution/result commitment and settlement funding/resolution remain outside the requester coordinator.

## Live recovery qualification

The Anvil gate now includes canonical recovery execution. The live test:

1. creates a canonical assigned ingress job;
2. advances chain time and expires that original job as a real terminal-failure condition;
3. verifies the original job remains canonically `EXPIRED` and bound to its original reserved operator;
4. runs bounded replacement selection and rejects the failed operator;
5. derives and creates a distinct attempt-1 recovery job reserved to the replacement operator;
6. drives the replacement through accept → fund → run → result commit → verify using the existing operator and settlement authority paths;
7. verifies the recovery output on chain; and
8. re-reads the original canonical job to prove recovery did not mutate or overwrite failure history.

## Discovery ABI hardening

Before enabling recovery selection, Phase 3.3 fixes the Ethereum discovery decoder for `OperatorCapabilityChanged`. The real event carries two non-indexed words: `bool enabled` and `uint32 revision`. The index now requires both words, validates the boolean strictly, rejects revision overflow, and fails closed on malformed one-word payloads.

## Phase 3.3 invariants

- **MEDIA-REC-INV-001:** Recovery selection uses the qualified Phase 3.1 discovery path and original service constraints.
- **MEDIA-REC-INV-002:** The failed/current operator cannot be selected as its own replacement.
- **MEDIA-REC-INV-003:** Recovery cannot reuse an operator already occupied elsewhere in the stream graph.
- **MEDIA-REC-INV-004:** A previously attempted replacement cannot be retried within the same recovery chain.
- **MEDIA-REC-INV-005:** Replacement selection is deterministic over the ranked eligible provider set.
- **MEDIA-REC-INV-006:** Discovery/RPC failure produces no recovery decision.
- **MEDIA-REC-INV-007:** Recovery attempts are bounded and exhaustion fails closed.
- **MEDIA-REC-INV-008:** Applying recovery must not mutate the original plan.
- **MEDIA-REC-INV-009:** Recovery rebinding changes only the failed node/operator assignment; graph topology and node identity stay stable.
- **MEDIA-REC-INV-010:** Recovery never assumes operator, requester, or settlement authority.
- **MEDIA-REC-INV-011:** Capability event indexing requires the canonical `(enabled, revision)` ABI and rejects malformed/overflowing revision data.
- **MEDIA-REC-INV-012:** A recovery execution must use an attempt-scoped job ID distinct from the original canonical node job.
- **MEDIA-REC-INV-013:** Attempt zero is invalid for recovery identity; positive attempts are deterministic and mutually distinct.
- **MEDIA-REC-INV-014:** Recovery creation requires a canonically terminal-failed original job whose operator identity matches the original plan.
- **MEDIA-REC-INV-015:** Creating or executing a recovery attempt must not mutate the original canonical failed job.
- **MEDIA-REC-INV-016:** A recovery job preserves the original node's capability, kind, SLA, spend and dependency-derived input policy while rebinding only the operator and attempt identity.
- **MEDIA-REC-INV-017:** Recovery-attempt lookups fail closed on every error except explicit lifecycle not-found.
- **MEDIA-REC-INV-018:** Repeating creation for the same matching recovery attempt is idempotent rather than duplicating work.
- **MEDIA-REC-INV-019:** Live qualification must cross requester creation, replacement-operator execution and settlement funding boundaries before recovery is considered successful.

## Current completion boundary

Phase 3.3 now includes deterministic replacement selection, exclusion/attempt tracking, bounded retries, immutable plan rebinding, canonical attempt-scoped recovery identity, requester-side recovery creation, and live recovery execution qualification.

The next Phase 3.3 increment is recovery propagation through a multi-node DAG: prove a failed transcoder can be replaced without invalidating healthy siblings, then bind downstream relay readiness to the successful recovery attempt output rather than the failed canonical attempt.

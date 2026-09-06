# 420Media Phase 3.3 — Multi-node Failover and Recovery

## Purpose

Phase 3.3 adds bounded, deterministic recovery when an ingress, transcoder, or relay operator becomes unusable. Recovery reuses Phase 3.1 canonical provider discovery and Phase 3.2 DAG/lifecycle boundaries; it does not create a second authority path for operator execution, funding, verification, settlement, or refunds.

## Recovery model

A recovery attempt is scoped to one failed DAG node. The recovery planner receives the original node, the same capability/price/latency/geography/capacity/reliability constraints used for provider selection, the failed operator, operators already occupied by the stream, previously attempted replacements, and the current attempt number.

The selector re-runs qualified discovery with no artificial result truncation, preserving deterministic ranking. Candidates are rejected when they are the failed/current operator, already assigned elsewhere in the graph, or previously attempted for this recovery chain. The highest-ranked remaining provider is selected.

Recovery attempts are bounded. The default ceiling is three attempts; callers may set a stricter explicit policy. Exhaustion returns a distinct recovery-exhausted result rather than silently reusing a failed provider or relaxing constraints.

## Plan rebinding

`ApplyRecovery` returns a copied plan with only the failed node and its corresponding assignment rebound to the replacement operator. The original plan is not mutated. Job IDs, node IDs, dependencies, rendition identity, and upstream/downstream topology remain unchanged at this layer.

Canonical on-chain lifecycle state remains authoritative. Phase 3.3 does not overwrite an existing assigned job or impersonate operator/settlement authority. The next recovery increment will define how a replacement execution attempt is represented canonically without colliding with the immutable Phase 3.2 job identity.

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

## Current completion boundary

The first Phase 3.3 increment provides deterministic replacement selection, exclusion/attempt tracking, bounded retry policy, immutable plan rebinding, and the prerequisite Ethereum capability-event ABI fix.

The next increment is canonical recovery execution: define attempt identity and state transitions for replacing a failed assigned job, prove the replacement cannot steal or settle the failed attempt, and add live Anvil qualification for operator failure → replacement selection → replacement execution.

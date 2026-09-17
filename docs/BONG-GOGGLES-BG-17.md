# Bong Goggles BG-17 — Moderation Operations

BG-17 turns the canonical `BongGogglesSafetyRegistry420` trust-and-safety primitives into production operator workflows without moving moderation authority into the application/indexer layer.

## Authority boundary

The canonical safety registry remains the only source of truth for reports, cases, actions, appeals and emergency hides. Operator application surfaces may project, sort, filter, annotate locally and prepare transaction intents, but they cannot open/close cases, apply/revoke actions, resolve appeals or set emergency hides without the canonical contract and capability checks succeeding.

Appeal resolution preserves the contract's separation-of-duty rule: the case opener cannot resolve the appeal. Permanent account suspension remains reserved. Emergency hides remain bounded by the canonical maximum window.

## Roadmap

### BG-17.1 — canonical moderation projector + operator queues

- consume `ReportSubmitted`, `CaseOpened`, `SafetyActionApplied`, `SafetyActionRevoked`, `CaseClosed`, `AppealFiled`, `AppealResolved` and `EmergencyHideSet`;
- deterministic untriaged-report, open-case and pending-appeal queues;
- preserve source provenance and non-authoritative semantics;
- fail closed on impossible local transitions or missing prerequisite projections;
- deterministic snapshot/restore for restart and replay.

### BG-17.2 — report triage + case-opening preparation

- report detail view model and evidence-reference handling;
- reason-code/policy-version mapping;
- duplicate/related report grouping without rewriting canonical reports;
- capability-aware case-open intent preparation;
- scope derivation identical to canonical `scopeForTarget` semantics;
- Wallet confirmation remains mandatory for canonical writes.

### BG-17.3 — case workspace + action preparation

- chronological case timeline;
- active/latest action visibility;
- capability-aware action/revocation intent preparation;
- expiry validation for temporary restrictions;
- permanent suspension remains unavailable from Bong Goggles;
- rationale material remains off-chain while only its canonical hash is submitted.

### BG-17.4 — appeals workspace + separation of duty

- pending-appeal queue and case linkage;
- capability-aware uphold/overturn preparation;
- prevent case opener from being presented as an eligible resolver;
- overturned appeal presentation reflects canonical action revocation/case resolution;
- no local appeal result is treated as final before canonical confirmation.

### BG-17.5 — emergency hide operations

- target-scope derivation and current hide visibility;
- bounded expiry preparation matching canonical one-day maximum;
- capability-aware emergency-hide intents;
- expiry/replay handling;
- emergency presentation cannot mutate underlying canonical content state.

### BG-17.6 — policy, capability + audit surfaces

- current operator capability projection by action/scope;
- explicit denial reasons for missing/expired capability;
- immutable provenance timeline for canonical moderation events;
- local operator notes/labels separated from canonical evidence and decisions;
- Wallet/Explorer deep links for every canonical write.

### BG-17.7 — privacy + evidence handling

- evidence references remain hashes/opaque storage references in operator telemetry;
- private Messenger content remains excluded from moderation logs unless separately authorized/decrypted by the appropriate product flow;
- structured telemetry redaction;
- least-data queue/list views;
- audit exports omit secrets, tokens and private payload material.

### BG-17.8 — abuse, concurrency + recovery hardening

- duplicate-intent and stale-state suppression;
- concurrent operator conflict detection;
- canonical/local divergence handling;
- deterministic replay/restart drills;
- bounded queue and query load;
- capability changes invalidate stale local authorization immediately.

### BG-17.9 — production moderation closeout

- bounded load/latency qualification;
- report-to-case, action, appeal and emergency-hide drills;
- separation-of-duty regression qualification;
- operator runbook;
- reconcile phase branch with current `main`;
- exact-head qualification before merge.

## Current increment

BG-17.1 begins on `feature/bong-goggles-bg17-moderation-ops`. The first implementation is the non-authoritative moderation operations projector and deterministic operator queues.
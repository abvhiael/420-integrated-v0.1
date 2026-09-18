# Bong Goggles BG-17 — Moderation Operations

BG-17 turns the canonical `BongGogglesSafetyRegistry420` trust-and-safety primitives into production operator workflows without moving moderation authority into the application/indexer layer.

## Authority boundary

The canonical safety registry remains the only source of truth for reports, cases, actions, appeals and emergency hides. Operator application surfaces may project, sort, filter, annotate locally and prepare transaction intents, but they cannot open/close cases, apply/revoke actions, resolve appeals or set emergency hides without the canonical contract and capability checks succeeding.

Appeal resolution preserves the contract's separation-of-duty rule: the case opener cannot resolve the appeal. Permanent account suspension remains reserved. Emergency hides remain bounded by the canonical maximum window.

## Roadmap

### BG-17.1 — canonical moderation projector + operator queues — COMPLETE AND QUALIFIED

- consume `ReportSubmitted`, `CaseOpened`, `SafetyActionApplied`, `SafetyActionRevoked`, `CaseClosed`, `AppealFiled`, `AppealResolved` and `EmergencyHideSet`;
- deterministic untriaged-report, open-case and pending-appeal queues;
- preserve source provenance and non-authoritative semantics;
- fail closed on impossible local transitions or missing prerequisite projections;
- deterministic snapshot/restore for restart and replay.

### BG-17.2 — report triage + case-opening preparation — COMPLETE AND QUALIFIED

- deterministic report-detail and linked case/evidence/provenance view models;
- evidence and rationale surfaces expose only canonical hashes/references, never private bodies;
- canonical hydration is cross-checked against projected report/case/action/appeal identifiers and subjects;
- related/duplicate report grouping is presentation-only and never rewrites canonical reports;
- reason-code to policy-version mapping fails closed when no policy exists;
- case-open preparation delegates target-scope derivation to the canonical `scopeForTarget` path and requires a positive capability check;
- prepared intents target `BongGogglesSafetyRegistry420.openCase(reportId, policyVersion)` and remain unsigned/unbroadcast;
- Wallet confirmation remains mandatory for every canonical write.

### BG-17.3 — case workspace + action preparation — COMPLETE AND QUALIFIED

- case workspace reuses the canonical report/case/action/appeal timeline from BG-17.2;
- latest and currently active actions are exposed explicitly without becoming authoritative state;
- apply-action and revoke-action intents require current canonical scope derivation and positive capability checks;
- temporary interaction/account restrictions require a future expiry at preparation time;
- permanent account suspension remains unavailable from Bong Goggles and is rejected before intent creation;
- rationale material remains off-chain; prepared action intents submit only the provided rationale hash;
- every intent remains unsigned/unbroadcast and requires Wallet confirmation before the canonical contract can mutate state.

### BG-17.4 — appeals workspace + separation of duty — IMPLEMENTED, QUALIFICATION PENDING

- deterministic pending-appeal workspace links each appeal to its canonical case projection;
- operator eligibility explicitly reflects the contract separation-of-duty rule before any intent is prepared;
- case opener is blocked from appeal-resolution preparation even if a capability check would otherwise pass;
- uphold/overturn intents require canonical scope derivation plus current appeal-resolve capability;
- prepared intents target `resolveAppeal(appealId, uphold)` and remain unsigned/unbroadcast behind Wallet confirmation;
- local intent state is explicitly non-final and requires canonical `AppealResolved` confirmation;
- overturned canonical events update the projected case/action presentation to resolved/revoked only after chain confirmation.

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

BG-17.1 through BG-17.3 are qualified. BG-17.4 is implemented on `feature/bong-goggles-bg17-moderation-ops`; exact-head qualification is pending before advancing to BG-17.5.

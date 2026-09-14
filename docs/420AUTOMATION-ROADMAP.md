# 420Automation implementation roadmap

420Automation is the replaceable off-chain scheduling and execution-coordination layer for 420 Integrated. Each phase ships on its own branch and PR, is reconciled with current `main`, fully qualified on the exact final head, and merged before the next phase starts.

## Completed phases

- AUT-0 — architecture and trust foundation.
- AUT-1 — job identity, registry, and immutable execution envelope.
- AUT-2 — trigger model and deterministic normalization.
- AUT-3 — deterministic eligibility engine and bounded scheduler.
- AUT-4 — execution coordination and transaction submission.
- AUT-5 — funding, fees, and execution budgets.
- AUT-6 — retries, idempotency, replay protection, and recovery.
- AUT-7 — worker registry, liveness, leases, and competition control.
- AUT-8 — 420Oracle and external-condition integration.
- AUT-9 — API, authentication, scoped credentials, and Developer Hub integration.
- AUT-10 — observability, readiness, execution receipts, and operational recovery.
- AUT-11 — hostile-state/security hardening and cross-layer adversarial qualification.

## AUT-11 closeout

AUT-11 hardened the full Automation path against hostile inputs and failure races without expanding Automation authority.

Delivered:

- authenticated observation envelopes with source identity, chain binding, freshness, clock-skew limits, monotonic sequencing, and signature verification;
- bounded replay protection for duplicate request identities and source-sequence rollback;
- explicit calldata-size, execution-gas, retry, batch-job, and batch-byte ceilings;
- finalized-chain rollback and finalized-hash conflict detection;
- safe-head/finality ordering checks that fail closed;
- recursive secret redaction for hostile diagnostic payloads;
- bounded, low-cardinality metric-label validation with secret/high-cardinality rejection;
- cross-layer adversarial tests for spoofed manual triggers, repeated/racing trigger delivery, execution-envelope immutability, tampered calldata, finality conflict, and secret-leak attempts;
- exact-head dedicated 420Automation, 420Docs, and full 420 Integrated qualification;
- merge to `main` via PR #249.

## Current phase — AUT-12

**AUT-12 — public-testnet qualification and launch closeout** is active on PR #250.

Implementation scope:

- exact chain-420/testnet genesis identity;
- public HTTPS Automation service origin validation with no embedded credentials;
- exact Automation, `node420`, 420RPC and 420Oracle release identity;
- descriptor-manifest and compiled-artifact digests;
- traffic-admitting readiness and ready scheduler evidence;
- at least one live worker and one registered job;
- compatibility witnesses for time, block, event, Oracle and manual triggers;
- authenticated Automation API, 420RPC, 420Oracle and Developer Hub compatibility evidence;
- live registered-job execution evidence;
- worker lease failover drill;
- replay-suppression drill;
- ambiguous-submission recovery drill;
- wrong-chain rejection drill;
- finality-conflict fail-closed drill;
- hostile-observation rejection drill;
- resource-abuse rejection drill;
- credential/scope isolation drill;
- readiness recovery/hysteresis drill;
- telemetry-redaction verification;
- explicit blocker-bearing `go`/`no-go` closeout report.

The closeout report is operator release evidence only. It remains `authoritative: false` and `launchAuthority: false`.

Synthetic CI can qualify the closeout contract and fail-closed behavior. **AUT-12 is not operationally complete until a real pinned public-testnet candidate supplies retained live evidence for the required compatibility witnesses and failure drills.**

## AUT-12 exit condition

AUT-12 may be closed only when:

1. the implementation/tests/documentation are reconciled with current `main`;
2. the exact final head passes the dedicated 420Automation workflow and full 420 Integrated qualification;
3. a pinned deployed public-testnet candidate provides the required live worker/job, compatibility, execution, failure-drill and redaction evidence;
4. `buildAutomation12CloseoutReport420` emits a blocker-free `go` for that exact evidence set;
5. operators retain the sanitized evidence bundle and record the broader ecosystem launch decision separately.

## Authority rule

420Automation may decide that a registered job is eligible for attempted execution and may coordinate a bounded worker transaction. It never determines consensus, canonical chain state, finality, ownership, wallet authority, bridge settlement, oracle truth, governance authority, arbitrary protocol permissions, open-ended spending authority, speculative replay authority, worker-created execution authority, raw-provider Oracle authority, API-created protocol authority, telemetry-created protocol authority, or public-testnet launch authority.

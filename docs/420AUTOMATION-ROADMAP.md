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

## AUT-9 closeout

AUT-9 delivers a transport-neutral authenticated service boundary for Developer Hub applications and Automation operators without turning off-chain API identity into protocol authority.

Delivered:

- Developer Hub-shaped credential records using the dedicated `420automation` audience;
- `automation:read`, `automation:submit`, `automation:manage`, and `automation:admin` scopes;
- chain-420 and environment binding with issuance/expiry checks;
- ACTIVE/ROTATED/REVOKED lifecycle enforcement;
- SHA-256 secret-digest matching with no bearer-secret persistence in Automation state;
- bounded credential cardinality and revision-regression protection;
- explicit application bindings to allowed Automation owner IDs and protocol IDs;
- authenticated principals with opaque client accounting keys;
- service inspection, filtered job listing, job lookup, validated job registration, and job enable/disable operations;
- read filtering that does not reveal jobs outside an application's owner/protocol binding;
- submit/manage separation so a submission credential cannot mutate job lifecycle;
- application-binding enforcement for registration and lifecycle changes;
- service-admin cross-binding authority limited to the Automation service itself;
- exact-field API request validation and fail-closed malformed-request handling;
- preservation of AUT-1 immutable job/envelope validation beneath every API mutation.

A successful AUT-9 authentication proves only that an off-chain application may use specific Automation service operations. It does not create wallet authority, 420 Identity credentials, Registry legitimacy, governance authority, target-protocol permissions, trigger truth, worker leases, funding authority, replay authority, canonical chain state, or arbitrary RPC/Engine access.

## Planned phases

- **AUT-10 — observability, readiness and operational recovery.** Health/readiness, bounded metrics, execution receipts, redacted status, recovery hysteresis, and operator procedures.
- **AUT-11 — hostile-state/security hardening.** Cross-layer adversarial tests, trigger spoofing, replay/race abuse, malicious jobs, quota/resource abuse, reorg/finality faults, and secret-leak prevention.
- **AUT-12 — public-testnet qualification and launch closeout.** Exact release identity, live worker/job evidence, failure drills, compatibility evidence, and explicit go/no-go closeout.

## Authority rule

420Automation may decide that a registered job is eligible for attempted execution and may coordinate a bounded worker transaction. It never determines consensus, canonical chain state, finality, ownership, wallet authority, bridge settlement, oracle truth, governance authority, arbitrary protocol permissions, open-ended spending authority, speculative replay authority, worker-created execution authority, raw-provider Oracle authority, or API-created protocol authority.

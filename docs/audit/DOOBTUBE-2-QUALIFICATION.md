# DoobTube — DOOBTUBE-2 qualification evidence

Roadmap step: **DOOBTUBE-2 — Dependency and trust-boundary freeze**
Qualification level: **Level 1 — app-scoped dependency/trust qualification**
Status: **COMPLETE**
PR: **#553**
Branch: `audit/doobtube-baseline-20261006`

## Implementation summary

DOOBTUBE-2 freezes the complete V1 dependency graph, authority matrix, trust boundaries, threat model, and failure/degraded-mode behavior in:

`docs/DOOBTUBE-DEPENDENCIES-TRUST.md`

### Direct required V1 dependencies

- ProtocolRegistry / 420 Registry — `420/service/protocol-registry/v1`;
- 420 Wallet / SmartAccount420 / CapabilityRegistry420 authority;
- 420Media — `420/service/media/v1`;
- 420Rights — `420/service/rights/v1`;
- 420Storage / Resource Protocol — `420/service/resource-protocol/v1`;
- 420Search — `420/service/search/v1`;
- 420Notifications — `420/service/notifications/v1`.

### Direct optional dependency

- 420Identity — `420/service/identity/v1` — optional profile/controller presentation while Wallet-only pseudonymous operation remains valid where Media permits it.

### Transitive through 420Media

- 420Pay — `420/service/pay/v1`;
- 420 Compute Market — `420/service/compute-market/v1`.

DoobTube V1 does not bypass Media to create direct Pay/Compute authority.

### Explicitly not adopted for V1

420 Names, Explorer, Analytics, Verify, Arbitration, AppStore, Governance, Treasury, Bridge, AI, Oracle Interface Layer, Stake, Token, Swap, Attention, Gaming Protocol and unrelated ecosystem services are not V1 runtime dependencies.

## Canonical authority decisions

DOOBTUBE-2 establishes:

- ProtocolRegistry proves service binding, not content/user authority;
- Wallet/SmartAccount owns signing/execution and reusable capability/session authority;
- 420Media remains the sole canonical Media service dependency;
- 420Identity owns profile activity/controller state but remains optional;
- 420Rights owns protocol rights/provenance/license state;
- Storage/Resource owns canonical object/storage readiness semantics;
- Search is public derived discovery only;
- Notifications owns opt-in subscription/delivery preference state and cannot sign/spend/mutate Media;
- Pay/Compute remain Media-owned transitive integrations;
- Media moderation remains application-scoped;
- Arbitration is not silently substituted for V1 Media moderation appeals;
- DoobTube caches/feeds/preferences remain replaceable and non-authoritative.

## Failure/degraded modes frozen

- Registry failure → stale public presentation only; mutations blocked.
- Wallet absent/wrong network → public read-only.
- Identity unavailable → Wallet-only pseudonymous mode where Media permits it.
- Media unavailable → stale public presentation only.
- Rights unavailable/stale → no new public publication; revalidation required.
- Storage unavailable → no new storage mutations/readiness fabrication; existing authorized playback only where still valid.
- Search unavailable → direct-reference and creator workflows only.
- Notifications unavailable → Media workflows continue; subscription/preferences unavailable.
- Pay unavailable → no DoobTube fallback settlement.
- Compute unavailable → Media remains pending/processing; DoobTube cannot force READY.

## Threat model frozen

The dependency boundary explicitly covers:

- malicious/stale service discovery;
- actor substitution;
- derived-state poisoning;
- dependency downgrade/fail-open;
- transitive dependency bypass;
- privacy leakage;
- confused-deputy moderation.

## Files changed for DOOBTUBE-2

- `docs/DOOBTUBE-DEPENDENCIES-TRUST.md` — canonical graph, authority matrix, threat/failure model;
- `docs/DOOBTUBE-ROADMAP.md` — DOOBTUBE-2 marked COMPLETE (Level 1);
- `docs/DOOBTUBE-AUDIT.md` — reconciled dependency/integration findings;
- `scripts/verify-doobtube-baseline.py` — extended with canonical service-ID, dependency, trust, threat and degraded-mode assertions.

## Repository base

Current `main` / qualification base:

`ff4440bfd7b69c0712ee3dd7c4b417cb049ae76d`

The branch was already reconciled to this main during DOOBTUBE-1 and remained 0 commits behind throughout DOOBTUBE-2 implementation and qualification.

## Level 1 qualification

Qualified implementation SHA:

`04a35ee9f853627f3df1c9cf4636092421971547`

Workflow: **DoobTube baseline audit**
Run: **37559441715**
Job: **baseline / 112593151151**
Result: **PASS**

Passed on the exact implementation SHA:

- exact PR-head checkout;
- exact implementation SHA assertion;
- DOOBTUBE-0 architecture invariants;
- DOOBTUBE-1 product-scope invariants;
- canonical service IDs in `ServiceIds420.sol` for Registry, Identity, Rights, Resource, Search, Notifications, Pay and Compute Market;
- canonical 420Media service ID/name/target/authority;
- exact canonical Media dependency set:
  - 420 Identity;
  - 420 Rights;
  - 420 Storage;
  - 420 Search;
  - 420 Notifications;
  - 420 Pay;
  - 420 Compute Protocol;
- direct/optional/transitive/not-adopted dependency classifications;
- required degraded-mode semantics;
- required dependency threat domains;
- trust-boundary assertions;
- DOOBTUBE-2 COMPLETE roadmap state;
- no second DoobTube/420Video service identity;
- no frozen Genesis DoobTube application entry;
- no premature DoobTube runtime/contract namespace;
- no false testnet/Genesis/production readiness claim.

No required DOOBTUBE-2 check was skipped, cancelled, missing or stale.

## Security/adversarial/invariant result

DOOBTUBE-2 adds no executable runtime, contract, custody or deployment surface.

Architecture-level negative invariants qualified:

- canonical Registry failure cannot fall back to an unverified mutation endpoint;
- Wallet connection is not blanket authorization;
- private signing authority never enters DoobTube;
- Identity remains optional;
- Rights failure cannot widen publication;
- Storage transport cannot substitute for canonical readiness;
- Search cannot authorize access/publication;
- Notifications cannot mutate Media/Wallet state;
- Pay/Compute remain transitive behind Media;
- Arbitration is not silently invoked;
- stale derived state cannot override revocation/visibility;
- dependency outages degrade only dependent workflows.

No unresolved DOOBTUBE-2 trust-boundary contradiction remains.

## Milestone status

DOOBTUBE-2 is an **ordinary Level 1 roadmap step**.

It does not yet converge implemented components; therefore Level 2 is not required.

The documented Level 2 milestone remains:

**DOOBTUBE-8 — Ecosystem integration milestone**

## Intentionally deferred Level 3 qualification

Per the phase model, the following remain deferred until **DOOBTUBE-11 — Repository Level 3 exact-head closeout**:

- canonical full repository Solidity inventory;
- Genesis/address-authority qualification;
- 420 Integrated/global qualification;
- Docs/global reconciliation;
- unrelated app audits;
- global fault/soak qualification;
- final client/service/Indexer/Search/RPC/frontend/backend integration inventory;
- final static/security/deployment/config/build/lint/type qualification.

These are not blockers for this app-scoped dependency/trust documentation step. The audit policy explicitly reserves Level 3 for the final accumulated app-phase merge candidate. 

## Limitations and blockers

No blocker remains for DOOBTUBE-2.

The dependency graph is canonical, but no DoobTube runtime adapters exist yet. Data schemas, lifecycle ownership, idempotency and recovery are intentionally the next step.

## Evidence SHA rule

This file is a durable **evidence-only** commit written after the exact implementation SHA qualified.

It changes no executable source, tests, workflows, dependencies, configuration, generated/runtime artifacts, interfaces, deployment state or substantive requirements. Therefore the qualified implementation SHA remains authoritative without recursive qualification.

## Next canonical roadmap step

**DOOBTUBE-3 — Data, storage, media-processing and lifecycle architecture**

# HZ-GCA-1.16 — API/event/interface contracts qualification evidence

Status: **COMPLETE — Level 1**

Canonical parent step: **HZ-GCA-1 — Scope, threat model and authority map**

Work package: **HZ-GCA-1.16 — API/event/interface contracts**

## Qualification identity

- Repository: `abvhiael/420-integrated-v0.1`
- PR: **#565 — Add 420Hz Generate, Community & Awards roadmap phase**
- Branch: `feature/420hz-generate-community-awards-roadmap`
- Current `main` / base SHA: `d112b2eb55b50a3a4f52a5e2a5364374595efe71`
- Qualified implementation SHA: `af90b726e845b653a9452d12eb516b5675fbe6b1`
- Qualification level: **Level 1 — per-roadmap-step fast qualification**
- Level 2 milestone: **NOT REQUIRED for HZ-GCA-1.16**
- Level 3: **DEFERRED to HZ-GCA-17 phase closeout**

## Canonical definition

HZ-GCA-1.16 freezes logical API, event and dependency-interface contracts only.

It deliberately does not assign a 420Hz canonical service ID, production base URL, deployed address, ABI, live adapter or testnet binding.

## Implementation completed

Added:

- `hz/config/gca-api-interface-contracts-v1.json`
- `docs/architecture/420hz/HZ-GCA-1.16-API-EVENT-INTERFACE-CONTRACTS.md`
- `scripts/verify-420hz-gca-1-16.py`

Updated:

- `docs/420HZ-GENERATE-COMMUNITY-AWARDS-ROADMAP.md`
- `.github/workflows/420hz-gca.yml`

## Requirements satisfied

### Request/response/event envelopes

Request contracts now distinguish:

- fields required for every logical request;
- `actorRef` + `idempotencyKey` required specifically for authority-bearing mutations;
- chain/network/capability/deadline/revision/checkpoint context where material.

This preserves HZ-GCA-1.10 anonymous PUBLIC reads while requiring qualified Wallet/session authority for mutations.

Response contracts retain source/version and optional checkpoint/finality metadata.

Event contracts retain source/subject/visibility and conditional chain/finality/revision/commitment context.

### Canonical dependency identities

HZ-GCA-1.16 binds only repository-defined canonical IDs:

- ProtocolRegistry — `420/service/protocol-registry/v1`
- Wallet — `420/service/wallet/v1`
- Smart Accounts — `420/service/smart-accounts/v1`
- Identity — `420/service/identity/v1`
- Rights — `420/service/rights/v1`
- Resource Protocol — `420/service/resource-protocol/v1`
- Pay — `420/service/pay/v1`
- AI — `420/service/ai/v1`
- Compute Market — `420/service/compute-market/v1`
- Search — `420/service/search/v1`
- Notifications — `420/service/notifications/v1`
- Analytics — `420/service/analytics/v1`
- Arbitration — `420/service/arbitration/v1`

The verifier confirms every one against `contracts/src/libraries/ServiceIds420.sol`.

No `420/service/420hz/*` identity is invented.

### Logical dependency interfaces

Frozen logical interfaces:

1. RegistryDiscovery420Hz
2. WalletAuthorization420Hz
3. AIGeneration420Hz
4. ComputeExecution420Hz
5. CreativeRights420Hz
6. Storage420Hz
7. IdentityEligibility420Hz
8. PaymentHandoff420Hz
9. IndexerSearchRead420Hz
10. Notifications420Hz
11. Analytics420Hz
12. Arbitration420Hz

Each contract records owner/dependency, operations, consumed/returned state and forbidden authority escalation.

### Commands / queries

The application command catalogue includes generation project/draft/quote/submit/cancel, Register & Publish, Community mutations, Awards nomination/vote and moderation report/appeal.

The query catalogue includes generation/project/provenance, published media, Community, playlist, Charts, Awards and moderation reads.

### Logical event catalogue

The manifest freezes 23 logical event types across:

- generation;
- release registration/publication;
- Community;
- Charts;
- Awards;
- moderation;
- optional Arbitration observation;
- Notifications delivery failure.

Events are facts/observations and never ambient cross-domain authority.

### Idempotency / replay

Every mutating command is scoped by operation/domain/resource/material-payload idempotency.

Duplicate retries reconcile or fail without duplicate side effects.

Changed payload under an existing key fails.

Stable event IDs prevent event redelivery from repeating source mutations.

Cross-chain/cross-domain reuse of authorization, voter nullifier, settlement reference or moderator capability fails closed.

### Versioning / compatibility

Every envelope has explicit `schemaVersion`.

Breaking field/semantic changes require an explicit new version.

Unknown required states/enums fail closed.

Accepted jobs/ballots/results preserve the interface/policy commitments frozen at acceptance.

### Privacy / minimum disclosure

The interface contract prevents raw private prompts/drafts from entering Search/Analytics/Notifications.

Identity voting consumes minimum-disclosure predicate/nullifier output.

Moderation/Arbitration public events use commitments/status rather than raw private evidence.

Public APIs/events cannot widen source visibility.

### Error taxonomy

Frozen logical errors cover argument/auth/authz/not-found/conflict/stale/wrong-network/replay/expiry/rate/policy/dependency/integrity/verification/support/internal failures.

## Interface invariants

The manifest freezes **HZGCA-API-001 through HZGCA-API-018**.

The verifier checks:

- no invented 420Hz service ID/address/endpoint/live adapter;
- exact dependency IDs against ServiceIds420;
- anonymous-read / mutation-authority separation;
- request/response/event envelope fields;
- error vocabulary;
- exact 12-interface set;
- command/query inventory;
- exact 23-event inventory;
- event semantic separation;
- idempotency/replay behavior;
- versioning/freshness;
- privacy/minimum disclosure;
- fail-closed behavior;
- prerequisite HZ-GCA-1.10/1.13/1.14/1.15 consistency;
- all 18 invariant IDs;
- roadmap Level-1/non-milestone classification.

## Level-1 qualification

Dedicated workflow:

**420Hz GCA Qualification**

Successful exact-head run:

- Run ID: **37742446370**
- Run number: **#199**
- Job: **HZ-GCA Level 1**
- Job ID: **113196054717**
- Exact tested SHA: `af90b726e845b653a9452d12eb516b5675fbe6b1`
- Result: **PASS**

Successful checks:

1. exact PR-head checkout/verification;
2. all GCA JSON manifest syntax validation;
3. retained HZ-GCA-1.1 verifier;
4. retained HZ-GCA-1.2 verifier;
5. retained HZ-GCA-1.3 verifier;
6. retained HZ-GCA-1.4 verifier;
7. retained HZ-GCA-1.5 verifier;
8. retained HZ-GCA-1.6 verifier;
9. retained HZ-GCA-1.7 verifier;
10. retained HZ-GCA-1.8 verifier;
11. retained HZ-GCA-1.9 verifier;
12. retained HZ-GCA-1.10 verifier;
13. retained HZ-GCA-1.11 verifier;
14. retained HZ-GCA-1.12 verifier;
15. retained HZ-GCA-1.13 verifier;
16. retained HZ-GCA-1.14 verifier;
17. retained HZ-GCA-1.15 verifier;
18. HZ-GCA-1.16 API/event/interface verifier.

The concurrently triggered **420Hz Web Qualification #125** and **420Docs Qualification #7303** also passed on the same exact implementation SHA. These are collateral evidence and do not substitute for the required GCA Level 1 workflow.

## Diagnosed failed attempt

Initial exact-head run:

- SHA: `07b8fb6274dd4ea1cab452a0077cd216e34c335c`
- Run ID: **37741433560**
- Job ID: **113192799212**
- Result: **FAIL**

The run spent substantial time queued for runner availability, then executed. Every retained HZ-GCA-1.1 through HZ-GCA-1.15 check passed.

Only HZ-GCA-1.16 failed with:

- `event semantic rule missing: not automatically Chart credit`
- `event semantic rule missing: not Award eligibility`
- `versioning rule missing: Unknown required enum/state`

Diagnosis: **test-harness wording defects**.

The normative manifest already required:

- Community events do not become Chart credit unless admitted by exact Chart policy;
- ChartSnapshot publication does not create Award eligibility/result;
- unknown required enum/state values fail closed.

Repair:

- aligned only verifier substring matching with the normative strings;
- changed no API envelope;
- changed no event semantics;
- weakened no versioning/fail-closed rule;
- changed no dependency authority or privacy boundary.

The repaired exact SHA passed.

## Security / adversarial result

Result: **PASS**

The verifier rejects interface definitions that:

- invent a 420Hz service ID/address/endpoint;
- allow mutation without actor/domain/idempotency context;
- accept wrong-network/incompatible dependency state;
- expose private/unlisted payloads through public event/query fallback;
- allow duplicate command/event side effects;
- treat derived reads as privileged authority;
- allow event delivery state to rewrite source state;
- broaden Identity/Wallet/Creative/Rights/Compute/Arbitration authority;
- consume an Arbitration remedy beyond HZ-GCA-1.14's allowlist.

## Level 2 status

**Not run / not required.**

HZ-GCA-1.16 is an ordinary architecture/interface-definition step.

It defines contracts for future cross-component wiring but introduces no runtime adapter or shared executable integration that would independently trigger a Level-2 milestone.

The HZ-GCA-1 Level-2 milestone remains **HZ-GCA-1.20**.

## Intentionally deferred Level 3

Deferred to HZ-GCA-17:

- canonical full Solidity inventory;
- Genesis/address-authority qualification;
- 420 Integrated/global qualification;
- Docs/global reconciliation;
- retained 420Hz app suite;
- affected SDK/Wallet/Indexer/Search/RPC/frontend/backend/service suites;
- full adversarial/invariant/security/static qualification;
- deployment/config verification.

Solidity Contracts remains the canonical owner of the complete Foundry inventory. Genesis/address-authority remains a distinct owner and must not duplicate that inventory.

## Limitations

HZ-GCA-1.16 intentionally does not implement or claim:

- HTTP/RPC endpoint paths;
- a 420Hz canonical Registry service identity;
- production service origin/base URL;
- deployed adapter/service;
- concrete SDK/client;
- live AI/Compute/Storage/Search/Notifications wiring;
- deployed ABI/address;
- testnet/production compatibility evidence.

Those belong to later implementation/testnet work.

## Blockers

None for HZ-GCA-1.16.

## Completion state

**HZ-GCA-1.16 — COMPLETE (Level 1).**

Parent **HZ-GCA-1 remains IN PROGRESS**.

Next canonical work package:

**HZ-GCA-1.17 — Failure and recovery semantics**

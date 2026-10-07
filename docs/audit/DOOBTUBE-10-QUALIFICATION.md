# DoobTube — DOOBTUBE-10 qualification evidence

Roadmap step: **DOOBTUBE-10 — Documentation, deployment and operator closeout**
Qualification level: **Level 1 — app-scoped documentation/deployment/operator qualification**
Status: **COMPLETE**
PR: **#553**
Branch: `audit/doobtube-baseline-20261006`

## Implementation summary

DOOBTUBE-10 closes the repository documentation, non-production deployment and operator-readiness requirements required before the final Level 3 repository closeout.

The step adds:

- root repository DoobTube entry point;
- app-root README;
- consolidated architecture/component/contract/API/event/state-machine reference;
- roles/permissions and Registry/service identity reference;
- user guide;
- developer guide;
- operator guide;
- configuration/environment reference;
- clean build/test instructions;
- loopback-only non-production deployment launcher;
- non-production deployment profile;
- migration/upgrade/rollback guidance;
- troubleshooting/recovery guidance;
- monitoring/SLO targets;
- release manifest;
- executable non-production deployment smoke tests;
- dedicated documentation/deployment/operator verifier.

The implementation deliberately does not claim public-testnet, Genesis or production readiness.

## Files changed

- `README.md`
- `doobtube/README.md`
- `docs/DOOBTUBE-REFERENCE.md`
- `docs/DOOBTUBE-USER-GUIDE.md`
- `docs/DOOBTUBE-DEVELOPER-GUIDE.md`
- `docs/DOOBTUBE-OPERATOR-GUIDE.md`
- `doobtube/ops/__init__.py`
- `doobtube/ops/config.py`
- `doobtube/ops/server.py`
- `doobtube/deploy/nonproduction.example.json`
- `doobtube/release/manifest-v1.json`
- `doobtube/tests/test_doobtube_ops.py`
- `scripts/verify-doobtube-docs.py`
- `scripts/verify-doobtube-security.py`
- `scripts/verify-doobtube-baseline.py`
- `docs/DOOBTUBE-ROADMAP.md`
- `docs/DOOBTUBE-AUDIT.md`
- `.github/workflows/doobtube-baseline.yml`

## Canonical requirement satisfaction

### Root/app README

Satisfied by:

- root `README.md` DoobTube entry point;
- `doobtube/README.md`.

The app README documents scope, repository map, clean qualification commands, non-production launch, config, docs and release boundary.

### Architecture/component map

Satisfied by:

`docs/DOOBTUBE-REFERENCE.md`

It records Browser/Wallet/backend/dependency topology and preserves DoobTube as replaceable application presentation/control-plane state over canonical external authorities.

### Contract/interface/API/event/state-machine documentation

The reference records:

- no DoobTube-owned contracts;
- no ABI/predeploy/reserved address;
- stable DoobTube V1 API routes;
- consumed 420Media interfaces;
- derived `ProjectionEvent` shape;
- SQLite schema v2;
- canonical product state-machine ownership;
- transport-success-is-not-READY invariant.

### Roles/permissions

Documented roles:

- anonymous browser user;
- Wallet user/creator;
- optional Identity;
- Media moderator;
- DoobTube operator.

No role gains protocol authority beyond its canonical owner.

### Registry identities

Exact canonical service identities are documented for:

- ProtocolRegistry;
- Wallet;
- Smart Accounts;
- Media;
- optional Identity;
- Rights;
- Resource/Storage;
- Search;
- Notifications;
- Media-transitive Pay/Compute.

DoobTube still has no independent protocol/service Registry identity.

### Config/env reference

Repository non-production schema:

`doobtube-nonproduction-v1`

Browser schema:

`doobtube-web-runtime-v1`

The non-production config requires:

- `production:false`;
- loopback bind;
- bounded port;
- positive chain ID;
- network;
- SQLite path;
- built web root;
- explicit dependency readiness flags.

No repository deployment JSON contains a private key, mnemonic, seed phrase or bearer credential.

### Build/test/deploy instructions

Clean commands are recorded in app/developer docs.

The directly qualified sequence includes:

- Python compilation;
- adapter tests;
- backend tests;
- media tests;
- security tests;
- web qualification;
- operations/deployment smoke tests;
- security verifier;
- docs/operator verifier;
- cumulative DoobTube verifier.

### Non-production deployment

Repository launcher:

`python3 -m doobtube.ops.server --config doobtube/deploy/nonproduction.example.json`

Properties:

- loopback-only;
- static built web content;
- DoobTube public `health/readiness/feed` endpoints;
- default external dependency readiness = unavailable;
- authority-bearing HTTP writes rejected with `NONPRODUCTION_AUTH_NOT_CONFIGURED`;
- no production-origin claim;
- no production authentication gateway invented.

Default readiness returning 503 while Media/Registry are unresolved is intentional fail-closed behavior.

### Migrations/upgrades

The developer/operator guides document:

- current schema version 2;
- forward migration behavior;
- newer-than-runtime schema refusal;
- pre-upgrade backup;
- migration-on-copy;
- source-SHA recording;
- rollback to compatible database snapshot and previous qualified source;
- rebuild of derived state after recovery.

### Troubleshooting

Operator documentation covers:

- unresolved browser runtime;
- 503 readiness;
- upload not READY;
- uncertain livestream status;
- missing Search media;
- rate limiting;
- newer database schema.

Troubleshooting explicitly forbids bypassing fail-closed gates merely to make smoke tests green.

### User/developer/operator guides

Created:

- `docs/DOOBTUBE-USER-GUIDE.md`
- `docs/DOOBTUBE-DEVELOPER-GUIDE.md`
- `docs/DOOBTUBE-OPERATOR-GUIDE.md`

### Security assumptions/threat model

Canonical security remains:

`docs/DOOBTUBE-SECURITY-ABUSE-MODERATION.md`

DOOBTUBE-10 does not weaken the DOOBTUBE-9 security boundary.

### Known limitations

The technical reference explicitly records:

- no comments/reactions;
- no paid subscription/PPV/tips/ads/token gating;
- no on-chain raw media;
- no native mobile client;
- no qualified delete/export backend endpoint;
- no production auth gateway;
- no production endpoints/TLS;
- no public-testnet evidence;
- no production scanner/egress/monitoring evidence.

### Rollback/recovery

Operator guide documents:

- database snapshot rollback;
- projection rebuild from canonical state;
- livestream restart/controller revalidation;
- credential-leak response;
- operator/provider compromise response;
- malicious upload/scanner response.

### Monitoring/SLOs

Minimum repository monitoring signals include:

- health/readiness;
- dependency drift;
- API errors;
- rate-limit saturation;
- idempotency conflicts/replays;
- job retry/failure;
- projection reorg/rebuild;
- scanner availability/quarantine;
- upload/readiness latency;
- livestream reconnect exhaustion;
- moderation anomalies;
- Media webhook replay/signature failures;
- secret-redaction regressions.

Repository non-production SLO targets are explicitly non-production targets and are not production evidence.

### Release manifest

Repository release manifest:

`doobtube/release/manifest-v1.json`

It records:

- source SHA = `MATERIALIZE_AT_RELEASE`;
- production = false;
- testnet/genesis/production ready = false;
- no DoobTube service identity;
- canonical Media identity;
- no contracts;
- no reserved addresses;
- web runtime schema;
- backend API/schema version;
- later Level 3/public-testnet/security-review gates.

## Exact-head Level 1 qualification

Qualified implementation SHA:

`0186c403f6d7c98acea45fc8027653b7975f98da`

Workflow: **DoobTube baseline audit**

Run: **37574315271**

Job: **baseline / 112639676082**

Result: **PASS**

Exact-head required steps passed:

- checkout;
- exact implementation SHA assertion;
- Python 3.12 setup;
- Node 22 setup;
- repository Go setup;
- DoobTube Python compile;
- protocol adapter suite — 11 tests PASS;
- backend/control-plane suite — 16 tests PASS;
- media integration/adversarial suite — 13 tests PASS;
- security/abuse/privacy suite — 9 tests PASS;
- focused Media security/API dependency tests PASS;
- web structural/security check PASS;
- browser fixtures — 7 PASS / 0 fail;
- deterministic static web build PASS;
- non-production deployment/ops suite — 4 tests PASS;
- retained DOOBTUBE-9 security verifier PASS;
- dedicated DOOBTUBE-10 docs/deployment/operator verifier PASS;
- cumulative DOOBTUBE-0 through DOOBTUBE-10 baseline verifier PASS.

No required DOOBTUBE-10 check was skipped, cancelled, missing or silently substituted.

## Superseded failed runs

### Run 37574037672 / job 112638826758

Implementation SHA:

`ef85a8e729d7a1c22e9e83d53cc9dfd25e809147`

All substantive implementation, web and non-production deployment tests passed.

Failure classification: **retained verifier progress mismatch**.

The DOOBTUBE-9 security verifier still required audit text to end exactly at DOOBTUBE-9 after the audit legitimately advanced to DOOBTUBE-10.

The assertion was changed to accept DOOBTUBE-9-or-later without weakening any security assertion.

### Run 37574147461 / job 112639171082

Implementation SHA:

`c770b341cd536f9f19b7c336ebf073e36edfc539`

All substantive suites, deployment smoke, DOOBTUBE-9 security verifier and DOOBTUBE-10 documentation verifier passed.

Failure classification: **cumulative verifier stale audit preamble**.

The cumulative verifier still expected two DOOBTUBE-9 preamble strings while later assertions already required DOOBTUBE-10 completion.

Those literals were aligned to the reconciled audit.

No product/deployment/security requirement was weakened.

## Current main and divergence

Current `main` at qualification review:

`ea76c951b683a2b75ad2e64902e6e99c3a0b06ea`

PR base remains:

`f674fbed767efc126da253c66800e38d030dc1dd`

At final implementation qualification the audit branch was:

- 161 commits ahead of current main;
- 68 commits behind current main;
- PR #553 open and mergeable.

The 68-commit `main` advance was explicitly inspected.

It changed 50 files but **none** in:

- `doobtube/**`;
- `media/**`;
- `search/**`;
- `notifications/**`;
- `identity/**`;
- `rights/**`;
- `resource/**`;
- `config/genesis-consumer-services.json`;
- `config/genesis-applications.json`;
- `contracts/src/libraries/ServiceIds420.sol`;
- `docs/DOOBTUBE-*`;
- root `README.md`.

Therefore no DOOBTUBE-10 implementation/shared-dependency drift was introduced by that main advance.

A ceremonial ordinary-step merge was intentionally not performed.

Mandatory full reconciliation remains owned by DOOBTUBE-11 Level 3.

## Level 2 status

No new Level 2 qualification is required.

DOOBTUBE-8 remains the documented completed Level 2 milestone.

DOOBTUBE-10 adds documentation, app-local non-production operations tooling and release metadata; it does not introduce a major shared authority/lifecycle dependency.

## Intentionally deferred Level 3 qualification

DOOBTUBE-10 is the final ordinary step before repository phase closeout.

Deferred to **DOOBTUBE-11 — Repository Level 3 exact-head closeout**:

- reconcile accumulated branch with current main;
- establish final merge-candidate SHA;
- canonical full Solidity inventory once under Solidity Contracts ownership;
- Genesis/address-authority qualification without duplicate Foundry inventory;
- 420 Integrated/global qualification where applicable;
- Docs/global reconciliation;
- retained DoobTube suites;
- affected client/service/Indexer/Search/RPC/frontend/backend suites;
- final security/adversarial/invariant/static analysis;
- deployment/config/build/lint/type verification;
- stale/duplicate/orphaned artifact cleanup;
- roadmap/audit/frozen-address/deployment reconciliation.

## Limitations / blockers

No repository blocker remains for DOOBTUBE-10 itself.

The app is still not:

- repository-phase COMPLETE until DOOBTUBE-11;
- public-testnet ready until DOOBTUBE-12;
- Genesis/production ready until DOOBTUBE-13.

Live scanner, secret manager, distributed rate limits, TLS/domain, external providers, monitoring/backups and production incident-response evidence remain later live-environment requirements.

## Completion state

**DOOBTUBE-10: COMPLETE — Level 1 qualified.**

## Evidence SHA rule

This file is a durable evidence-only update written after the exact implementation SHA passed required qualification.

It changes no executable source, tests, workflows, dependencies, configuration, generated/runtime artifacts, interfaces, deployment state or substantive requirements.

The qualified implementation SHA remains authoritative without recursive qualification.

## Next canonical roadmap step

**DOOBTUBE-11 — Repository Level 3 exact-head closeout**

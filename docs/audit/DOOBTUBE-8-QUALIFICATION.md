# DoobTube — DOOBTUBE-8 qualification evidence

Roadmap step: **DOOBTUBE-8 — Ecosystem integration milestone**
Qualification level: **Level 2 — retained app integration milestone**
Status: **COMPLETE**
PR: **#553**
Branch: `audit/doobtube-baseline-20261006`

## Implementation summary

DOOBTUBE-8 is the documented retained app-integration milestone for the accumulated DOOBTUBE-0 through DOOBTUBE-7 implementation.

It adds no new user-facing product feature and no new protocol authority.

The milestone adds:

- an executable cross-component authority/dependency harness;
- a retained Level 2 integration test suite;
- a dedicated Level 2 repository/schema/interface verifier;
- a dedicated exact-SHA Level 2 CI workflow;
- roadmap/audit reconciliation for the milestone.

## Files changed

- `doobtube/integration/__init__.py`
- `doobtube/integration/milestone.py`
- `doobtube/tests/test_doobtube_level2_integration.py`
- `docs/DOOBTUBE-ECOSYSTEM-INTEGRATION.md`
- `docs/DOOBTUBE-ROADMAP.md`
- `docs/DOOBTUBE-AUDIT.md`
- `scripts/verify-doobtube-level2.py`
- `scripts/verify-doobtube-baseline.py`
- `.github/workflows/doobtube-integration.yml`
- `.github/workflows/doobtube-baseline.yml`

## Canonical dependency disposition revalidated

### Direct required

- ProtocolRegistry — `420/service/protocol-registry/v1`
- Wallet — `420/service/wallet/v1`
- Smart Accounts — `420/service/smart-accounts/v1`
- 420Media — `420/service/media/v1`
- 420Rights — `420/service/rights/v1`
- 420Storage / Resource Protocol — `420/service/resource-protocol/v1`
- 420Search — `420/service/search/v1`
- 420Notifications — `420/service/notifications/v1`

### Direct optional

- 420Identity — `420/service/identity/v1`

Identity absence degrades to Wallet-only pseudonymous operation.

### Transitive through 420Media

- 420Pay — `420/service/pay/v1`
- 420 Compute Market — `420/service/compute-market/v1`

Direct DoobTube Pay/Compute calls remain rejected.

### Not adopted in V1

- 420Arbitration
- 420Analytics
- 420Verify
- 420Explorer

No runtime authority/dependency was introduced for them.

## Registry integration

The Level 2 harness requires exact service identity, active/non-deprecated lifecycle, expected chain and bounded freshness for every required/adopted service snapshot.

Negative coverage rejects:

- stale Registry observation;
- future observation;
- wrong chain;
- inactive service;
- service-ID substitution;
- missing required Registry snapshot.

Identity alone may be absent because it is explicitly optional.

## Wallet / Smart Accounts / Identity

Integrated mutation flow requires Wallet authority.

When optional Identity is available:

- Identity Wallet reference must match the Wallet actor;
- profile reference must be complete;
- controller reference must be complete.

When unavailable:

- no Identity authority/profile/controller value may be fabricated;
- Wallet-only pseudonymous operation remains valid.

No Identity or DoobTube state can replace Wallet signing or Smart Account execution authority.

## Media compatibility

Level 2 reuses the DOOBTUBE-4 Media compatibility gate:

- exact `420/service/media/v1`;
- API `v1`;
- compatibility major 1;
- expected chain;
- expected network;
- upload capability;
- livestream capability.

Wrong Media version/identity/network/capability fails closed.

## Rights / provenance

Integrated public flow requires:

- matching Media asset identity;
- publication authorization;
- no Rights revocation;
- non-empty provenance reference.

Negative tests prove Rights revocation or identity/provenance mismatch blocks the public path.

## Storage

Integrated public flow requires complete canonical Storage identity and:

- sealed;
- retrievable;
- live.

Unsealed, unretrievable or non-live Storage state fails closed.

Provider/transport success cannot replace canonical readiness.

## Search / indexing

Search source identity must remain:

`420/service/search/v1`

Public discovery remains gated by:

- Media state READY;
- PUBLIC visibility;
- Rights authorization;
- expected chain.

Negative coverage rejects:

- UNLISTED/public widening;
- Search canonical-authority claim;
- Search service substitution;
- Search/Media asset identity mismatch;
- invalid finality/index relationship.

The current V1 web application consumes the qualified 420Media public Search composition endpoint while 420Search remains the owning derived-discovery authority.

## Notifications

Notification subscription state must:

- be confirmed;
- match the Wallet actor;
- remain non-promotional unless separately consented;
- remain non-paid;
- carry no signing authority;
- carry no spending authority.

Negative coverage rejects actor substitution and every entitlement/marketing/Wallet-authority escalation.

## Pay / settlement

V1 intentionally has no monetization or custody path.

Level 2 therefore proves:

- Pay service identity remains canonical;
- Pay remains `TRANSITIVE_MEDIA`;
- direct DoobTube Pay invocation remains denied;
- no DoobTube balance/escrow/refund/settlement ledger exists.

No artificial payment flow was added solely to satisfy the milestone.

## Compute / media processing

Compute Market remains `TRANSITIVE_MEDIA`.

The Level 2 workflow reruns the retained DOOBTUBE-6 media integration/adversarial suite on the same exact SHA, including:

- static processing profiles;
- provider/operator binding;
- provider freshness;
- result verification;
- deadlines;
- output-readiness separation;
- processing resource bounds.

No direct DoobTube Compute scheduler/provider path exists.

## Moderation / arbitration

Media app-scoped moderation remains adopted and is retained through the browser/API fixture coverage for report and appeal behavior.

420Arbitration remains **NOT_ADOPTED_V1**.

No report/appeal path silently escalates into protocol Arbitration.

## Analytics / Verify / Explorer

Analytics, Verify and Explorer remain non-dependencies.

The dedicated verifier asserts they do not appear as executable DoobTube service dependencies.

They cannot become authorization inputs for playback, publication, Wallet actions or moderation.

## Authority transfer protection

The retained milestone freezes the canonical authority map for:

- service discovery;
- Wallet signing;
- Smart Account execution;
- Media lifecycle;
- stream controller;
- optional Identity profile;
- Rights/provenance;
- Storage readiness;
- Search/public discovery;
- Notifications subscription;
- Pay settlement;
- Compute processing.

A test substitutes DoobTube into every canonical authority domain and requires fail-closed behavior.

## Level 1 qualification on milestone SHA

Qualified implementation SHA:

`0fc1bf275d917a5d2e30b3d8857d22b57ee0bd34`

Workflow: **DoobTube baseline audit**
Run: **37570789461**
Job: **baseline / 112628696047**
Result: **PASS**

Exact-head Level 1 retained checks passed:

- exact SHA assertion;
- Python setup;
- Node setup;
- Python compile;
- protocol-adapter suite — 11 tests PASS;
- backend/control-plane suite — 16 tests PASS;
- media integration/adversarial suite — 13 tests PASS;
- web structural/security check PASS;
- browser/service fixtures — 7 tests PASS / 0 fail;
- deterministic static web build PASS;
- cumulative DOOBTUBE-0 through DOOBTUBE-8 baseline verifier PASS.

No required fast-gate check was skipped, cancelled, missing, stale or silently substituted.

## Level 2 qualification

Qualified implementation SHA:

`0fc1bf275d917a5d2e30b3d8857d22b57ee0bd34`

Workflow: **DoobTube Level 2 integration**
Run: **37570789352**
Job: **integration / 112628695838**
Result: **PASS**

Exact-head Level 2 steps passed:

- exact SHA assertion;
- Python compile;
- retained protocol-adapter suite — 11 tests PASS;
- retained backend/control-plane suite — 16 tests PASS;
- retained media integration/adversarial suite — 13 tests PASS;
- dedicated Level 2 ecosystem integration suite — 11 tests PASS;
- retained web structural/security check PASS;
- retained browser/service fixture suite — 7 tests PASS / 0 fail;
- deterministic static web build PASS;
- cumulative DoobTube baseline verifier PASS;
- dedicated Level 2 repository/schema/interface verifier PASS.

Both Level 1 and Level 2 workflows qualified the same exact implementation SHA.

## Dedicated Level 2 schema/interface verification

The dedicated verifier confirms against repository truth:

- canonical Registry/Wallet/Smart Account/Search/Notifications/Identity/Storage/Rights/Pay/Compute service-ID preimages;
- exact 420Media consumer dependency set;
- Media API V1 identity/signing domain/provenance/upload/livestream/Search/notification schema presence;
- exact Media composition routes for Search, Notifications, upload, livestream and moderation;
- exact Search HTTP V1 API identity/routes;
- current DoobTube web usage of qualified Media composition routes;
- no direct Pay route;
- no direct Compute route;
- no runtime Arbitration/Analytics/Verify/Explorer dependency;
- roadmap Level 2 completion state;
- audit DOOBTUBE-0 through DOOBTUBE-8 completion state.

## Superseded failed Level 2 runs

### Run 37570675795 / job 112628363125

Implementation SHA:

`b73df36a111c2902398a148d62ae9927e5e59a9c`

Result: **FAIL**

All executable suites and the cumulative baseline verifier passed.

Failure classification: **test-harness/schema-field defect**.

The Level 2 verifier read the canonical Media consumer dependency field as:

`dependencies`

but the repository schema correctly uses:

`depends_on`

The expected dependency set itself was correct. The verifier field lookup was repaired without changing the integration requirement.

### Run 37570738008 / job 112628533242

Implementation SHA:

`9e930ac9567243c47f8be940446be67143824623`

Result: **FAIL**

Passed before the failure:

- exact SHA;
- compile;
- retained adapter suite;
- retained backend suite;
- retained media suite;
- dedicated Level 2 integration tests;
- retained web qualification;
- cumulative baseline verifier.

Failure classification: **test-harness wording mismatch**.

The roadmap correctly states:

`Canonical milestone definition`

while the verifier expected:

`Canonical ecosystem integration definition`

The verifier was aligned to the exact committed roadmap wording. No integration requirement was weakened.

## Security / adversarial / invariant result

Qualified milestone invariants:

- exact canonical service IDs remain stable;
- Wallet/Smart Account authority cannot transfer to DoobTube/Identity;
- optional Identity failure degrades rather than blocking valid Wallet-only operation;
- Rights revocation cannot widen public publication;
- Storage transport cannot become readiness;
- Search cannot widen visibility or claim canonical authority;
- Notifications cannot become entitlement, marketing consent, signing or spending authority;
- Pay/Compute remain Media-transitive;
- Media processing cannot bypass output readiness;
- moderation remains app-scoped;
- Arbitration remains unadopted;
- Analytics/Verify/Explorer remain non-dependencies;
- every canonical authority domain rejects transfer to DoobTube.

No unresolved DOOBTUBE-8 app-integration defect remains.

## Repository base

Current `main` / qualification base:

`f674fbed767efc126da253c66800e38d030dc1dd`

The audit branch was 0 commits behind current main at exact-head Level 1 and Level 2 qualification.

No reconciliation commit was required for DOOBTUBE-8.

## Milestone status

DOOBTUBE-8 is the documented **Level 2 app integration milestone**.

Level 2 is therefore **COMPLETE** on:

`0fc1bf275d917a5d2e30b3d8857d22b57ee0bd34`

## Intentionally deferred Level 3 qualification

DOOBTUBE-8 is not the app-phase repository closeout.

The following remain intentionally deferred until **DOOBTUBE-11 — Repository Level 3 exact-head closeout**:

- canonical full repository Solidity inventory;
- Genesis/address-authority qualification;
- 420 Integrated/global qualification;
- Docs/global reconciliation;
- unrelated app audits;
- global fault/soak qualification;
- final complete affected client/service/Indexer/Search/RPC/frontend/backend suite;
- final static/security/deployment/config/build/lint/type closeout.

These broad checks are not blockers for this Level 2 app-focused milestone.

## Limitations / blockers

No repository blocker remains for DOOBTUBE-8.

This milestone uses repository-qualified interfaces and retained fixtures. It does not claim production-equivalent live service deployment, public testnet availability, TLS/domain configuration or live external dependency evidence.

Those remain later DOOBTUBE-10/12/13 concerns.

## Completion state

**DOOBTUBE-8: COMPLETE — Level 2 qualified.**

## Evidence SHA rule

This file is a durable **evidence-only** update written after the exact implementation SHA passed both required workflows.

It changes no executable source, tests, workflows, dependencies, configuration, generated/runtime artifacts, interfaces, deployment state or substantive requirements.

The qualified implementation SHA remains authoritative without recursive qualification.

## Next canonical roadmap step

**DOOBTUBE-9 — Security, abuse and moderation qualification**

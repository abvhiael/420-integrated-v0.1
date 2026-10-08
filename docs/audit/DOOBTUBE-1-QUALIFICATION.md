# DoobTube — DOOBTUBE-1 qualification evidence

Roadmap step: **DOOBTUBE-1 — Product scope and canonical user workflows**
Qualification level: **Level 1 — app-scoped product-definition qualification**
Status: **COMPLETE**
PR: **#553**
Branch: `audit/doobtube-baseline-20261006`

## Implementation summary

DOOBTUBE-1 freezes the complete initial V1 product boundary in `docs/DOOBTUBE-PRODUCT-SCOPE.md`.

The adopted V1 includes:

- anonymous public discovery/search/playback without forced Wallet or Identity;
- Wallet/network validation for authority-bearing actions;
- optional 420Identity presentation while preserving Wallet-only pseudonymous operation;
- creator/channel presentation without a new channel authority;
- creator library, upload preparation/transport/canonical-readiness workflow;
- PRIVATE / UNLISTED / PUBLIC V1 visibility;
- Rights/provenance-gated public publication;
- safe playback;
- public home/discovery and Search;
- basic livestream create/status/start/stop plus qualified public live viewing;
- opt-in, reversible creator-update subscriptions;
- non-authoritative link/reference sharing;
- user reports, application-scoped moderation and appeal;
- authorized delete requests with truthful retention semantics;
- metadata/reference export;
- semantic/keyboard/status/focus/reduced-motion accessibility baseline;
- responsive desktop/mobile core workflows.

Explicit V1 non-goals include comments/threaded discussion, reactions/likes, paid subscriptions, pay-per-view, tips/donations, advertising/revenue sharing, sponsored ranking, token-gated media, mandatory 420Identity, raw media on-chain and native mobile apps.

## Canonical sources reconciled

DOOBTUBE-1 was defined against:

- `docs/DOOBTUBE-ROADMAP.md`;
- `docs/DOOBTUBE-ARCHITECTURE.md`;
- `config/genesis-consumer-services.json`;
- `config/genesis-applications.json`;
- canonical 420Media upload/library/playback/livestream documentation;
- canonical Media Identity/Rights boundaries;
- canonical Search/Notifications projection/privacy boundaries;
- canonical Media moderation/security boundaries.

No 420Media service identity, Genesis application decision or shared protocol semantics were changed.

## Repository reconciliation

Before qualification, the audit branch was reconciled with current `main`.

Reconciliation base / current `main` at qualification:

`ff4440bfd7b69c0712ee3dd7c4b417cb049ae76d`

Main had advanced substantially since DOOBTUBE-0. Current-main verification confirmed:

- `420/service/media/v1` still names `420Media`;
- target remains `video_uploads_basic_livestreaming`;
- authority remains `REPLACEABLE_APPLICATION`;
- DoobTube/420Video is absent from the frozen Genesis application catalog;
- no canonical DoobTube/420Video service or runtime had appeared on main;
- canonical 420Media user-facing scope still includes upload/library/playback/livestream.

The branch was then merged onto that exact current main before qualification.

## Requirements satisfied

DOOBTUBE-1 required explicit treatment of every original roadmap product category.

1. **Account/Wallet and optional Identity** — anonymous public viewing, Wallet-gated mutations, optional Identity.
2. **Channel/profile model** — creator presentation grouping without new canonical channel authority.
3. **Upload/publish/library/playback** — included with canonical-readiness and Rights gates.
4. **Feeds/discovery/search** — included as public-only, rebuildable, non-authoritative presentation.
5. **Livestreaming** — included for basic create/status/start/stop/viewing.
6. **Subscriptions/following** — included as reversible creator-update preference, not paid entitlement.
7. **Comments/reactions/sharing** — sharing included; comments/reactions explicitly deferred.
8. **Monetization** — viewer/creator monetization explicitly deferred; no app custody.
9. **Rights/provenance** — authoritative Rights gate and provenance presentation required.
10. **Privacy/visibility** — PRIVATE/UNLISTED/PUBLIC semantics frozen with fail-closed presentation.
11. **Reporting/moderation/appeals** — report, scoped moderation, appeal included without protocol authority escalation.
12. **Deletion/retention/export** — authorized delete request, truthful retention boundary and metadata/reference export included.
13. **Accessibility/responsive UX** — semantic, keyboard, focus, status, reduced-motion and mobile/desktop requirements frozen.
14. **Requirement IDs** — stable `DT-*` IDs adopted.
15. **Non-goals** — explicit V1 exclusion list adopted.
16. **State machines** — session/authority, upload/publication, playback, livestream, subscription, moderation/appeal and delete state machines frozen.
17. **Acceptance criteria** — requirement-level criteria plus consolidated acceptance matrix adopted.
18. **Authority compatibility** — product scope preserves every DOOBTUBE-0 no-shadow-authority/non-custody rule.

## Level 1 qualification

Qualified implementation SHA:

`a0da7e1d57e0f08fd58cecede2f1ee846e7d3895`

Workflow: **DoobTube baseline audit**
Run: **37558335660**
Job: **baseline / 112589653437**
Result: **PASS**

Exact-head checks passed:

- explicit PR-head checkout;
- exact implementation SHA assertion;
- DOOBTUBE-0 architecture invariants retained;
- DOOBTUBE-1 product document present and adopted;
- all original roadmap product categories represented;
- stable requirement-ID families present;
- V1 routes/surfaces section present;
- seven required workflow state machines present;
- explicit non-goal boundaries present;
- acceptance matrix present;
- `MediaAsset`, `Stream` and `Subscription` remain in canonical GEN-SVC object vocabulary;
- PUBLIC / UNLISTED / PRIVATE remain valid visibility vocabulary;
- required moderation vocabulary remains present;
- no new DoobTube/420Video Genesis service or frozen application entry;
- no premature DoobTube runtime/contract namespace;
- no false deployment/testnet/Genesis/production readiness claim.

## Diagnosed superseded failure

Earlier reconciled implementation SHA:

`7d49fc252228941b1b57a5f711e583b000d57757`

Workflow run: **37558268348**
Job: **112589441875**
Result: **FAIL**

Classification: **test-harness/documentation-verifier mismatch**.

The exact-SHA assertion passed. The verifier still required the old audit phrase `DOOBTUBE-0 is complete`, while the reconciled audit correctly stated `DOOBTUBE-0 and DOOBTUBE-1 are complete`.

No product, protocol, authority or runtime defect was found. The stale verifier needle was corrected and the new exact implementation SHA qualified successfully.

## Security/adversarial/invariant result

DOOBTUBE-1 introduces no runtime code, contract, custody or deployment surface.

Product-level negative invariants qualified include:

- public browsing does not require Wallet/Identity;
- mutations require the qualified authority boundary;
- Identity remains optional;
- local UI state cannot substitute for canonical Media state;
- upload transport acceptance is not canonical readiness;
- visibility cannot be widened by UI/index/cache behavior;
- subscriptions are not access entitlements;
- comments/reactions are not silently invented;
- creator monetization/custody is not silently invented;
- public publication remains Rights/provenance gated;
- moderation does not gain ownership/fund/protocol authority;
- deletion does not promise erasure beyond owning-service semantics;
- private keys/raw media do not become application/on-chain state.

No unresolved DOOBTUBE-1 product-scope contradiction remains.

## Milestone status

DOOBTUBE-1 is an **ordinary Level 1 roadmap step**.

No Level 2 milestone is triggered. The documented app integration milestone remains:

**DOOBTUBE-8 — Ecosystem integration milestone**

## Intentionally deferred Level 3 qualification

Per the phase qualification model, the following remain deferred until **DOOBTUBE-11 — Repository Level 3 exact-head closeout**:

- canonical full repository Solidity inventory;
- Genesis/address-authority qualification;
- 420 Integrated/global qualification;
- repository-wide Docs/global reconciliation;
- unrelated app audits;
- global fault/soak suites;
- final client/service/Indexer/Search/RPC/runtime integration inventory;
- final static/security/deployment/config/build/lint/type closeout.

These are not blockers for an ordinary documentation/product-definition Level 1 step.

## Limitations and blockers

No blocker remains for DOOBTUBE-1.

DoobTube still has no runtime implementation. The exact dependency graph, owning interfaces and degraded/failure semantics are intentionally deferred to DOOBTUBE-2.

## Evidence SHA rule

This document is a durable **evidence-only** update after the exact implementation SHA qualified.

It changes no executable code, tests, workflows, dependencies, configuration, generated/runtime artifacts, interfaces, deployment state or substantive product requirement. Therefore the qualified implementation SHA remains authoritative without recursive qualification.

## Next canonical roadmap step

**DOOBTUBE-2 — Dependency and trust-boundary freeze**

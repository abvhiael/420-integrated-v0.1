# COM-4 — Merchant storefront builder: qualification evidence

**Status: COMPLETE. Qualification: Level 1 PASS; merchant-builder Level 2 milestone PASS.**
Implementation SHA: `594bd4e1e1554a1b8e34445eefd506765ffd9594`.
Implementation tree: `9c2919f5657c3d7fe0c9d20896ec55402a4ff211`.
Current main/reconciliation base: `41d173dbcfbeb8299f54f22e7c049f1fec20336d`.
Audit branch: `audit/420commerce-com-2-upstream-adaptations`.
PR: [#594](https://github.com/abvhiael/420-integrated-v0.1/pull/594), open/draft/unmerged.
Main compare at qualification: ahead 7, behind 0, merge base equals current main;
PR mergeable. Evidence commit is the containing commit of this document, identifiable
with `git log -1 --format=%H -- docs/commerce/COM-4-QUALIFICATION-EVIDENCE.md`.
Its exact SHA is also recorded in PR metadata and the completion report. Evidence
HEAD changes only status/qualification documentation and inherits this implementation
SHA; no executable/test/workflow/dependency/config/artifact/interface/deployment or
substantive requirement change, so no recursive qualification is required.

## Canonical scope and repository reconciliation

Unchanged canonical step: **COM-4 Merchant storefront builder:** wallet-backed
onboarding, avatar/banner/theme, app-wide and merchant-controlled categories,
listings/variants, stock and preview/publish; UX/integration qualification.
Original architecture/security/adapter requirements and gap mapping are retained in
`COM-4-MERCHANT-STOREFRONT-BUILDER.md`; client/deployment handoff is in
`commerce/web/README.md`, API/migration handoff in `commerce/README.md`.

Started from qualified COM-3 evidence `c5fddf086e2f36bb84c98bed64b0e5ebbe975e2d`;
current main had advanced 335 Grow commits from the prior `0ec695481...` base.
Reconciliation merged without conflicts or Commerce authority/interface changes,
preserving valid COM-2/3 implementation. The final implementation is app-scoped
UI/API/SDK/SQLite/CI support. No Solidity source, Genesis/address namespace, frozen
map, Wallet catalog identity, custody or live deployment changed in COM-4.

Files changed for COM-4: new `commerce/web` static builder, core Wallet/builder
modules, build/lint/locked dependencies, unit/CI/browser fixtures and docs; new
SQLite `002-store-releases.sql`; service `authority.mjs`, `database.mjs`,
`http.mjs`, `service.mjs`, new/updated service/ABI/HTTP fixtures/tests; SDK
`commerce.ts` and Commerce SDK tests; builder fast workflow and corrected service
patch verification; `scripts/commerce/check-patch.mjs`; implementation and evidence
handoff docs. Detailed committed path list: `git diff --name-only
c5fddf086e2f36bb84c98bed64b0e5ebbe975e2d
594bd4e1e1554a1b8e34445eefd506765ffd9594 -- commerce packages/420-sdk
.github/workflows/commerce-builder.yml .github/workflows/commerce-service.yml
scripts/commerce/check-patch.mjs docs/commerce/COM-4*`.

## Required exact-SHA GitHub CI

Run metadata, exact checkout assertion, every job/step conclusion, and completed
logs were inspected. All five required runs and all their steps are SUCCESS on
`594bd4e1e1554a1b8e34445eefd506765ffd9594`; none is missing, skipped, cancelled
or inherited from a different executable SHA.

| Workflow/event | Run | Job | Result |
| --- | --- | --- | --- |
| Commerce service / push | [37959424173](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/37959424173) | 113918165441 | PASS |
| Commerce service / PR | [37959429065](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/37959429065) | 113918179598 | PASS |
| Merchant builder / push | [37959424229](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/37959424229) | 113918165404 | PASS |
| Merchant builder / PR | [37959428862](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/37959428862) | 113918180582 | PASS |
| Retained Commerce upstream / PR | [37959429112](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/37959429112) | 113918179858 | PASS |

Level 1/service milestone: **95 Commerce + 76 affected shared Indexer + 33 SDK**
tests PASS, zero failed/skipped/cancelled. Compile only eight consumed canonical
contract ABIs / 28-file import closure, production size assertions, SDK/Indexer
TypeScript builds, service syntax/lint, locked dependency audits and exact-base
patch check PASS. Indexer retained suites cover ABI manifest, projection/DTO/stream,
canonicality/delivery/lifecycle, API/HTTP/query/object and Commerce integration;
no new event ingester or service namespace was invented.

Builder Level 1: **21 unit/Wallet/patch-regression tests + 18 real browser
integration gates** PASS, zero failed/skipped/cancelled. Locked build/lint/security,
independent static SDK canonical ABI encoding and browser encoding, approved
configuration and same-origin API behavior, three accessible palette/font templates,
transaction review axe checks, focused errors, keyboard skip link and 320px layout
PASS. Production default output remains unconfigured/signing disabled; browser
fixtures build into isolated temporary output, never the deployment artifact.
Additional local checks on this exact implementation SHA reject missing/incorrect
approved manifest digest before build and preserve prior output. No audit advisories
remain in the locked builder/service/SDK/Indexer dependency checks.

Retained Level 2 Market/Pay: **57 tests across six suites PASS**, zero failed/skipped,
including **2,500 partial-refund conservation fuzz runs**; reporter, reservation,
lifecycle, atomic settlement/accounting and negative conditions retained. Targeted
upstream compile/production size checks and changed-adapter formatting PASS. This
is the app-focused merchant-builder integration boundary joining COM-2/3/4, not
repository-wide full Foundry qualification. Unique checks are 243 targeted
unit/browser gates plus 57 retained upstream tests; duplicate push/PR execution is
not counted as extra coverage.

Local commands: `PATH=<existing Foundry toolchain> FOUNDRY_PROFILE=pr python
scripts/commerce/qualify-service.py`; `npm run qualify --prefix commerce/web`
with available local Chromium; targeted `node --test` patch fixtures; exact-base
`node scripts/commerce/check-patch.mjs`; locked `npm audit`; manifest negative
build verification. CI uses Node 24, Python 3.12 for service and pinned Playwright
Chromium on Ubuntu, with exact checkout assertions. The restricted local CDN
browser download failed; local Chromium 143 qualified the same UI while required
CI installed Playwright Chromium 145 successfully. Neither local environment
failure nor a skip was represented as passing browser evidence.

## Every original COM-4 exit criterion

| Canonical requirement / architecture handoff | Individual qualification evidence | Result |
| --- | --- | --- |
| Wallet-backed onboarding and canonical merchant authority | Real signed HTTP controller resolution/resume; explicit Pay register review/cancel; approved chain/code/version/Registry, missing/bad configuration, spoof/other-controller/wrong-chain/account-reset tests; zero optional profile references | SATISFIED |
| Avatar/banner/theme and private media | Actual sanitized upload, shared safe avatar/banner reference, private/public media gating, tenant validation, three accessible palettes/fonts and description/SEO preview; retained decoder/MIME/metadata/bomb/security tests | SATISFIED |
| App-wide taxonomy and merchant categories | Read-only approved taxonomy + merchant links/order/hiding/bounded ancestry; version-pinned menu publication; draft menu does not leak; retained cross-tenant/global-authority tests | SATISFIED |
| Listings and explicit seller publication | Persisted product version/hash, actual compiled canonical create/revise ABI, independent SDK/Wallet re-encoding, named price/asset/quantity/policy/adapter/expiry review, fresh state/simulation, reject/cancel/broadcast-not-finalized/stale-version tests, seller/controller-only authorization | SATISFIED |
| Variants and stock | Persisted option/SKU editor, distinct canonical listing bindings and stock alias rejection; seller-bound finalized available/reserved/sold read; immutable quantity and attempted restock rejection; retained reservation/accounting/replay invariants | SATISFIED |
| Responsive preview/publish and rollback | Private mobile/tablet/desktop preview, explicit finalized product binding, atomic saved design/category version pins, draft/public release separation, restore previous branding to new draft, withdraw, schema-1 backfill/restart and conflicting-update rollback | SATISFIED |
| UX/security/integration/docs/evidence | Browser→SDK→signed API→SQLite, scoped editor sections/buttons, no UI-derived financial rights, cleared private options/form/blob/plan state on account changes, offline/unsaved/focused error/live status, malicious text, keyboard/mobile/axe, retained service/SDK/Indexer/Market/Pay and durable handoff | SATISFIED |

Security/negative boundary results explicitly cover wrong chain/account, contract
code/version/Registry mismatch, stale finality/deadline/revision/version, foreign
merchant/listing/media/category, scoped delegation/revocation/controller change,
expired/tampered plan and calldata/payout/controller, existing-identity replay,
double submit, simulation/rejection/cancellation, unknown fields/malformed config,
unsafe text/upload, draft data leakage, publication races, Market stock alias and
immutable quantity. No weakened assertions, protocol semantics change, broadened
authorization, custody, hidden signing, private keys, fake stock/paid state or
invented Wallet service ID was introduced.

## CI defect diagnosis, superseded and non-required records

Superseded implementation `17e80d93511adc1f9910664f07f3c0496d4dd9bb` passed all
implementation tests but service PR 37958894307/job 113916366949 and builder PR
37958894581/job 113916367378 failed only `git diff --check HEAD^ HEAD`. Failed
logs identify existing main Grow evidence line 3 trailing spaces. Root cause:
reconciliation merge compared against old audit first parent, incorrectly importing
unchanged main content into the app patch. Fix uses exact PR base / imported main
merge parent / ordinary commit parent, and regressions reject new app whitespace.
The final SHA reran all applicable required workflows; no deterministic failure
was rerun without diagnosis, and superseded passing substeps were not used as final
qualification. No main Grow document was edited to mask the defect.

Solidity Contracts run 37959429086: classify-pr SUCCESS; full Foundry,
level3/pr shards/fixtures and unrelated compute jobs SKIPPED by ordinary audit
policy. Genesis run 37959428757 and Docs run 37959429003 SKIPPED by retained
app-audit policy. These are deferred/not Level 1 passing evidence. Unrelated
unchanged `.github/workflows/governance-deployment-audit.yml` run 37959422299
failed during initialization with zero jobs, as already recorded in COM-2/3; no
application failure step/log exists to rerun. This remains a global phase-closeout
reconciliation item, not a COM-4 required check. Initial main reconciliation also
auto-triggered existing path-only Grow workflows; they were not manually invoked
or substituted as Commerce coverage. No repository-wide green claim is made.
Inherited upstream Foundry timestamp/typecast/discarded-return advisories remain
recorded upstream, not hidden; no Solidity was changed in this step. Actions
Node-20-to-24 runtime notices are runner warnings, not failed qualification.

## Milestone, deferred checks, blockers and next step

COM-4 Level 1 COMPLETE and app-focused merchant-builder Level 2 milestone COMPLETE.
No COM-4 implementation/qualification blocker remains. COM-5 has not been started.
PR remains draft/unmerged pending accumulated app-phase closeout.

Intentionally deferred Level 3: reconcile accumulated COM-2–7 with then-current
main; establish one exact merge candidate; canonical Solidity full inventory once,
separate Genesis/address/namespace/collision/predeploy/frozen/manifest authority
without duplicating Foundry, 420 Integrated/global, Docs/global, retained app suites,
affected clients/services/Indexer/Search/RPC/frontend/backend, complete security/
adversarial/invariant/static/deployment/config and roadmap/audit closeout. Keep
runner-aware approximately four balanced full Solidity shards and incremental
build/size reuse where safe at that phase. No full inventory was manually repeated
for this ordinary step; shared closeout evidence must refer to one implementation SHA.

COM-8/9 live/testnet/mainnet remain blocked: no approved deployed chain/Registry/
reporter/manifest/Cloudflare project or live tx evidence; no mock can clear those
criteria. Unsupported canonical Pay Swap quote remains unavailable, with no fake
fallback; public checkout belongs to COM-5. Independent COM-7 review and live
Wallet/screen-reader/testnet/deployment acceptance are still phase gates, not claims
made by automated local/CI fixtures.

Next canonical step: **COM-5 Public marketplace:** marketplace landing, merchant
pages, product detail, browse/search, single-merchant cart, $420 checkout, supported
swaps, receipts and accessible mobile design; Playwright and targeted integration gates.

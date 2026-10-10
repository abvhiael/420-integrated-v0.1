# COM-3 — Service + API qualification evidence

**Status: COMPLETE at Level 1 and retained Level 2 service integration milestone.**
**Canonical step:** COM-3 — Service + API — Backend services, inventory, APIs and SDKs.
Canonical definition and individual exit map: `COM-1-ARCHITECTURE-AND-ROADMAP.md`
and `COM-3-SERVICE-AND-API.md`. No COM-3 substeps are invented or renumbered.

| Provenance | Exact value |
| --- | --- |
| Qualified implementation SHA | `49c5875d35cd205a8c58634d7ecf1a4ba2ae99b1` |
| Implementation tree SHA | `6650ff3b2aea71515ba637b1ec1ffe900fd50034` |
| Current main / reconciliation base | `0ec695481fc84e6066aeae50baf6e0fd3c7f8731` |
| Implementation branch | `audit/420commerce-com-2-upstream-adaptations` |
| PR | [#594](https://github.com/abvhiael/420-integrated-v0.1/pull/594), OPEN DRAFT, unmerged, mergeable at verification |
| Divergence at qualification | ahead 4, behind 0; no conflict or dirty implementation files |
| Evidence commit / HEAD | Evidence-only commit containing this record; resolve its SHA with `git log -1 --format=%H -- docs/commerce/COM-3-QUALIFICATION-EVIDENCE.md`. Exact evidence SHA also recorded in PR #594 and completion report. |
| Superseded preliminary implementation | `d4d239a68d7921db97d2766119a64efe21113576`; successful earlier CI is historical, not a substitute for the final SHA |

The evidence-only commit changes this record, the original roadmap completion
ledger and the COM-3 completion statement only. It changes no executable source,
tests, dependencies, workflows, configuration, runtime/generated artifacts,
interfaces, deployment state or substantive requirements. Its `[skip ci]` marker
avoids recursive qualification; it inherits only the implementation above.

## Exact-SHA GitHub evidence

Run metadata, job steps and actual completed logs were inspected. All three
records below have `head_sha` equal to the final implementation, overall SUCCESS,
qualify job SUCCESS and every required step SUCCESS. No skip/cancellation/missing
job is substituted for required passing evidence.

| Workflow / event | Run | Job | Verified result |
| --- | --- | --- | --- |
| Commerce service fast qualification / push | [37895449006](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/37895449006) | `113705652053` | PASS: exact checkout/assertion; locked installs; three dependency audits; compile/ABI/sizes; lint/type; 185 tests; patch verification |
| Commerce service fast qualification / PR | [37895454434](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/37895454434) | `113705669517` | PASS: same exact SHA and all required gates |
| Commerce upstream contracts / PR | [37895454221](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/37895454221) | `113705668786` | PASS: 57 retained Market/Pay tests, six complete suites, production sizes and adapter formatting |

| Level 1 / retained Level 2 gate | Passing coverage |
| --- | --- |
| Commerce service tests | **77 PASS**, 0 failures, 0 skips, 0 cancellations |
| Affected Indexer regressions | **76 PASS**, 0 failures, 0 skips, 0 cancellations: ABI, Market keys/lifecycle, protocol decoding/DTO/projection, stream, canonicality/reorg, outbox/delivery, query/API/HTTP/object service |
| Retained 420SDK | **32 PASS**, 0 failures, 0 skips, 0 cancellations: existing Wallet/Stake/Compute SDK retained alongside new Commerce tests |
| Directly consumed contract compilation | Eight production contracts / complete **28-file** import closure, Solc 0.8.24; production runtime/initcode sizes enforced; no full repository Foundry inventory |
| ABI/interface compatibility | Every function binding in `commerce/src/authority.mjs` compared with fresh canonical compiled ABI, input and output types both checked |
| Static/build/type checks | Service syntax plus supported ESLint 10.12.0 PASS; strict SDK and shared Indexer TypeScript builds PASS; `git diff --check` PASS |
| Dependency security | Locked service, Indexer and SDK audit gates PASS, **0 vulnerabilities**; production ethers 6.17.0 and sharp 0.35.5 |
| Retained COM-2 protocol integration | **57 PASS**, 0 failures/skips: Market 8, Pay lifecycle 4, settlement/accounting 6, hardening 6, atomic settlement 4, reporter 29 (including 2,500 partial-refund fuzz runs) |

Local `FOUNDRY_PROFILE=pr python scripts/commerce/qualify-service.py` passed the
same final service/SDK/Indexer/ABI gates before publication. Connected GitHub
publication preserved the exact local tree; commit metadata produces a different
GitHub commit SHA, so CI evidence binds the actual published SHA, not the local
commit. No later implementation change is hidden under an evidence-only label.

## Implementation and individual canonical exit verification

| Original COM-3 requirement | Individual exit verification | State |
| --- | --- | --- |
| Merchant storefront persistence | Versioned stores/branding, global taxonomy vs tenant menus, products/variants; migration/FK/unique/transaction/restart tests; deterministic metadata publication | SATISFIED |
| Upload safety | Safe raster magic bytes before decoder; bounded size/dimensions/pixels/time/two concurrent decoders; PNG re-encoding strips metadata; no URL fetch/SVG/HTML/animated content; tenant quota/private preview/public-reference tests | SATISFIED |
| Catalogue projections | Existing shared Indexer stream and owning Market descriptors/keys; complete provenance, immutable payload hashes, atomic inbox/projection/checkpoint/outbox; duplicate/fork/finality/rebuild/100-sequence replay regressions | SATISFIED |
| Tenant ACL | Explicit Origin/chain/method/path/body/nonce signatures; EOA/EIP-1271; fresh finalized canonical controller/Registry/code/version/wiring; delegate expiry/revocation/least scope, no financial/admin/PII escalation | SATISFIED |
| Concurrency controls | Entity versions, uniqueness, serialized transactions, duplicate prepare race, literal underscore idempotency domains and per-customer/merchant/network scope | SATISFIED |
| Search | Parameterized, bounded, deterministic published-only browse/search/category/store/product; no SQL injection or PII; stale/halted provenance and no projected guaranteed stock | SATISFIED |
| APIs and SDK | Typed existing SDK extension; all merchant, media, draft preview, catalogue, cart, inventory, checkout-resume and delivery routes; real HTTP/SQLite SDK integration; verified canonical Market target before returning transaction intent | SATISFIED |
| Inventory and lifecycle boundaries | Fresh Market inventory snapshots; carts reserve nothing; canonical revision/policy/reporter checks; separate buyer order intents per listing; no payment before verified reservation; merchant-only invoice boundary; canonical paid/refund correlation and full/partial-refund negatives | SATISFIED |
| Data classification/privacy | AEAD delivery bound to order+store, current controller/buyer-only reads, private access audit, 30-day purge and tamper/tenant/key tests; no plaintext delivery in public search/media/event/log | SATISFIED |
| Failure/recovery/security/configuration | Canonical RPC chain/code/version/Registry/wiring/finality/staleness/deadline negatives; persisted halt/audit on unknown or mismatched ancestry; protected key/port/config; deterministic restart/rebuild; stable outbox retry/retraction; rate/body/concurrency/security headers | SATISFIED |
| Documentation/evidence/qualification | Original scope preserved, implementation/API/config/runbook documented, exact-SHA Level 1 and retained Level 2 milestone PASS; per-exit verification and next canonical step recorded | SATISFIED |

**Changed file groups:** `commerce/` service/schema/security/runtime/tests/docs/locked
dependencies; `packages/420-sdk/src/commerce.ts`, SDK export/tests/lock/ignore;
owning `420-indexer` ABI/lifecycle bindings, Commerce regressions/lock/ignore;
`scripts/commerce/qualify-service.py`; Commerce service fast workflow and upstream
workflow path specificity; Commerce architecture reconciliation and evidence docs.
There are 38 implementation file paths; source ownership and frozen Genesis/
address/namespace maps are unchanged. No new Solidity implementation is added in
COM-3. Existing COM-2 work and evidence are preserved.

## Milestone, scope policy, limitations and deferred gates

**Level 2:** COMPLETE for the app-focused Commerce service integration milestone
at the end of canonical COM-3. Actual durable SQLite+HTTP+SDK flows, canonical RPC
encoding/ABI checks, retained Market/Pay integration and affected shared Indexer
regressions converge on this exact SHA. This milestone neither renumbers the
roadmap nor claims live deployment or repository-wide qualification.

**Expected scope exclusions:** audit-branch policy intentionally skips broad
Genesis, Docs, Pay and Indexer PR jobs. Required affected Indexer/SDK checks run
explicitly in Commerce fast CI, with no skips. Solidity Contracts classification
does not run its full inventory for this ordinary audit step. None of these skips
is treated as a full-inventory PASS. Full canonical Solidity and separate Genesis
address-authority qualification remain required at the final closeout.

**Additional historical automatic Indexer run:** run `37894860025` at superseded
SHA `d4d239a...` passed 280 tests with **one PostgreSQL test skipped** because that
job did not configure a database. This is explicitly not PostgreSQL PASS and not
authoritative final-SHA required evidence. No PostgreSQL schema/store mutation is
part of COM-3; the affected typed surfaces and real Commerce SQLite persistence
are qualified above. Applicable database-backed retained/global Indexer evidence
remains a Level 3 closeout requirement.

**Unrelated workflow defect:** unchanged `.github/workflows/governance-deployment-audit.yml`
has a failed push record `37895447931` at the final SHA with **zero jobs** (also
observed on preceding implementations). There is no failed Commerce job/step to
rerun. This is a workflow initialization record, not a diagnosed protocol or test
failure; the connector exposes no deeper validation reason. It is outside this
step's changed/required scope. This record is not concealed and no repository-wide
green claim is made. Global closeout must reconcile applicable unresolved CI.

**Nonfatal inherited tooling advisories:** Foundry lint reports existing upstream
timestamp/typecast/unused-return advisories; source was unchanged and checks were
not disabled. Third-party action cleanup reports runtime-deprecation and a cache
reservation race; all required qualification steps still completed successfully.
These are not service test failures or skipped requirements.

**Intentionally deferred Level 3:** canonical full Solidity inventory once,
Genesis/address/namespace/collision/predeploy/frozen-manifest authority separately
without duplicate full Foundry inventory, 420 Integrated/global, Docs/global,
complete retained app/shared clients/services/Indexer/Search/RPC, adversarial/
invariant/static/security/deployment/config and accumulated roadmap reconciliation
against the exact final merge candidate. The four-shard canonical Solidity owner
and Genesis ownership policy are not modified here. No expensive full inventories
were manually repeated for COM-3.

**Current-step blockers: none.** External/live gates remain: approved deployed
COM-2 reporter and manifest, real chain/RPC/Registry/indexer bindings, server-owned
encryption secrets/private volume, compatible canonical Pay Swap quote source,
live integration transactions and external deployment/security review. Browser
storefront/payment UI and operational actions remain COM-4/5/6; load/soak,
external backup/deployment verification and accumulated Level 3 belong to COM-7;
live handoffs remain COM-8/9. Unsupported swap routes stay unavailable. COM-3
tests do not claim cloud production, real settlement, public shipping data,
horizontal SQLite writers or external exactly-once notification delivery.

**Next canonical step: COM-4 — Merchant storefront builder:** wallet-backed
onboarding, avatar/banner/theme, app-wide and merchant-controlled categories,
listings/variants, stock and preview/publish; UX/integration qualification.

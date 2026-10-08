# GROW-04 — UX implementation, scope and acceptance

**Canonical step:** GROW-04 — UX. **Qualification:** Level 1 app-only, with retained GROW-01–03 regression protection. This is not app-phase closeout or production deployment.

## Implementation surfaces

- `grow/web/index.html`: anonymous public discovery landing page, navigation, search/category filters, results, detail panel, branded disclosures and unsupported-actions guidance.
- `grow/web/app.js`: versioned `GET /v1/places` public read, strict response validation, business/farm filtering, load/empty/error handling, list/map modes, accessible labelled controls, source/Registry references without endorsement, exact-coordinate-only external routing.
- `grow/web/styles.css`, `favicon.svg`: responsive dark-green brand system, mobile layout, focus-visible treatment, skip link, low-motion handling and static visual identity.
- `grow/web/runtime-config.js`: disabled by default; no fictitious public listings or hard-coded endpoint. Explicit HTTPS public-source binding needed for external qualification.
- `grow/web/_headers`: security headers; restricted script/style/connection/permissions policy.
- `grow/web/package.json`, `scripts/build.mjs`, `test/ui.test.js`, `README.md`: dependency-free Node 22 build/test, documented setup and security/UX negative tests.

## Functional boundaries and acceptance

1. Anonymous visitor can access landing page, discovery section and explanatory content without Wallet.
2. Real data is fetched only from configured, enabled, accepted HTTPS 420Location `/v1/places`; unconfigured service reports unavailable without creating sample listings.
3. FARM/BUSINESS categories, textual query and zero-result view supported. Unknown categories, duplicate IDs, malformed coordinates, missing source, wrong version and suspicious API responses fail closed.
4. Details display stable ID, source reference, optional Registry reference, category, location precision and explicit not-independently-verified statement. Untrusted API strings use text nodes, not HTML injection.
5. Map mode is a **schematic coordinate plot**, not map-provider tiles or a geodetically accurate route. Area/approximate entries remain text only. External map handoff exists solely for validated public exact pin coordinates.
6. Responsive mobile/tablet/desktop layout, accessible navigation/labels, skip link, button-based controls, live status and visible keyboard focus are included. Real screen-reader/manual browser/device review is **deferred**, not falsely certified by static tests.
7. Claims/editing, custody, signing, transactions, new wallet or service-ID authority remain unsupported and absent.
8. No live deployment, DNS, testnet chain, runtime credentials or production source is asserted by a green build.

## Focused validation

`cd grow/web && npm run qualify`: Node syntax, 6 app regression tests covering API normalization, privacy, provenance, endpoint security, error and version failure, plus static build reproducibility. Retained app workflow also runs Go consumer and shared GEN-SVC-2/420Location tests and the GROW-01/GROW-02 verifiers. No global Solidity/Genesis/Docs qualification needed for this scoped UI milestone.

**Deployment qualification limitation:** Runtime config is disabled intentionally. Browser tests use controlled API fixtures and do not prove connection to real public testnet endpoints. Live accessibility/device testing and operational deployment checks belong to GROW-10; scalable pagination/service endpoints remain GROW-05/GROW-07.

**Next canonical roadmap step:** **GROW-05 — Service layer**.

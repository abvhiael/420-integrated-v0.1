# RR-2 — User-Facing News App qualification

## Step

**RR-2 — User-Facing News App**

## Status

**COMPLETE — Level 1 PASS**

RR-2 is complete at the repository/application layer. This does not claim RR-3 editorial workflow completion, production identity, production deployment, live testnet integration, Genesis readiness or production readiness.

## Qualification level

Level 1 — ordinary roadmap-step fast qualification.

The documented Level 2 milestone is the RR-2/RR-3 user-facing/editorial convergence, so Level 2 remains deferred until RR-3 is implemented. Level 3 remains deferred to RR-10.

## Exact implementation SHA

`37017d8157f180297b7771cea1d3c228cf527a30`

## Evidence commit

This qualification document and roadmap status update are evidence-only. They change no executable source, tests, workflows, dependencies, configuration, interfaces, runtime artifacts or deployment state, so they do not require recursive substantive qualification.

## Repository state at qualification

- Repository: `abvhiael/420-integrated-v0.1`
- Branch: `reefer-review-rr1-newsfeed-20261007`
- PR: #562
- Base/main SHA: `c8e8b58d818611276f7a9bb2b8d2241004450d97`
- Implementation head: `37017d8157f180297b7771cea1d3c228cf527a30`
- PR state at qualification: OPEN / MERGEABLE / UNMERGED

## Canonical requirement satisfied

The roadmap required:

> Persistent homepage newsfeed, Latest/Cannabis News/ReeferReview Originals/Topics/Search navigation, attribution/read-original handoff, filtering and responsive accessibility.

That requirement was expanded without renumbering into RR-2.A through RR-2.I in `RR-2-USER-FACING-NEWS-APP.md`.

## Requirements satisfied

### RR-2.A — Persistent homepage newsfeed
The default `#latest` route loads persisted external cannabis news from the RR-1 API and public ReeferReview Originals, combines them, sorts them by effective publication time and renders them as distinct content classes.

### RR-2.B — Canonical navigation
Primary navigation now exposes:
- Latest
- Cannabis News
- ReeferReview Originals
- Topics
- Search

Hash routes keep the app compatible with static hosting without requiring server-side SPA rewrites.

### RR-2.C — Attribution and read-original handoff
External-news cards display an explicit External news badge, publisher/source name, attribution text and a canonical **Read original** link. External links use `noopener noreferrer external` and strict-origin referrer policy. Third-party full article bodies are not rendered or imported.

ReeferReview-authored records are clearly labeled **ReeferReview Original**.

### RR-2.D — Filtering
Source and topic controls are populated from the RR-1 source/topic APIs and passed back to the persistent news API. Clear-filter behavior is implemented.

### RR-2.E — Pagination
Cannabis News consumes the RR-1 keyset cursor through **Load more news**. ReeferReview Originals retain publication cursor pagination through **Load more originals**.

### RR-2.F — Topics
The Topics view renders API-provided topics as accessible controls. Selecting a topic applies the filter and routes the user to Cannabis News.

### RR-2.G — Search
Search queries the RR-1 news `q` interface and searches public ReeferReview Original metadata returned by the publication API. Results preserve external/original labeling and provenance.

### RR-2.H — Responsive accessibility baseline
Implemented:
- skip link;
- semantic header/nav/main/section/footer landmarks;
- programmatic form labels;
- keyboard-visible focus;
- `aria-current` route state;
- live status/result regions;
- responsive desktop/tablet/mobile layouts;
- reduced-motion behavior;
- explicit badges so content origin is not communicated by color alone.

Formal browser E2E and full accessibility qualification remain RR-9.

### RR-2.I — Development authoring preservation
The pre-existing development draft form remains available under a clearly labeled **Development writer tools** disclosure. RR-2 does not represent it as production authentication or the final editorial dashboard.

## Implementation files

- `reefer-review/web/index.html`
- `reefer-review/web/styles.css`
- `reefer-review/web/app.js`
- `reefer-review/web/README.md`
- `docs/reefer-review/RR-2-USER-FACING-NEWS-APP.md`
- `scripts/verify-reefer-review-rr2.py`
- `.github/workflows/reefer-review-rr2.yml`

## Level 1 results

### Reefer Review RR-2
- Run: **37662891528**
- Job: `qualify`
- Result: **PASS**
- Exact implementation SHA: `37017d8157f180297b7771cea1d3c228cf527a30`

Passed:
- exact qualification-head assertion;
- Node.js JavaScript syntax check;
- RR-2 static frontend/accessibility verifier;
- retained ReeferReview backend and RR-1 Go regressions;
- retained ReeferReview audit verifier;
- retained RR-1 verifier.

### Reefer Review Audit
- Run: **37662891392**
- Job: `qualify`
- Result: **PASS**
- Exact implementation SHA: `37017d8157f180297b7771cea1d3c228cf527a30`

Passed:
- Go format;
- Go tests;
- static ReeferReview audit verifier;
- shared GEN-SVC validator.

The standalone RR-1 workflow was also triggered by broad existing path filters, but it is not required as separate RR-2 evidence because the exact-head RR-2 workflow already ran the retained RR-1 verifier and backend regressions. A queued/skipped/cancelled standalone RR-1 run is therefore not substituted for required RR-2 evidence.

## Security and boundary results

PASS:
- external content is rendered using DOM element creation and `textContent`, not feed-supplied `innerHTML`;
- only backend-validated canonical external URLs become Read original links;
- external and internally authored records remain visually and semantically distinct;
- filters and search values are encoded with `URLSearchParams`;
- external links use isolation attributes;
- the UI does not claim or render imported full third-party article bodies;
- no production authentication claim was introduced.

## Intentionally deferred

- RR-3 full article reader, authenticated writer dashboard, publish UI, revisions, tombstone lifecycle, restricted-audience reads, moderation dashboard/history and complete API/client parity;
- RR-4 production 420Identity/Wallet sessions and scoped capabilities;
- RR-6 live 420Search/Notifications/420Mail integration;
- RR-7 comprehensive production news-ingestion hardening;
- RR-8 background polling/source-health operations;
- RR-9 formal browser E2E, complete accessibility qualification and production deployment/observability;
- RR-10 Level 3 app-phase closeout;
- REEFER-AUDIT-7+ live testnet/Genesis/production gates.

## Limitations

The web app consumes same-origin `/v1/news...` and `/v1/publications...` endpoints. Static hosting alone is not a complete deployment until API routing is configured. The Originals view is metadata-only because the complete article-reader/editorial workflow belongs to RR-3. Formal browser automation and production deployment qualification belong to RR-9.

## Completion state

- RR-2 implementation: **COMPLETE**
- Level 1: **PASS**
- Level 2: **DEFERRED TO RR-2/RR-3 CONVERGENCE**
- Level 3: **DEFERRED TO RR-10**
- TESTNET READY: **NO**
- GENESIS READY: **NO**
- PRODUCTION READY: **NO**

## Next canonical roadmap step

**RR-3 — Editorial Publishing Completion**

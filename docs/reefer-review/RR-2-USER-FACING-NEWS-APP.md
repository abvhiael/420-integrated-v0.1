# RR-2 — User-Facing News App

## Canonical purpose

RR-2 implements the canonical roadmap requirement:

> Persistent homepage newsfeed, Latest/Cannabis News/ReeferReview Originals/Topics/Search navigation, attribution/read-original handoff, filtering and responsive accessibility.

RR-2 consumes the persistent RR-1 news API. It does not change the authority boundary between external news and ReeferReview-authored Publications.

## Requirements

### RR-2.A — Persistent homepage newsfeed
The default `#latest` view loads persistent RR-1 news plus public ReeferReview Originals and orders the combined set by effective publication time.

### RR-2.B — Canonical navigation
Primary browser navigation exposes exactly the required surfaces:
- Latest
- Cannabis News
- ReeferReview Originals
- Topics
- Search

Navigation is hash-based so static hosting does not require server-side route rewriting.

### RR-2.C — Attribution and source handoff
External-news cards:
- carry an explicit **External news** label;
- display source name;
- display source attribution text;
- link to `canonical_url` using **Read original**;
- open external links in a new tab with `noopener noreferrer external`;
- never render imported full article bodies.

ReeferReview-authored records carry a distinct **ReeferReview Original** label.

### RR-2.D — Filtering
The news surface supports source and topic filters from `/v1/news/sources` and `/v1/news/topics`. Filter values are passed to the RR-1 API. Filters are also respected by Latest and Search for external news.

### RR-2.E — Pagination
Cannabis News uses the RR-1 keyset cursor through a **Load more news** control. ReeferReview Originals retain the existing publication cursor through **Load more originals**.

### RR-2.F — Topics
The Topics view renders API-provided topics as controls that apply the selected topic and route the reader to Cannabis News.

### RR-2.G — Search
Search queries the RR-1 `q` parameter for external news and searches the currently available public original metadata returned by the publication API. Results preserve the external/original distinction.

### RR-2.H — Responsive accessibility baseline
The app includes semantic landmarks, skip navigation, labels, live regions, keyboard focus styles, current-route state, responsive breakpoints and reduced-motion behavior.

Formal browser E2E and full accessibility qualification remain RR-9.

### RR-2.I — Development authoring preservation
The existing repository-stage draft form remains available under a clearly marked **Development writer tools** disclosure. RR-2 does not falsely present it as a production-authenticated writer experience; that remains RR-3/RR-4 work.

## Files

- `reefer-review/web/index.html`
- `reefer-review/web/styles.css`
- `reefer-review/web/app.js`
- `reefer-review/web/README.md`
- `scripts/verify-reefer-review-rr2.py`
- `.github/workflows/reefer-review-rr2.yml`

## Exit criteria

RR-2 is complete when:
1. RR-2.A through RR-2.I are implemented;
2. the exact implementation SHA passes the RR-2 app-scoped Level 1 workflow;
3. retained ReeferReview backend/news regressions remain green;
4. durable qualification evidence is committed;
5. no RR-3+ or live/testnet behavior is claimed as complete.

## Milestone relationship

RR-2 alone does not trigger Level 2. The documented app-integration milestone remains the RR-2/RR-3 user-facing/editorial convergence after RR-3 is implemented.

## Next canonical step

**RR-3 — Editorial Publishing Completion**

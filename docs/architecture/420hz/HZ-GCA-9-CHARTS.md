# HZ-GCA-9 — Charts, discovery and anti-gaming

Status: **IMPLEMENTED — exact-SHA Level 1 CI pending**.

Canonical roadmap: `docs/420HZ-GENERATE-COMMUNITY-AWARDS-ROADMAP.md`, HZ-GCA-9.
Controlling policy: `hz/config/gca-charts-v1.json` and `docs/architecture/420hz/HZ-GCA-1.11-CHARTS-RULES.md`.

Implementation: `hz/generate/src/charts.js`; tests: `hz/generate/test/charts.test.js`.

The runtime-local rebuildable projection provides TOP_RECORDINGS, TRENDING_RECORDINGS, NEW_RECORDINGS, TOP_ARTISTS, COMMUNITY_FAVORITES; DAILY/WEEKLY/MONTHLY fixed windows; public metadata discovery by genre/mood/category/disclosure; deterministic scoring, sort/tie rules, stable event replay keys, per-listener-window deduplication, source eligibility checks, explicit checkpoint/finality/readiness, immutable result commitments and correction supersession.

A qualified play requires a trusted external qualification adapter. RAW_PLAY, award votes, shares, Search clicks, generation events and private favorites never score. V1 preserves source-defined weights (one qualified-play point plus one distinct-listener bonus per eligible distinct contributor; all community weights zero). No fabricated listening duration or production qualified-play feed is asserted. COMMUNITY_FAVORITES cannot claim popularity authority until a qualified PUBLIC-favorite input methodology becomes available; v1 score remains zero.

No API deployment, public service store, independently validated playback evidence, persistent indexer materialization, authenticated transport, anti-Sybil oracle, production rate limiting or production chart feed is claimed. Production would require a durable event journal, trusted playback source, privacy-preserving listener token issuer, checkpoint authority, deterministic rebuild orchestration and atomic immutable snapshot store.

Targeted CI: `.github/workflows/420hz-gca-9.yml`. The retained generation tests and frozen chart-policy verifier are Level 1; Level 2 app milestone and global Level 3 are deferred unless other documented gates become applicable.

Next: **HZ-GCA-10 — Awards domain model** (subject to canonical roadmap verification).

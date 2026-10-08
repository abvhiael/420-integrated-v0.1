# RR-11 — Standalone RSS news aggregation implementation and qualification

Status: **COMPLETE — repository Level 1 + Level 2 qualified on implementation SHA `93f4bd0b547ab1b72e584968b1f800ba886255f6`; live operation and release gates remain unverified.** Durable evidence: [`RR-11-QUALIFICATION.md`](./RR-11-QUALIFICATION.md). New additive post-RR-10 app-scoped phase. No change to Genesis, Solidity contracts, network addresses or completed RR-10 evidence.

## Implemented
- Retain RR-1 persistent external news store, RSS/Atom parser, deduplication, canonical article links and publisher attribution; RR-7 secure SSRF-blocking fetcher and RR-8 conditional GET, per-source scheduled polling, retries/backoff/circuit health/checkpoint persistence.
- Curated source registry: Marijuana Moment (active), StratCann (active), MJBizDaily (active), Green Market Report (disabled pending live endpoint/rights confirmation). Publisher-provided excerpts/images disabled for newly added sources; link out to originals. Publishing permissions remain under the publisher's policies and any required commercial approvals.
- Eight sections in news UI: Latest News, Canada, Legalization & Policy, Medical & Research, Cultivation, Business & Markets, Culture, International. Source-category topic tags feed existing public topic filtering; empty sections remain genuinely empty, not fabricated.
- Moderator-authenticated source admin UI and persistent API for add/edit/enable/disable with validation, size limits, atomic fsync+rename, SSRF rejection, per-source category and cadence, audit event logs, no localStorage credential persistence.
- Separate **news-only HTTP runtime** with public `/readyz`, `/v1/news`, `/v1/news/sources`, `/v1/news/topics`, `/v1/news/{id}` and protected `/v1/admin/news/sources`; intentionally has **no** editorial/Wallet/chain-facing APIs. Scoped `REEFER_REVIEW_NEWS_ADMIN_KEY` (minimum 32 characters) is optional; without it admin writes fail closed. The existing editorial app production adapter checks are unchanged.

## Independent deployment

Use existing Go binaries; this does not require an operating EVM/testnet.

```bash
# Production process supervisor supplies persistent paths, safe file permissions, and secrets.
export REEFER_REVIEW_DEPLOYMENT_MODE=news-only
export REEFER_REVIEW_LISTEN_ADDR=127.0.0.1:8096
export REEFER_REVIEW_NEWS_DB=/var/lib/reefer-review/news.json
export REEFER_REVIEW_NEWS_SOURCES=/var/lib/reefer-review/news-sources.json
export REEFER_REVIEW_NEWS_ADMIN_KEY='<inject long random secret from secret manager>'
go run ./cmd/reefer-review
```

`/var/lib/reefer-review/news-sources.json` must start as a copy of the checked-in curated config and remain writable by **one** owner instance; the admin source registry is not safe for multi-writer distributed deployment. Persist RSS news, registry and checkpoint on durable, backup-protected storage. Do not put the admin key in public frontend build assets or repository files. The browser requests it interactively and keeps it in memory, with no localStorage/sessionStorage.

Run the separate feed polling process with the **same durable source registry and news DB**, and a persistent checkpoint path:

```bash
export REEFER_REVIEW_FEED_MODE=poll
export REEFER_REVIEW_FEED_CHECKPOINT=/var/lib/reefer-review/feed-operations.json
go run ./cmd/reefer-news-sync
```

Reverse proxy `https://reeferreview.420integrated.org/v1/news*`, `/v1/admin/news/sources` and `/readyz` to the news-only backend while retaining the static `reefer-review/web/` site. Apply TLS, strict egress/SSRF/DNS protections, admin key rotation, per-route abuse controls, runtime event/health monitoring and persistent backups. In news-only mode the existing full editor/moderation/Wallet routes are **not** available; a later full-adapter environment is required for them. Cloudflare Pages static hosting by itself does not execute the Go backend or scheduled ingestion; a real backend host/supervisor and reverse proxy are necessary.

## Qualification policy
- **Level 1:** app-scoped Go build, unit, authorization, SSRF/redirect, dedupe, persisted registry and scheduler tests, browser JavaScript syntax and frontend verifier, plus active ReeferReview fast workflows, on one exact implementation SHA. Do not claim an untriggered check as passing.
- **Level 2:** retained ReeferReview integration suite when admin, news scheduler and public frontend converge (this is a meaningful app milestone).
- **Level 3:** defer expensive global Solidity, Genesis, Geth, 420 Integrated and repo Docs full qualification until the current complete app phase is ready for closeout. No on-chain changes are made in RR-11.
- **Live deployment gates still open:** no deployment or published source freshness is attested here. Verify all four feed endpoints before full activation (Green Market Report disabled); RSS reuse rights, Cloudflare same-origin reverse proxy to actual Go backend, health/feed freshness and monitored admin activity, deployed browser E2E/a11y and service resilience before advertising site READY. RR-9 and REEFER-AUDIT-7–10 remain distinct.

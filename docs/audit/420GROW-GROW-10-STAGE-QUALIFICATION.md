# GROW-10 — Deployment and stage qualification

**Canonical step:** GROW-10 — Deployment and stage qualification. **Decision:** stage preparation is qualified separately from live release. **Live stage qualification is BLOCKED**, not COMPLETE, until immutable deployed artifacts, real public 420Location source, operator evidence and live acceptance exist. This document does not declare a deployment or authorize a Genesis catalog addition.

## Release class and authority

420Grow remains **CONSUMER_ONLY / NO_NEW_PROTOCOL_SERVICE_ID**, an anonymous read-only public FARM/BUSINESS directory. It has no Grow contract, token, settlement, chain address, privileged signing key, Registry registration or Wallet verified service manifest. Thus the application can be published as a non-canonical public static website **only** after its HTTPS data origin and actual browser/deployment security gates are qualified. Its optional read-only Go service is a separate deployment unit; the frontend currently calls GEN-SVC-2 `/v1/places` directly, **not** `/v1/grow/places`. Do not misconfigure routing to interchange their API envelopes.

## Independent release gates (as of 2026-10-08)

| Gate | Evidence / disposition |
|---|---|
| CODE | PASS — GROW-01–09 scoped implementation SHA evidence retained in canonical audit |
| BUILD | PASS — GROW-08 clean checkout and web/Go builds passed; no deployed artifact checksum yet |
| CONTRACT | NOT APPLICABLE — no approved Grow-owned contract under GROW-06 |
| TEST | PASS — GROW-08 race, negative, SDK and web checks; GROW-10 stage-control check required |
| DOCUMENTATION | PASS — GROW-09 exact-head qualification |
| INTEGRATION | PASS **local only** — GROW-07 SDK/service/browser static tests; live cross-domain interface remains BLOCKED |
| SECURITY | PASS **repository checks only** — private coordinate, source and browser guards; live TLS, gateway controls and manual security validation BLOCKED |
| TESTNET | NOT QUALIFIED — no verifiable Grow testnet deployment/source/acceptance evidence |
| GENESIS | NOT APPLICABLE as independent Grow admission; canonical Genesis/application catalog remains frozen, no contract deployment |
| PRODUCTION | NOT QUALIFIED — missing public URL, verified deployed artifact, live connectivity, monitoring and rollback exercise |

Statuses are scope-specific; a static no-contract decision cannot be called a PASS for production or deployed integration. GROW-10 as a **whole remains BLOCKED** until live stage qualification is demonstrated. CI passing this document's guard is a *preflight PASS*, not an excuse to mark GROW-10 COMPLETE.

## Environment-specific deployment prerequisites

1. Identify approved public HTTPS `420Location` origin with exact hostname, certificate validity, accessibility, CORS (if cross-origin), source operator approval and public visibility/privacy classification. `GET /v1/places` must return the v1 public schema. Do not use non-public provider keys in browser config.
2. Select public site hostname, deployment target, Git SHA and immutable compiled `grow/web/dist` artifact checksum. Keep `grow/web/runtime-config.js` with `enabled:false` until actual source approval and protected stage qualification. Publish only HTTPS static assets with enforced `grow/web/_headers` CSP/anti-framing, no geolocation permission and proper MIME types. Do not claim the site is live from a successful build.
3. If standalone Grow API is required, deploy `grow/cmd/server` from the same approved source SHA with `GROW_LOCATION_BASE_URL` set only to a clean HTTPS public GEN-SVC-2 origin; default local bind `127.0.0.1:8080`. Explicitly provision reverse proxy/TLS, gateway rate limiting, egress restrictions, logs and health checks before exposing a non-loopback listener. Ensure `GET /v1/grow/places` has correct envelope, bounded pagination and no write methods.
4. Record immutable deployment digest, environment, release owner, approval, source host, output URLs, artifact SHA, build command, CI run, TLS/CSP/CORS observations, UTC deployment time and rollback target **from observed facts**. Do not guess any value.
5. Test live end-to-end: connected source with genuinely public FARM/BUSINESS records, legitimate empty response, upstream refusal/outage and version mismatch, malformed/privacy-escalating record, no source credentials, exact vs approximate location, provenance/Registry non-endorsement, 405 writes and API boundaries, keyboard/mobile/screen reader, correct absence of Wallet sign/send/claims and no wrong-network verification.
6. Operator handoff: ensure on-call owner, access scope, secret rotation, privacy incident escalation, error/latency/availability alerts, safe logs, roll-forward and exercised rollback, immutable prior build digest. Record failure evidence as failed rather than bypassing checks.

## Stage evidence ledger (pending actual measurements)

| Field | Required observation |
|---|---|
| Stage and URL | Not supplied — BLOCKED |
| Deployment owner / change approval | Not supplied — BLOCKED |
| Approved public 420Location API URL + provenance | Not supplied — BLOCKED |
| Deployment artifact SHA-256 / binary version | Not supplied — BLOCKED |
| Deployment UTC date, source SHA and CI result | Not supplied — BLOCKED |
| TLS, CSP, permissions, headers and CORS verification | Not run against live site — BLOCKED |
| Public/privacy + failure-path live results | Not run against live endpoint — BLOCKED |
| Mobile, desktop, keyboard and assistive technology acceptance | Not witnessed — BLOCKED |
| Monitoring/alerts, secret/admin handover | Not demonstrated — BLOCKED |
| Rollback target + observed rollback exercise | Not demonstrated — BLOCKED |
| Grow chain ID / deployed contracts / addresses | Not applicable (none authorized) |
| Genesis protocol service ID / Wallet launch identity | Not applicable (none authorized) |

**Blocking external dependency:** a real approved public GEN-SVC-2 endpoint and an authorized deployment environment, with attributable live acceptance and operational evidence. Never fabricate these. Without them, GROW-10 cannot reach stage COMPLETE, and the end-of-phase comprehensive Level 3 / monolithic merge remains unqualified.

## Scope and next actions

Run `scripts/verify-grow-10.py` only as an **app-scoped readiness preflight**, bundled into `.github/workflows/420grow-fast.yml`. It checks no premature source enablement, no unapproved Genesis or contract identity, and this accurate pending release ledger. After preflight succeeds, finish live deployment/acceptance, then reconcile cumulative PR #567 to latest main and qualify the exact Level-3 merge candidate once with canonical Solidity Contracts full-inventory (no duplicate Genesis Foundry), separate Genesis address-authority, 420 Integrated global, Docs global, affected Go/JS and required deployment/security jobs. No merger or production claims until gates pass.

**Next canonical boundary:** GROW-10 live deployment/stage evidence and full app-phase Level-3 closeout (not a newly numbered roadmap step).

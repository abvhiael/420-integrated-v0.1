# Bong Goggles BG-19.15 — Deployment candidate and closeout

**Decision: NOT LAUNCH-READY. DO NOT MERGE OR ENABLE PUBLIC PRODUCTION TRAFFIC.** The BG-19.14 audit found that `bong-goggles/web/app.js` does not bind the majority of profile/feed/community/messaging/discovery/game/notification/reward/safety projections to browser-facing canonical HTTP controllers or qualified transaction transports. A green static build or synthetic unit test is not a substitute for the 14 end-to-end journeys listed in `docs/BONG-GOGGLES-BG-19.md`.

## What this increment actually provides

- `bong-goggles/web/core/deployment-readiness.js`: explicit target/config validation and an evidence inventory; evidence entries are operator attestations, not independent verification.
- `bong-goggles/web/scripts/package-deployment.mjs`: packages an **offline deployment candidate** only after `npm run build`, using an externally provided runtime config and an explicit matching target; refuses `.example` and local hosts, URL credentials/queries, feature-flag values other than booleans, and non-maintenance production input. It copies only allowlisted public runtime fields to `dist-deployment/runtime-config.json`. It emits `deployment-manifest.json` with SHA-256 hashes. Neither output is a production release authorization.
- `bong-goggles/web/_headers`: conservative static-host header template. Its blanket `noindex` and `no-store` defaults are intentional while public-page cache/indexing policies remain unqualified; deployers must verify their host actually sends these headers. HTML meta CSP does not provide effective `frame-ancestors` enforcement by itself.

## Offline candidate commands

1. Run `cd bong-goggles/web && npm run qualify` on the exact PR head. Ordinary `dist/` uses `runtime-config.example.json` and **must not be deployed as a real environment**.
2. Obtain a reviewed **public-only** `runtime-config.json` for the intended testnet, staging or production environment from the authorized deployment owner. No token, password, secret, signer, private Messenger payload, signed media URL, or private key may appear in any browser-readable file. Verify real and reachable service origins and the correct chain ID/Wallet/Explorer before packaging.
3. Set `BG_WEB_RUNTIME_CONFIG=/absolute/path/to/reviewed-config.json` and `BG_WEB_DEPLOY_TARGET=staging` (or the deliberately selected target), then run `npm run package:deployment`. Do not commit real environment config to source control. A production candidate must have `maintenance:true`.
4. Review `dist-deployment/` including its public config, `_headers`, HTML, scripts, and `deployment-manifest.json`. Check hashes and host compatibility. The packager makes no network calls and does not upload, deploy, configure DNS or verify TLS.

## Deployment / smoke checklist — unverified, requires operator evidence

- Deploy a **maintenance-gated** build first to the authorized testnet hostname, then staging; verify DNS, certificate chain, CDN/static-host response behavior, deep-link reload behavior, maintenance routing, HTTP security headers, `noindex` on private content, and `no-store` on runtime config. Host-specific SPA rewrites must not invent public 200 pages for missing, withdrawn or private canonical objects.
- Verify each of the 14 BG-19.14 journeys with real services and separate test accounts. Include wrong network, blocked/muted relationships, session expiry/revocation, private Messenger encryption boundaries, pending/rejected/reverted transaction recovery, media authorization and zero-wager game rules. Record a dated evidence URL and actual expected vs observed result for each.
- Test performance and accessibility on phone, tablet and desktop in supported browsers; perform keyboard and screen-reader passes, security-header and privacy reviews, cache/telemetry checks, and production-domain checks. No Lighthouse or live-browser result was produced by this commit.
- Configure production monitoring: minimum synthetic bootstrap/readiness probe, independent error-rate and asset/config fetch alerts, privacy-redacted telemetry, and documented on-call escalation. Alert thresholds must be agreed with operations using real baseline measurements; none are fabricated here.
- Compare/reconcile PR #350 against current `main`. Re-run exact-head Web Verification, docs, integrated, relevant Bong Goggles and contracts checks after any changes. Require the deployment owner and security reviewer to approve the release evidence before a merge or public enablement.

## Rollback procedure — requires a tested host-specific implementation

Keep the previous qualified content-addressed artifact, reviewed config, CDN routing version and manifest. On a regression, switch the deployment target back to that artifact with `maintenance:true` if session, privacy, messaging, rewards or financial authority is in doubt. Invalidate only affected public static assets; always bypass caching of `runtime-config.json` and authenticated/private routes. Verify header policy, bootstrap, read-only behavior and canonical-data integrity after rollback. Do not roll back or replay canonical chain state from browser artifacts. Document the exact host commands and rehearse rollback on staging before any production traffic.

## Outstanding release blockers

Live browser-facing projection controllers; qualified service auth/transport, deployment addresses and ABI bindings; Wallet-confirmed writes and refreshed canonical outcomes; end-to-end media/Messenger/game/reward/moderation journeys; public canonical page rendering with appropriate HTTP 404/410 behavior and legal URLs; runtime Wallet return-URL/security hardening; real browser/a11y/performance and privacy verification; testnet and staging deployment evidence; DNS/TLS/CDN/header verification; monitoring/rollback drill; branch reconciliation and full exact-head qualification. Until resolved, BG-19.15 is **deployment-packaging work only**, not BG-19 closeout, not BG-20 handoff, and not a merge authorization.

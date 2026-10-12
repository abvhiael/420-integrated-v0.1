# DOOBr R03.9 — Offline queue/reconnect, token/device revocation and location permission failure

**Original canonical step:** R03.9. **Status: PARTIAL until exact-SHA Level 1 passes and full native lifecycle integration exists.** PR #601 on `roadmap/doobr-bc-vancouver-infrastructure`. Inspected `main`: `fe21ef07359d6915bf5daac37c4bf24a24fcf19b`. R03.12 = client/Travel Level 2; R05.10 = final Level 3.

## Implemented locally
- `doobr/mobile_offline.py` volatile bounded queue: maximum 32 items, expiry five minutes, UUID idempotency keys, tenant/device binding, allowlist of only `REFRESH_STATUS` and `ACK_OPAQUE_NOTIFICATION`. Never queue GPS fixes, addresses, payments, state-changing delivery, custody or other regulated commands.
- `reconnect()` requires a fresh independently verified issuer/device decision and clears the entire buffer on expired entries, invalid proof, outage or other error. It returns records to a future separately authenticated dispatch rather than auto-sending. This is fail closed and prevents replay through the module; actual HTTP server idempotency is not qualified.
- `revoke()` and `location_permission_failed()` clear buffer and inhibit subsequent enqueue/replay. Native iOS/Android permission denial/route stop controls were introduced in R03.8 and remain non-operational.
- `doobr/storage/tests/test_mobile_offline.py` checks duplicates, prohibited commands, capacity, stale/future timestamps, revoked sessions, missing external issuer and lost location permission.
- `.github/workflows/doobr-r03-9-level1.yml` exercises R03.9 plus directly affected mobile permission/push regressions on exact SHA, not global Foundry or Docs.

## Still outstanding
This is a Python boundary contract, **not** a durable encrypted offline native queue deployed on an iOS or Android phone, not a native push receiver, and not an authenticated replay HTTP endpoint. No native client has an authorized live assignment or independently provisioned server session. Completing native UI/storage integration, encrypted persistence where authorized, secure push/session revocation propagation, retries with server deduplication and OS interruption testing is repository-side work and must not be hidden in the testnet roadmap.

External live acceptance with signed 420Identity/device/420Notifications, real APNs/FCM and device hardware, GPS revocation during active dispatch, offline-to-online network cuts and authoritative server replay are separate testnet/provider/device gates; cannot be certified using fixtures. Regulated workflows remain disabled.

**Next canonical step after R03.9 completion:** R03.10 — 420Travel read-only coarse presence card and deep link, hard-failed checkout.

## Authenticated HTTP replay integration
- `doobr/mobile_replay_http.py` defines an actual private WSGI HTTP application exposing only `POST /private/v1/mobile/replay` and parsing bounded JSON; tenant/device/bearer/CSRF/origin/device trust comes exclusively from an injected server-side trusted transport verifier, never the JSON body.
- `doobr/mobile_replay_api.py` revalidates canonical identity and device scope on each replay, filters the strict two-command allowlist, and records accepted command IDs using the transactional ledger. It cannot execute courier tracking, payments, custody or deliveries.
- `doobr/mobile_replay_storage.py` and migration `0008_mobile_replay.sql` add tenant-RLS PostgreSQL receipts with unique (tenant,device,command) deduplication. Replay of a committed request is a no-op even across process instances.
- `test_mobile_replay_api.py` covers duplicate receipts, revoked identity, untrusted transport, sensitive command denial, stale items and unknown fields. Exact-SHA targeted workflow also checks existing mobile permission, push and queue regressions.
- **Not yet deployed/externally accepted:** approved private TLS ingress and connected real 420Identity/device issuer, controlled production-equivalent migration chain, trusted request attestation implementation and real device HTTP client integration. Unit-tested WSGI application with injected trust boundary does not assert operational production readiness.

## Private HTTP staging preparation and independent identity contract
- `doobr/mobile_staging_identity.py` implements fail-closed claims-level integration requiring independent cryptographically verified JWT source, exact issuer/audience, tenant/device/sub/jti/scope, and live device binding and revocation. The verifier MUST enforce signature/JWKS pinned issuer algorithms, expiry/not-before and key rotation; this contract does not itself perform JWT signature verification.
- `doobr/mobile_staging_ingress.py` adds a server-only trusted connection adapter and bounded per tenant/device admission rate limiter. This is not TLS termination, mTLS verification or an exposed HTTP server. These must be supplied by approved ingress outside the WSGI process, rejecting spoofed headers.
- `doobr/storage/tests/test_mobile_staging.py` checks issuer/audience contract, revoked identity, mismatched scope/device, fail-closed verification and rate limits. R03.9 Level 1 includes it.
- **Deployment NOT PERFORMED:** no approved private staging hostname, independent credentials, managed PostgreSQL service, production-equivalent migrator role, signed proxy trust metadata, backup/restore target or operational authorization was established. Do not create a public Render endpoint as a substitute for private authenticated ingress. Provision, validate and exercise rollback/restart/recovery only after those inputs are explicitly available; no secret is committed.
- Physical-device reconnect acceptance remains postponed to the DOOBr deferred qualification roadmap. Operational cannabis transactions remain disabled.

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

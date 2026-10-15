# LIFTd — Testnet & Deployed Acceptance Roadmap

**Authority:** LIFTd canonical [development roadmap](LIFTD-ROADMAP.md), [production acceptance register](L02-PRODUCTION-ACCEPTANCE-REGISTER.md), and independently owned Identity, Registry, transport, private vault, Messaging and accessibility authority.  
**State:** Planned / BLOCKED on deployed external owners. No gate is PASSED.  
**Scope boundary:** This is an execution queue for previously deferred live/deployed validation, not a replacement or renumbering of L01/L02 implementation steps or Level 3. A real transport licence/insurance approval belongs to authorized regulators and businesses; a testnet can verify technical enforcement but cannot confer legal approval.

## Readiness gates: pre-testnet repository work versus actual deployed testing

| Track | Before live testnet: implement/verify in repository | On isolated/deployed testnet: mandatory live acceptance | Independent final signoff |
| --- | --- | --- | --- |
| **LIFTd-TN-ID** Identity | Canonical trust config and secure injection, exact issuer/audience/key separation, session/recovery/revocation/role/account negative tests; no stub/demo bypass | Deploy distinct Identity + session authorities and LIFTd consumer; capture real issuer keys/fingerprints and immutable digests, expired/recovered/revoked/device and rotation/outage tests across instances | Identity owner + security reviewer |
| **LIFTd-TN-ELIG** Transport eligibility | Bind L01 eligibility to signed independent driver, vehicle and Vancouver transport proofs, expiry/revocation and capacity tests; fail-closed public availability | Deploy approved **nonproduction** Registry/transport proof issuers; demonstrate revoke/suspend -> immediate assign/arrive/start denials, stale proofs, cross-jurisdiction, driver/vehicle mismatch, outage/recovery | Registry and Compliance owners; real-world passenger-transport regulatory/insurance approval separate |
| **LIFTd-TN-VAULT** Private documents | Segregated encrypted vault protocol with receipt signature/content digest/driver-account-vehicle-type binding, expiry/revoke, role/audit/retention controls; migration and private-response tests | Deploy isolated real vault and private upload service, perform malware/type/size/outage/rotation/backup-restore/cross-account/forged receipt tests, reviewer-remediation lifecycle, verify no secrets in public logs/Indexer | Vault/privacy/security owner + independent authorized reviewer |
| **LIFTd-TN-MSG** Scoped contact | Implement explicit server-minted short-lived participant-trip entitlement through canonical Messaging owner, revocation on reassignment/terminality; negative suite, safety/moderation contracts; keep UI disabled until admitted | Deploy actual encrypted transport, prove assigned-only delivery, cross-trip/cross-participant/revoked/suspended denial, receipt/lifecycle/retention/abuse behavior, outage fail-closed | Messaging, Identity, safety/privacy owners |
| **LIFTd-TN-A11Y** Accessibility | Automated axe/static checks and keyboard/error/semantic/form/focus regressions; fix discovered blockers; no untested claims | Run independent Windows/browser keyboard+screen-reader and iOS/Android touch/screen-reader/zoom/reflow/reduced-motion tests against deployed protected workflows, including consent, safety and permission-denied paths | Independent accessibility reviewer with WCAG 2.2 AA report |

## Operational sequence and hard dependencies

1. **TN-0 — Freeze acceptance candidate and owners.** Record exact runtime SHA, config digest, domain/origin, isolated testnet network ID, independently controlled issuer endpoints and authorized reviewer identities. No operational live traffic.
2. **TN-1 — Provision segregated testnet.** Deploy LIFTd backend/database/private vault/Identity/session/Registry/transport/Messaging proof consumers with secret-store managed keys; prohibit production personal documents, public dispatch and payment collection.
3. **TN-2 — Execute ID and VAULT first.** Secure session and private-document controls precede onboard/reviewer/driver workflows; immutable negative, revoke/rotation/recovery/outage evidence.
4. **TN-3 — Execute ELIG and MSG.** Only authentic authorized eligible driver/vehicle/trip can dispatch, and only two current assigned participants can message. Verify safety overrides, assignment changes and terminality.
5. **TN-4 — Independent A11Y across complete rider/driver/operator flows.** Block launch for critical consent, safety or authentication defects, record fixes and retests at the new executable/deployed digest.
6. **TN-5 — Review and accept separately.** Create a dated per-gate signed certificate with deployed artifact hash, exact scenario transcripts, reviewer, exceptions and expiry. No default acceptance; evidence absence = NOT ACCEPTED.
7. **TN-6 — Production promotion only after separate approvals.** Re-evaluate production issuer keys, real Vancouver passenger-transport operator/driver/vehicle approvals and insurance, operational backup/safety obligations, independent accessibility; testnet PASS alone cannot grant production authorization.

## Strict hold status and artifacts

- **Production Identity:** NOT ACCEPTED; LIFTd-TN-ID open.
- **Live transport/Registry eligibility:** NOT ACCEPTED; LIFTd-TN-ELIG open; government/operator approval is **outside testnet**.
- **Private vault:** NOT ACCEPTED; LIFTd-TN-VAULT open.
- **Scoped messaging:** NOT ACCEPTED; LIFTd-TN-MSG open and UI must remain unavailable.
- **Independent accessibility:** NOT ACCEPTED; LIFTd-TN-A11Y open (requires real devices/deployed UI; a blockchain testnet per se is not required).

**No testnet deployed, live issuer, document-vault service, provider credential, regulator signoff or independent accessibility acceptance has been verified by the qualifying repository runs.** These items remain **PENDING — EXTERNAL/DEPLOYED EVIDENCE**. Do not move them to COMPLETE via fixtures, PR merge or markdown updates.

## Acceptance evidence schema

For each track, record: track ID, provider/owner, environment and immutable network/deployment identifiers, executable SHA, configuration digest and signed authority fingerprints, scenario-by-scenario expected/actual (including denial and outage), independent evaluator and date, immutable redacted evidence URLs, PASS/FAIL/NOT ACCEPTED, remediation tickets, expiry and promotion/rollback rules. Keep credentials, raw documents and personal location data out of Git.

**Qualification policy:** app-specific targeted CI and Level 2 do not become Level 3. At complete Phase L02 closeout reconcile against main and use one exact qualified merge-candidate SHA for canonical Solidity, Genesis address authority, Integrated and Docs; avoid duplicate Foundry.

## Render workspace provisioning — 2026-10-14 (America/Regina)

- **Authorized workspace:** `reefer review` (`tea-db3riuei0phs73baf850`); the user explicitly selected this workspace for isolated LIFTd testnet services.
- **Separate readiness web service created:** `liftd-isolated-testnet-readiness` (`srv-db83b42j9qps73bfv300`), [dashboard](https://dashboard.render.com/web/srv-db83b42j9qps73bfv300), origin `https://liftd-isolated-testnet-readiness.onrender.com`, free instance, Oregon, branch `build/liftd-deployed-acceptance-prerequisites-20261014`, auto-deploy **off**.
- **Deployment:** `dep-db83b4ij9qps73bfv4gg` initial build started. Treat service health as **UNVERIFIED** until Render reports deployed/live and endpoints are checked. This process exposes only `GET /health` (liveness) and `GET /readiness` (503 with every external acceptance marked NOT_ACCEPTED). It intentionally has no ride, dispatch, vault, messaging, live token issuer, or payment endpoints. Its existence does not mean the testnet application is deployed.
- **PostgreSQL:** attempted a separate `liftd-isolated-testnet-postgres` free PostgreSQL 16 instance; Render rejected with `cannot have more than one active free tier database`. **NOT PROVISIONED**. The existing `420travel-staging-postgres` belongs to a different application and was not reused or changed. A separate paid database requires user authorization; no paid database was created.
- **Existing ReeferReview web service:** not changed. Existing 420Travel staging database: not changed.
- **Remaining critical dependencies:** separate PostgreSQL, operational backend and secret/config provisioning, independent Identity/session issuers, transport/Registry issuers and regulatory approvals, private vault, Messaging transport, independent accessibility test/signoffs. Every acceptance track remains **NOT ACCEPTED**. Readiness service does not unblock live functionality.

## Connected Neon project — 2026-10-14 (America/Regina)

- Neon connection authenticated and project confirmed: `liftd-testnet` / `nameless-recipe-33007888` in organization `org-flat-hill-15809588`.
- Default `production` branch: `br-tiny-sound-b5cyblac`; AWS Ohio (`aws-us-east-2`); PostgreSQL **18.6**.
- Created isolated database `liftd_testnet` and dedicated database-owning role `liftd_testnet_app`. Confirmed with real SQL: `current_database() = liftd_testnet`, `current_user = liftd_testnet_app`, version `18.6`.
- No credentials or connection strings committed. This establishes **database provisioning and a successful SQL connection only**, not the application schema, secure runtime roles, deployed API connectivity, identity, transport or vault acceptance.
- Render's existing `liftd-isolated-testnet-readiness` deployment `dep-db83b4ij9qps73bfv4gg` reports **live**; the readiness server deliberately exposes no operational API routes and does not yet have an application database connection. The existing ReeferReview/420Travel resources remain untouched.
- **Next technical gate:** apply/check the repository's ordered, checksummed LIFTd SQL migrations on a carefully isolated test branch, create a least-privilege runtime credential, inject its secret into the eventual operational backend service, then run end-to-end Postgres transactions and targeted CI. Do not treat availability of a database as evidence of regulatory approval or production readiness.

## TN-1 — Neon migration + Render restricted connectivity evidence (2026-10-14 America/Regina)

- **Project/database:** `nameless-recipe-33007888`, production branch `br-tiny-sound-b5cyblac`, `liftd_testnet`, PostgreSQL 18.6.
- **Schema migration:** committed files `001_trip_store.sql` through `009_driver_offers.sql` (including `002_private_locations.sql`) applied in a **single transaction**. For each, `liftd.migrations.checksum` stores SHA-256 of the exact SQL text, consistent with `rideshare/src/postgres-store.mjs`. Neon verification: `migrations=9`, `tables=32`, `triggers=29` (non-system).
- **Restricted role:** `liftd_runtime`, independently created from database owner; `CONNECT`, schema `USAGE`, table `SELECT`, and limited DML rights on existing trip/private-location/dispatch/preference/onboarding and immutable event/command tables. It has no migration DDL authority. Restricted role confirmed reading the migration ledger successfully.
- **Secret injection:** `DATABASE_URL` from Neon restricted role was passed directly into Render service `srv-db83b42j9qps73bfv300` environment. Credentials, passwords, complete URIs and personal data were **not** included in source/evidence.
- **Render deployment:** `dep-db84sdon74is73dq8m4g`, exact source SHA `455c2bb6858aef944209f7124812d8464f904373`, **LIVE**. The startup guard in `rideshare/src/testnet-readiness-server.mjs` validates both SQL connection and canonical all-file migration checksum consistency before listening.
- **Actual Render runtime acceptance transcript:** `LIFTD_NEON_SCHEMA_PASS migrations=9 db=liftd_testnet` at 2026-10-15T03:54:02Z (observed Render logs), from instance `srv-db83b42j9qps73bfv300-5hgnl`.
- **Deployment build test results:** `tests 3 / pass 3 / fail 0`, and `npm ci` reported zero vulnerabilities. No live external web endpoint verification is claimed (remote web probes failed DNS resolution in the agent container); Render deployment reported **live** and runtime log independently proved SQL connectivity.
- **Protection:** readiness probe still returns 503 on `/readiness`; all protected trip/dispatch/payments endpoints are **unserved**. The branch remains draft and unmerged. No production/transport/Identity/VAULT/Messaging/A11Y acceptance has been granted.
- **Remaining actual-backend gate:** assemble and deploy the canonical LIFTd protected HTTP handlers with independent signed Identity/session, external eligibility and encrypted vault providers. Then run authenticated request → match → driver offer → cancellation/recovery against actual network-deployed services with production-equivalent authority credentials and separate signed acceptance. This gate is not satisfied by the database startup probe.
